/**
 * Datenschicht des Kunden-Dashboards (Zeiträume, Kennzahlen, Ersparnis, Portfolio, WR-Detail).
 * Alle Einstiegspunkte bekommen die customerId aus der Session und lösen Anlagen/Wechselrichter
 * ausschließlich innerhalb dieses Kunden auf. Fremde IDs → null (404).
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { exec, type Db } from "@/db/types";
import { sites, tariffs, type AcPhase, type PvString } from "@/db/schema";
import { toPgUuidArray } from "./aggregate";
import {
  addMoney,
  emptyMoney,
  groupTariffs,
  tariffAt,
  valueDay,
  type Money,
  type TariffRow,
} from "./money";
import { bucketKeys, bucketOf, type Period } from "./period";
import {
  deriveStatus,
  isUuid,
  latestMeasurements,
  listInvertersForCustomer,
  listSitesForCustomer,
  type CustomerInverter,
  type InverterStatus,
  type LatestMeasurement,
} from "./portal-data";
import { berlinDay } from "./time";

export const CO2_KG_PER_KWH = 0.38;
const CURVE_BUCKET_MIN = 5;

export type Scope = {
  site: { id: string; name: string; peakPowerKwp: number | null } | null;
  /** alle Wechselrichter im Scope (Anlage bzw. Kunde) */
  all: CustomerInverter[];
  /** ausgewählte Wechselrichter (Filter) */
  selected: CustomerInverter[];
};

/**
 * Löst Anlage und WR-Auswahl innerhalb des Kunden auf.
 * Unbekannte/fremde Anlage oder WR-ID → null.
 */
export async function resolveScope(
  db: Db,
  customerId: string,
  opts: { siteId?: string | null; inverterIds?: string[] | null } = {},
): Promise<Scope | null> {
  let site: Scope["site"] = null;
  if (opts.siteId) {
    if (!isUuid(opts.siteId)) return null;
    const [s] = await db
      .select({ id: sites.id, name: sites.name, peakPowerKwp: sites.peakPowerKwp })
      .from(sites)
      .where(and(eq(sites.id, opts.siteId), eq(sites.customerId, customerId)))
      .limit(1);
    if (!s) return null;
    site = s;
  }
  const all = await listInvertersForCustomer(db, customerId, site?.id ?? null);
  let selected = all;
  if (opts.inverterIds && opts.inverterIds.length > 0) {
    const allowed = new Set(all.map((i) => i.id));
    if (!opts.inverterIds.every((id) => allowed.has(id))) return null;
    const want = new Set(opts.inverterIds);
    selected = all.filter((i) => want.has(i.id));
  }
  return { site, all, selected };
}

// ---------------------------------------------------------------------------
// Rohdaten
// ---------------------------------------------------------------------------

export type DailyRow = { inverterId: string; day: string; wh: number; maxPowerW: number | null };

export async function loadDaily(db: Db, inverterIds: string[], from?: string, to?: string): Promise<DailyRow[]> {
  if (inverterIds.length === 0) return [];
  const range =
    from && to ? sql`AND day >= ${from}::date AND day < ${to}::date` : sql``;
  const res = await exec<{ inverter_id: string; day: string; energy_wh: number | string; max_power_w: number | null }>(
    db,
    sql`SELECT inverter_id, day::text AS day, energy_wh, max_power_w
        FROM daily_yield
        WHERE inverter_id = ANY(${toPgUuidArray(inverterIds)}::uuid[]) ${range}
        ORDER BY day`,
  );
  return res.rows.map((r) => ({
    inverterId: String(r.inverter_id),
    day: String(r.day).slice(0, 10),
    wh: Number(r.energy_wh) || 0,
    maxPowerW: r.max_power_w === null ? null : Number(r.max_power_w),
  }));
}

export async function loadTariffs(db: Db, siteIds: string[]): Promise<TariffRow[]> {
  if (siteIds.length === 0) return [];
  const rows = await db
    .select({
      siteId: tariffs.siteId,
      validFrom: tariffs.validFrom,
      priceCtPerKwh: tariffs.priceCtPerKwh,
      feedInCtPerKwh: tariffs.feedInCtPerKwh,
      selfConsumptionPct: tariffs.selfConsumptionPct,
    })
    .from(tariffs)
    .where(inArray(tariffs.siteId, siteIds))
    .orderBy(asc(tariffs.validFrom));
  return rows;
}

