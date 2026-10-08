/** CSV-Export eines Zeitraums – immer über resolveScope auf den Kunden beschränkt. */
import { sql } from "drizzle-orm";
import { exec, type Db } from "@/db/types";
import type { AcPhase, PvString } from "@/db/schema";
import { toPgUuidArray } from "./aggregate";
import { loadDaily, loadTariffs, valueRows, type Scope } from "./dashboard";
import { addMoney, emptyMoney, groupTariffs, roundEur, type Money } from "./money";
import { bucketOf, type Period } from "./period";

const SEP = ";";

function cell(v: string | number | null | undefined, digits?: number): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    const s = digits === undefined ? String(v) : v.toFixed(digits);
    return s.replace(".", ",");
  }
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function line(cells: (string | number | null | undefined)[], digits: (number | undefined)[] = []): string {
  return cells.map((c, i) => cell(c, digits[i])).join(SEP);
}

const tsFmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Baut die CSV (UTF-8 mit BOM, Semikolon, Dezimalkomma – Excel-freundlich). */
export async function buildCsv(db: Db, scope: Scope, period: Period): Promise<{ filename: string; csv: string }> {
  const sel = scope.selected;
  const ids = sel.map((i) => i.id);
  const names = new Map(sel.map((i) => [i.id, i.name ?? i.ref]));
  const refs = new Map(sel.map((i) => [i.id, i.ref]));
  const lines: string[] = [];

  if (period.view === "day") {
    lines.push(
      line([
        "Zeit (Europe/Berlin)", "Wechselrichter", "Kennung", "Modus", "AC-Leistung W", "Ertrag heute Wh",
        "Gesamtzähler kWh", "Temperatur °C", "PV1 V", "PV1 A", "PV1 W", "PV2 V", "PV2 A", "PV2 W", "PV3 V", "PV3 A", "PV3 W",
        "L1 V", "L2 V", "L3 V", "Frequenz Hz",
      ]),
    );
    if (ids.length > 0) {
      const res = await exec<{
        inverter_id: string; ts: string | Date; mode: number | null; ac_power_w: number | null; energy_today_wh: number | null;
        energy_total_kwh: number | null; temperature_c: number | null; pv: PvString[] | string | null; ac: AcPhase[] | string | null;
      }>(
        db,
        sql`SELECT inverter_id, ts, mode, ac_power_w, energy_today_wh, energy_total_kwh, temperature_c, pv, ac
            FROM measurements
            WHERE inverter_id = ANY(${toPgUuidArray(ids)}::uuid[])
              AND ts >= (${period.start}::date::timestamp AT TIME ZONE 'Europe/Berlin')
              AND ts <  (${period.end}::date::timestamp AT TIME ZONE 'Europe/Berlin')
            ORDER BY ts, inverter_id`,
      );
      for (const r of res.rows) {
        const pv = (typeof r.pv === "string" ? JSON.parse(r.pv) : r.pv) as PvString[] | null;
        const ac = (typeof r.ac === "string" ? JSON.parse(r.ac) : r.ac) as AcPhase[] | null;
        const id = String(r.inverter_id);
        lines.push(
          line(
            [
              tsFmt.format(new Date(r.ts)), names.get(id), refs.get(id), r.mode, num(r.ac_power_w), num(r.energy_today_wh),
              num(r.energy_total_kwh), num(r.temperature_c),
              pv?.[0]?.u, pv?.[0]?.i, pv?.[0]?.p, pv?.[1]?.u, pv?.[1]?.i, pv?.[1]?.p, pv?.[2]?.u, pv?.[2]?.i, pv?.[2]?.p,
              ac?.[0]?.u, ac?.[1]?.u, ac?.[2]?.u, ac?.[0]?.f,
            ],
            [undefined, undefined, undefined, undefined, 1, 0, 0, 1],
          ),
        );
      }
    }
  } else {
    const periodLabel = period.view === "month" ? "Tag" : period.view === "year" ? "Monat" : "Jahr";
    lines.push(
      line([
        periodLabel, "Wechselrichter", "Kennung", "Ertrag kWh", "Ersparnis Eigenverbrauch € (Schätzung)",
        "Einspeisevergütung € (Schätzung)", "Summe € (Schätzung)", "ohne Tarif kWh",
      ]),
    );
    const [daily, tariffRows] = await Promise.all([loadDaily(db, ids, period.start, period.end), loadTariffs(db, [
      ...new Set(sel.map((i) => i.siteId).filter((s): s is string => !!s)),
    ])]);
    const valued = valueRows(daily, new Map(sel.map((i) => [i.id, i.siteId])), groupTariffs(tariffRows));
    const agg = new Map<string, { wh: number; m: Money }>();
    for (const r of daily) {
      const k = `${bucketOf(period.view, r.day)}|${r.inverterId}`;
      const a = agg.get(k) ?? { wh: 0, m: emptyMoney() };
      a.wh += r.wh;
      a.m = addMoney(a.m, valued.get(r)!);
      agg.set(k, a);
    }
    for (const [k, a] of [...agg.entries()].sort(([x], [y]) => x.localeCompare(y))) {
      const [bucket, id] = k.split("|");
      lines.push(
        line(
          [bucket, names.get(id), refs.get(id), a.wh / 1000, roundEur(a.m.selfEur), roundEur(a.m.feedEur),
            roundEur(a.m.selfEur + a.m.feedEur), a.m.unpricedWh / 1000],
          [undefined, undefined, undefined, 2, 2, 2, 2, 2],
        ),
      );
    }
  }

  const scopeName = (scope.site?.name ?? "alle-anlagen").replace(/[^\wäöüÄÖÜß-]+/g, "-").slice(0, 40);
  return { filename: `pv-${scopeName}-${period.view}-${period.key}.csv`, csv: "﻿" + lines.join("\r\n") + "\r\n" };
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