/** Bewertet Tageszeilen mit den jeweils gültigen Tarifen der zugehörigen Anlage. */
export function valueRows(
  rows: DailyRow[],
  inverterSite: Map<string, string | null>,
  tariffsBySite: Map<string, TariffRow[]>,
): Map<DailyRow, Money> {
  const out = new Map<DailyRow, Money>();
  for (const r of rows) {
    const siteId = inverterSite.get(r.inverterId) ?? null;
    const t = siteId ? tariffAt(tariffsBySite.get(siteId), r.day) : null;
    out.set(r, valueDay(r.wh, t));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Zeitraum-Ansicht
// ---------------------------------------------------------------------------

export type Bar = {
  key: string;
  label: string;
  /** Summe Wh über ausgewählte WR */
  wh: number;
  /** Vergleichswert (Vormonat/Vorjahr gleicher Index) */
  compareWh: number | null;
  selfEur: number;
  feedEur: number;
  unpricedWh: number;
  /** Wh je Wechselrichter */
  byInverter: Record<string, number>;
};

export type CurvePoint = { t: number; sum: number; [inverterId: string]: number };

export type Kpis = {
  powerW: number;
  todayWh: number;
  monthWh: number;
  yearWh: number;
  totalKwh: number;
  co2Kg: number;
  /** spezifischer Ertrag (kWh/kWp) im laufenden Jahr, nur wenn Leistung bekannt */
  specificYieldYear: number | null;
  kwp: number | null;
  money: { today: Money; month: Money; year: Money; total: Money };
  hasTariff: boolean;
};

export type PeriodData = {
  period: Period;
  today: string;
  inverters: (CustomerInverter & {
    status: InverterStatus;
    latest: LatestMeasurement | null;
    powerW: number;
    todayWh: number;
    totalKwh: number | null;
  })[];
  kpis: Kpis;
  bars: Bar[];
  curve: CurvePoint[];
  periodWh: number;
  periodMoney: Money;
  compareWh: number | null;
  delta: { wh: number; pct: number | null } | null;
  best: { key: string; wh: number } | null;
  /** Tag-Ansicht: Kennzahlen je WR */
  dayStats: { inverterId: string; wh: number; maxPowerW: number | null }[];
  peakW: number | null;
  /** Heatmap (Monat/Jahr): Tag → Wh */
  heat: { day: string; wh: number }[];
  /** Energiefluss (Schätzung) */
  flow: { totalWh: number; selfWh: number; feedWh: number; evPct: number; assumed: boolean };
};

export async function getPeriodData(
  db: Db,
  scope: Scope,
  period: Period,
  now: Date = new Date(),
): Promise<PeriodData> {
  const today = berlinDay(now);
  const sel = scope.selected;
  const ids = sel.map((i) => i.id);
  const inverterSite = new Map(sel.map((i) => [i.id, i.siteId]));
  const siteIds = [...new Set(sel.map((i) => i.siteId).filter((s): s is string => !!s))];

  const [daily, tariffRows, latest] = await Promise.all([
    loadDaily(db, ids),
    loadTariffs(db, siteIds),
    latestMeasurements(db, ids),
  ]);
  const tariffsBySite = groupTariffs(tariffRows);
  const valued = valueRows(daily, inverterSite, tariffsBySite);

  // --- Wechselrichter-Status/Live-Werte
  const inverters = sel.map((inv) => {
    const l = latest.get(inv.id);
    const status = deriveStatus(inv, l, now);
    const live = status !== "offline" && status !== "night";
    return {
      ...inv,
      status,
      latest: l ?? null,
      powerW: live && l?.acPowerW ? l.acPowerW : 0,
      todayWh: l && berlinDay(l.ts) === today ? (l.energyTodayWh ?? 0) : 0,
      totalKwh: l?.energyTotalKwh ?? null,
    };
  });

  // --- Kennzahlen
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  let monthWh = 0;
  let yearWh = 0;
  const money = { today: emptyMoney(), month: emptyMoney(), year: emptyMoney(), total: emptyMoney() };
  let dailyTodayWh = 0;
  for (const r of daily) {
    const m = valued.get(r)!;
    money.total = addMoney(money.total, m);
    if (r.day.startsWith(year)) {
      yearWh += r.wh;
      money.year = addMoney(money.year, m);
    }
    if (r.day.startsWith(month)) {
      monthWh += r.wh;
      money.month = addMoney(money.month, m);
    }
    if (r.day === today) {
      dailyTodayWh += r.wh;
      money.today = addMoney(money.today, m);
    }
  }
  // „Heute“ laut Vertrag = letzter energyTodayWh; daily_yield wird beim Ingest gleichgezogen
  const liveTodayWh = inverters.reduce((a, i) => a + i.todayWh, 0);
  const todayWh = Math.max(liveTodayWh, dailyTodayWh);
  monthWh += todayWh - dailyTodayWh;
  yearWh += todayWh - dailyTodayWh;

  const totalKwh = inverters.reduce((a, i) => a + (i.totalKwh ?? 0), 0);
  const kwp =
    scope.site?.peakPowerKwp && sel.length === scope.all.length
      ? scope.site.peakPowerKwp
      : sel.length > 0 && sel.every((i) => i.ratedPowerW)
        ? sel.reduce((a, i) => a + (i.ratedPowerW ?? 0), 0) / 1000
        : null;

  const kpis: Kpis = {
    powerW: inverters.reduce((a, i) => a + i.powerW, 0),
    todayWh,
    monthWh,
    yearWh,
    totalKwh,
    co2Kg: totalKwh * CO2_KG_PER_KWH,
    specificYieldYear: kwp ? yearWh / 1000 / kwp : null,
    kwp,
    money,
    hasTariff: tariffRows.length > 0,
  };

  // --- Zeitraum
  const inPeriod = daily.filter((r) => r.day >= period.start && r.day < period.end);
  const firstDay = daily[0]?.day;
  const keys = bucketKeys(period, today, firstDay);
  const barMap = new Map<string, Bar>(
    keys.map((k) => [
      k.key,
      { key: k.key, label: k.label, wh: 0, compareWh: null, selfEur: 0, feedEur: 0, unpricedWh: 0, byInverter: {} },
    ]),
  );
  let periodMoney = emptyMoney();
  let periodWh = 0;
  for (const r of inPeriod) {
    const m = valued.get(r)!;
    periodWh += r.wh;
    periodMoney = addMoney(periodMoney, m);
    const bar = barMap.get(bucketOf(period.view, r.day));
    if (!bar) continue;
    bar.wh += r.wh;
    bar.selfEur += m.selfEur;
    bar.feedEur += m.feedEur;
    bar.unpricedWh += m.unpricedWh;
    bar.byInverter[r.inverterId] = (bar.byInverter[r.inverterId] ?? 0) + r.wh;
  }

  // Vergleichsbalken: gleicher Index im Vormonat bzw. gleicher Monat im Vorjahr
  let compareWh: number | null = null;
  if (period.compare) {
    const cmpRows = daily.filter((r) => r.day >= period.compare!.start && r.day < period.compare!.end);
    compareWh = cmpRows.reduce((a, r) => a + r.wh, 0);
    if (period.view === "month" || period.view === "year") {
      const bars = [...barMap.values()];
      const byIdx = new Map<number, number>();
      for (const r of cmpRows) {
        const idx = period.view === "month" ? Number(r.day.slice(8, 10)) - 1 : Number(r.day.slice(5, 7)) - 1;
        byIdx.set(idx, (byIdx.get(idx) ?? 0) + r.wh);
      }
      bars.forEach((b, i) => (b.compareWh = byIdx.get(i) ?? 0));
    }
  }

  // Heute im laufenden Zeitraum mit Live-Wert angleichen
  if (period.isCurrent && period.view !== "day") {
    const bar = barMap.get(bucketOf(period.view, today));
    if (bar && todayWh > dailyTodayWh) {
      bar.wh += todayWh - dailyTodayWh;
      periodWh += todayWh - dailyTodayWh;
    }
  }

  const bars = [...barMap.values()];
  const best = bars.reduce<{ key: string; wh: number } | null>(
    (b, x) => (x.wh > 0 && (!b || x.wh > b.wh) ? { key: x.key, wh: x.wh } : b),
    null,
  );

  // --- Tag: Kurve und Kennzahlen je WR
  let curve: CurvePoint[] = [];
  let dayStats: PeriodData["dayStats"] = [];
  let peakW: number | null = null;
  if (period.view === "day") {
    curve = await loadDayCurve(db, ids, period.key);
    peakW = curve.reduce<number | null>((m, p) => (m === null || p.sum > m ? p.sum : m), null);
    const maxRes = await loadDayMax(db, ids, period.key);
    dayStats = sel.map((i) => {
      const wh = inPeriod.filter((r) => r.inverterId === i.id).reduce((a, r) => a + r.wh, 0);
      const live = period.isCurrent ? (inverters.find((x) => x.id === i.id)?.todayWh ?? 0) : 0;
      return { inverterId: i.id, wh: Math.max(wh, live), maxPowerW: maxRes.get(i.id) ?? null };
    });
    periodWh = dayStats.reduce((a, s) => a + s.wh, 0);
  }

  // --- Heatmap (Tage des Zeitraums)
  const heatMap = new Map<string, number>();
  if (period.view === "month" || period.view === "year") {
    for (const r of inPeriod) heatMap.set(r.day, (heatMap.get(r.day) ?? 0) + r.wh);
    if (period.isCurrent && todayWh > (heatMap.get(today) ?? 0)) heatMap.set(today, todayWh);
  }
  const heat = [...heatMap.entries()].map(([day, wh]) => ({ day, wh })).sort((a, b) => a.day.localeCompare(b.day));

  // --- Energiefluss (Schätzung über Eigenverbrauchsquote)
  const flowTotal = periodMoney.selfWh + periodMoney.feedWh;
  const flow = {
    totalWh: periodWh,
    selfWh: flowTotal > 0 ? (periodMoney.selfWh / flowTotal) * periodWh : periodWh * 0.3,
    feedWh: flowTotal > 0 ? (periodMoney.feedWh / flowTotal) * periodWh : periodWh * 0.7,
    evPct: flowTotal > 0 ? Math.round((periodMoney.selfWh / flowTotal) * 100) : 30,
    assumed: tariffRows.length === 0,
  };

  return {
    period,
    today,
    inverters,
    kpis,
    bars,
    curve,
    periodWh,
    periodMoney,
    compareWh,
    delta:
      compareWh === null
        ? null
        : { wh: periodWh - compareWh, pct: compareWh > 0 ? ((periodWh - compareWh) / compareWh) * 100 : null },
    best,
    dayStats,
    peakW,
    heat,
    flow,
  };
}

/** 5-min-Kurve eines Berliner Tages je WR + Summe. */
export async function loadDayCurve(db: Db, ids: string[], day: string): Promise<CurvePoint[]> {
  if (ids.length === 0) return [];
  const res = await exec<{ inverter_id: string; bucket: string | Date; p: number | string }>(
    db,
    sql`
      SELECT inverter_id,
             to_timestamp(floor(extract(epoch FROM ts) / ${CURVE_BUCKET_MIN * 60}) * ${CURVE_BUCKET_MIN * 60}) AS bucket,
             avg(ac_power_w) AS p
      FROM measurements
      WHERE inverter_id = ANY(${toPgUuidArray(ids)}::uuid[])
        AND ts >= (${day}::date::timestamp AT TIME ZONE 'Europe/Berlin')
        AND ts <  ((${day}::date + 1)::timestamp AT TIME ZONE 'Europe/Berlin')
      GROUP BY 1, 2
      ORDER BY 2`,
  );
  const byT = new Map<number, CurvePoint>();
  for (const r of res.rows) {
    const t = new Date(r.bucket).getTime();
    const pt = byT.get(t) ?? ({ t, sum: 0 } as CurvePoint);
    pt[String(r.inverter_id)] = Math.round(Number(r.p) || 0);
    byT.set(t, pt);
  }
  const points = [...byT.values()].sort((a, b) => a.t - b.t);
  for (const p of points) {
    let sum = 0;
    for (const id of ids) {
      p[id] ??= 0;
      sum += p[id];
    }
    p.sum = sum;
  }
  return points;
}

async function loadDayMax(db: Db, ids: string[], day: string): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const res = await exec<{ inverter_id: string; p: number | string | null }>(
    db,
    sql`
      SELECT inverter_id, max(ac_power_w) AS p
      FROM measurements
      WHERE inverter_id = ANY(${toPgUuidArray(ids)}::uuid[])
        AND ts >= (${day}::date::timestamp AT TIME ZONE 'Europe/Berlin')
        AND ts <  ((${day}::date + 1)::timestamp AT TIME ZONE 'Europe/Berlin')
      GROUP BY 1`,
  );
  return new Map(res.rows.filter((r) => r.p !== null).map((r) => [String(r.inverter_id), Number(r.p)]));
}

// ---------------------------------------------------------------------------
// Portfolio (alle Anlagen eines Kunden)
// ---------------------------------------------------------------------------

export type PortfolioSite = {
  id: string | null;
  name: string;
  address: string | null;
  peakPowerKwp: number | null;
  inverterCount: number;
  powerW: number;
  todayWh: number;
  status: InverterStatus;
  spark: number[];
};

const STATUS_RANK: InverterStatus[] = ["error", "offline", "unknown", "initial", "shutdown", "standby", "night", "ongrid"];

/** Schlechtester Status einer Gruppe (für die Ampel). */
export function worstStatus(list: InverterStatus[]): InverterStatus {
  if (list.length === 0) return "unknown";
  return list.reduce((w, s) => (STATUS_RANK.indexOf(s) < STATUS_RANK.indexOf(w) ? s : w));
}

export async function getPortfolio(db: Db, customerId: string, now: Date = new Date()) {
  const today = berlinDay(now);
  const [siteList, invs] = await Promise.all([
    listSitesForCustomer(db, customerId),
    listInvertersForCustomer(db, customerId),
  ]);
  const ids = invs.map((i) => i.id);
  const [latest, curve] = await Promise.all([latestMeasurements(db, ids), loadDayCurve(db, ids, today)]);

  const groups: { id: string | null; name: string; address: string | null; peakPowerKwp: number | null }[] = siteList.map(
    (s) => ({ id: s.id, name: s.name, address: s.address, peakPowerKwp: s.peakPowerKwp }),
  );
  if (invs.some((i) => !i.siteId)) groups.push({ id: null, name: "Ohne Anlage", address: null, peakPowerKwp: null });

  const result: PortfolioSite[] = groups.map((g) => {
    const members = invs.filter((i) => (i.siteId ?? null) === g.id);
    let powerW = 0;
    let todayWh = 0;
    const statuses: InverterStatus[] = [];
    for (const i of members) {
      const l = latest.get(i.id);
      const st = deriveStatus(i, l, now);
      statuses.push(st);
      if (st !== "offline" && st !== "night") powerW += l?.acPowerW ?? 0;
      if (l && berlinDay(l.ts) === today) todayWh += l.energyTodayWh ?? 0;
    }
    // Sparkline: 15-min-Summen der heutigen Kurve
    const spark: number[] = [];
    let bucket = -1;
    for (const p of curve) {
      const b = Math.floor(p.t / (15 * 60_000));
      const v = members.reduce((a, i) => a + (p[i.id] ?? 0), 0);
      if (b !== bucket) {
        spark.push(v);
        bucket = b;
      } else spark[spark.length - 1] = Math.max(spark[spark.length - 1], v);
    }
    return {
      ...g,
      inverterCount: members.length,
      powerW,
      todayWh,
      status: worstStatus(statuses),
      spark,
    };
  });
  return {
    sites: result,
    totals: {
      powerW: result.reduce((a, s) => a + s.powerW, 0),
      todayWh: result.reduce((a, s) => a + s.todayWh, 0),
      inverterCount: invs.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Wechselrichter-Detail
// ---------------------------------------------------------------------------

export type InverterDayPoint = {
  t: number;
  acPowerW: number | null;
  temperatureC: number | null;
  mode: number | null;
  pv1: number | null;
  pv2: number | null;
  pv3: number | null;
};

export type StatusSegment = { from: number; to: number; mode: number | null };

export async function getInverterDay(db: Db, inverterId: string, day: string) {
  const res = await exec<{
    ts: string | Date;
    mode: number | null;
    ac_power_w: number | null;
    temperature_c: number | null;
    pv: PvString[] | string | null;
    ac: AcPhase[] | string | null;
  }>(
    db,
    sql`
      SELECT ts, mode, ac_power_w, temperature_c, pv, ac
      FROM measurements
      WHERE inverter_id = ${inverterId}::uuid
        AND ts >= (${day}::date::timestamp AT TIME ZONE 'Europe/Berlin')
        AND ts <  ((${day}::date + 1)::timestamp AT TIME ZONE 'Europe/Berlin')
      ORDER BY ts`,
  );
  const points: InverterDayPoint[] = res.rows.map((r) => {
    const pv = (typeof r.pv === "string" ? (JSON.parse(r.pv) as PvString[]) : r.pv) ?? [];
    return {
      t: new Date(r.ts).getTime(),
      acPowerW: r.ac_power_w === null ? null : Number(r.ac_power_w),
      temperatureC: r.temperature_c === null ? null : Number(r.temperature_c),
      mode: r.mode === null ? null : Number(r.mode),
      pv1: pv[0]?.p ?? null,
      pv2: pv[1]?.p ?? null,
      pv3: pv[2]?.p ?? null,
    };
  });
  // Statusverlauf: zusammenhängende Abschnitte gleichen Modus; Lücken > 15 min = keine Daten
  const segments: StatusSegment[] = [];
  for (const p of points) {
    const last = segments[segments.length - 1];
    if (last && last.mode === p.mode && p.t - last.to <= 15 * 60_000) last.to = p.t;
    else segments.push({ from: p.t, to: p.t, mode: p.mode });
  }
  return { points, segments };
}
