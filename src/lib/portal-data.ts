/**
 * Zentrale Datenzugriffe für den Kundenbereich.
 * JEDE Funktion filtert über `customerId` (aus der Session bzw. vom Admin gewählt).
 * IDs aus der URL werden nur in Kombination mit customerId verwendet → fremde IDs liefern null (404).
 */
import { and, asc, eq, sql } from "drizzle-orm";
import { exec, type Db } from "@/db/types";
import { customers, inverters, sites, type AcPhase, type PvString } from "@/db/schema";
import { toPgUuidArray } from "./aggregate";
import { addDays, berlinDay, daysInMonth, monthOf } from "./time";
import { isInverterOnline } from "./offline";

export async function getCustomer(db: Db, customerId: string) {
  const [c] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  return c ?? null;
}

export async function listSitesForCustomer(db: Db, customerId: string) {
  return db.select().from(sites).where(eq(sites.customerId, customerId)).orderBy(asc(sites.name));
}

export async function getSiteForCustomer(db: Db, customerId: string, siteId: string) {
  if (!isUuid(siteId)) return null;
  const [s] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.customerId, customerId)))
    .limit(1);
  return s ?? null;
}

export type CustomerInverter = {
  id: string;
  ref: string;
  name: string | null;
  model: string | null;
  ratedPowerW: number | null;
  siteId: string | null;
  siteName: string | null;
  enabled: boolean;
  connected: boolean;
  lastOkAt: Date | null;
  lastError: string | null;
};

function inverterSelect(db: Db) {
  return db
    .select({
      id: inverters.id,
      ref: inverters.ref,
      name: inverters.name,
      model: inverters.model,
      ratedPowerW: inverters.ratedPowerW,
      siteId: inverters.siteId,
      siteName: sites.name,
      enabled: inverters.enabled,
      connected: inverters.connected,
      lastOkAt: inverters.lastOkAt,
      lastError: inverters.lastError,
    })
    .from(inverters)
    .leftJoin(sites, eq(sites.id, inverters.siteId));
}

export async function listInvertersForCustomer(
  db: Db,
  customerId: string,
  siteId?: string | null,
): Promise<CustomerInverter[]> {
  const where = siteId
    ? and(eq(inverters.customerId, customerId), eq(inverters.siteId, siteId))
    : eq(inverters.customerId, customerId);
  return inverterSelect(db).where(where).orderBy(asc(inverters.name), asc(inverters.ref));
}

export async function getInverterForCustomer(
  db: Db,
  customerId: string,
  inverterId: string,
): Promise<CustomerInverter | null> {
  if (!isUuid(inverterId)) return null;
  const [inv] = await inverterSelect(db)
    .where(and(eq(inverters.id, inverterId), eq(inverters.customerId, customerId)))
    .limit(1);
  return inv ?? null;
}

export type LatestMeasurement = {
  inverterId: string;
  ts: Date;
  mode: number | null;
  acPowerW: number | null;
  energyTodayWh: number | null;
  energyTotalKwh: number | null;
  temperatureC: number | null;
  maxPowerTodayW: number | null;
  ac: AcPhase[] | null;
  pv: PvString[] | null;
};

/** Letzter Messwert je Inverter (LATERAL + Index (inverter_id, ts desc)). Nur intern mit gescopten IDs aufrufen. */
export async function latestMeasurements(db: Db, inverterIds: string[]): Promise<Map<string, LatestMeasurement>> {
  const out = new Map<string, LatestMeasurement>();
  if (inverterIds.length === 0) return out;
  const res = await exec<Record<string, unknown>>(db, sql`
    SELECT i.id AS inverter_id, m.ts, m.mode, m.ac_power_w, m.energy_today_wh, m.energy_total_kwh,
           m.temperature_c, m.max_power_today_w, m.ac, m.pv
    FROM unnest(${toPgUuidArray(inverterIds)}::uuid[]) AS i(id)
    CROSS JOIN LATERAL (
      SELECT * FROM measurements WHERE inverter_id = i.id ORDER BY ts DESC LIMIT 1
    ) m
  `);
  for (const r of res.rows) {
    out.set(String(r.inverter_id), {
      inverterId: String(r.inverter_id),
      ts: new Date(r.ts as string),
      mode: numOrNull(r.mode),
      acPowerW: numOrNull(r.ac_power_w),
      energyTodayWh: numOrNull(r.energy_today_wh),
      energyTotalKwh: numOrNull(r.energy_total_kwh),
      temperatureC: numOrNull(r.temperature_c),
      maxPowerTodayW: numOrNull(r.max_power_today_w),
      ac: parseJson<AcPhase[]>(r.ac),
      pv: parseJson<PvString[]>(r.pv),
    });
  }
  return out;
}

export type InverterStatus =
  | "ongrid"
  | "standby"
  | "error"
  | "offline"
  | "night"
  | "initial"
  | "shutdown"
  | "unknown";

const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" });

/** Berliner Stunde 0–23. */
export function berlinHour(d: Date): number {
  return Number(hourFmt.format(d));
}

/**
 * Heuristik „Nachtruhe“: Ein offline gemeldeter Wechselrichter ist nachts (ca. 18–8 Uhr Berlin)
 * oder nach einem letzten Wert < 50 W vermutlich nur ausgeschaltet – keine Störung.
 */
export function isNightRest(lastAcPowerW: number | null | undefined, now: Date): boolean {
  const h = berlinHour(now);
  if (h >= 18 || h < 8) return true;
  return lastAcPowerW !== null && lastAcPowerW !== undefined && lastAcPowerW < 50;
}

export type LatestLike = { ts: Date; mode: number | null; acPowerW: number | null };

export function deriveStatus(
  inv: { connected: boolean; lastOkAt: Date | null },
  latest: LatestLike | undefined | null,
  now: Date,
): InverterStatus {
  const stale = !latest || now.getTime() - latest.ts.getTime() > 15 * 60_000;
  if (!isInverterOnline(inv, now) || stale) {
    return isNightRest(latest?.acPowerW ?? null, now) ? "night" : "offline";
  }
  switch (latest.mode) {
    case 3:
      return "ongrid";
    case 1:
      return "standby";
    case 5:
      return "error";
    case 0:
      return "initial";
    case 9:
      return "shutdown";
    default:
      return "unknown";
  }
}

export type CurvePoint = { t: number; [inverterId: string]: number };
export type Bar = { label: string; key: string; wh: number };

export type DashboardData = {
  day: string;
  today: string;
  sites: { id: string; name: string }[];
  siteId: string | null;
  inverters: (CustomerInverter & {
    status: InverterStatus;
    latest: LatestMeasurement | null;
    powerW: number;
    todayWh: number;
    totalKwh: number | null;
  })[];
  totals: { powerW: number; todayWh: number; totalKwh: number; ratedW: number };
  curve: { inverterIds: string[]; points: CurvePoint[] };
  month: { month: string; bars: Bar[]; totalWh: number };
  year: { year: number; bars: Bar[]; totalWh: number };
};

const CURVE_BUCKET_MIN = 5;

/** Komplettes Dashboard eines Kunden (optional auf eine Anlage beschränkt). */
export async function getDashboardData(
  db: Db,
  customerId: string,
  opts: { day?: string; siteId?: string | null } = {},
  now: Date = new Date(),
): Promise<DashboardData | null> {
  const today = berlinDay(now);
  const day = opts.day && opts.day <= today ? opts.day : today;

  const siteList = await listSitesForCustomer(db, customerId);
  let siteId: string | null = null;
  if (opts.siteId) {
    const site = siteList.find((s) => s.id === opts.siteId);
    if (!site) return null; // fremde/unbekannte Anlage → 404
    siteId = site.id;
  }

  const invs = await listInvertersForCustomer(db, customerId, siteId);
  const ids = invs.map((i) => i.id);
  const latest = await latestMeasurements(db, ids);

  const enriched = invs.map((inv) => {
    const l = latest.get(inv.id);
    const status = deriveStatus(inv, l, now);
    const live = status !== "offline" && status !== "night";
    const todayWh = l && berlinDay(l.ts) === today ? (l.energyTodayWh ?? 0) : 0;
    return {
      ...inv,
      status,
      latest: l ?? null,
      powerW: live && l?.acPowerW ? l.acPowerW : 0,
      todayWh,
      totalKwh: l?.energyTotalKwh ?? null,
    };
  });

  const totals = {
    powerW: enriched.reduce((a, i) => a + i.powerW, 0),
    todayWh: enriched.reduce((a, i) => a + i.todayWh, 0),
    totalKwh: enriched.reduce((a, i) => a + (i.totalKwh ?? 0), 0),
    ratedW: enriched.reduce((a, i) => a + (i.ratedPowerW ?? 0), 0),
  };

  const [curve, month, year] = await Promise.all([
    dayCurve(db, ids, day),
    monthBars(db, ids, monthOf(day)),
    yearBars(db, ids, Number(day.slice(0, 4))),
  ]);

  // "Heute" laut Vertrag = letzter energyTodayWh; für den heutigen Balken denselben Wert verwenden
  if (monthOf(day) === monthOf(today)) {
    const bar = month.bars.find((b) => b.key === today);
    if (bar) bar.wh = Math.max(bar.wh, totals.todayWh);
    month.totalWh = month.bars.reduce((a, b) => a + b.wh, 0);
  }

  return {
    day,
    today,
    sites: siteList.map((s) => ({ id: s.id, name: s.name })),
    siteId,
    inverters: enriched,
    totals,
    curve,
    month,
    year,
  };
}

async function dayCurve(db: Db, ids: string[], day: string) {
  if (ids.length === 0) return { inverterIds: ids, points: [] };
  const res = await exec<{ inverter_id: string; bucket: string | Date; p: number | string }>(db, sql`
    SELECT inverter_id,
           to_timestamp(floor(extract(epoch FROM ts) / ${CURVE_BUCKET_MIN * 60}) * ${CURVE_BUCKET_MIN * 60}) AS bucket,
           avg(ac_power_w) AS p
    FROM measurements
    WHERE inverter_id = ANY(${toPgUuidArray(ids)}::uuid[])
      AND ts >= (${day}::date::timestamp AT TIME ZONE 'Europe/Berlin')
      AND ts <  ((${day}::date + 1)::timestamp AT TIME ZONE 'Europe/Berlin')
    GROUP BY 1, 2
    ORDER BY 2
  `);
  const byT = new Map<number, CurvePoint>();
  for (const r of res.rows) {
    const t = new Date(r.bucket).getTime();
    const pt = byT.get(t) ?? ({ t } as CurvePoint);
    pt[String(r.inverter_id)] = Math.round(Number(r.p) || 0);
    byT.set(t, pt);
  }
  const points = [...byT.values()].sort((a, b) => a.t - b.t);
  for (const p of points) for (const id of ids) p[id] ??= 0;
  return { inverterIds: ids, points };
}

async function monthBars(db: Db, ids: string[], month: string) {
  const n = daysInMonth(month);
  const bars: Bar[] = Array.from({ length: n }, (_, i) => {
    const key = addDays(month, i);
    return { key, label: String(i + 1), wh: 0 };
  });
  if (ids.length > 0) {
    const res = await exec<{ day: string | Date; wh: string | number }>(db, sql`
      SELECT day::text AS day, sum(energy_wh) AS wh
      FROM daily_yield
      WHERE inverter_id = ANY(${toPgUuidArray(ids)}::uuid[])
        AND day >= ${month}::date AND day < (${month}::date + interval '1 month')::date
      GROUP BY 1
    `);
    for (const r of res.rows) {
      const key = toDayString(r.day);
      const bar = bars.find((b) => b.key === key);
      if (bar) bar.wh = Number(r.wh);
    }
  }
  return { month, bars, totalWh: bars.reduce((a, b) => a + b.wh, 0) };
}

const MONTH_LABELS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

async function yearBars(db: Db, ids: string[], year: number) {
  const bars: Bar[] = MONTH_LABELS.map((label, i) => ({
    label,
    key: `${year}-${String(i + 1).padStart(2, "0")}-01`,
    wh: 0,
  }));
  if (ids.length > 0) {
    const res = await exec<{ month: string | Date; wh: string | number }>(db, sql`
      SELECT month::text AS month, sum(energy_wh) AS wh
      FROM monthly_yield
      WHERE inverter_id = ANY(${toPgUuidArray(ids)}::uuid[])
        AND month >= make_date(${year}::int, 1, 1) AND month < make_date(${year + 1}::int, 1, 1)
      GROUP BY 1
    `);
    for (const r of res.rows) {
      const key = toDayString(r.month);
      const bar = bars.find((b) => b.key === key);
      if (bar) bar.wh = Number(r.wh);
    }
  }
  return { year, bars, totalWh: bars.reduce((a, b) => a + b.wh, 0) };
}

/** Rohdaten eines Inverters für die Detailansicht (nur wenn er dem Kunden gehört). */
export async function getInverterDetail(db: Db, customerId: string, inverterId: string, now: Date = new Date()) {
  const inv = await getInverterForCustomer(db, customerId, inverterId);
  if (!inv) return null;
  const latest = (await latestMeasurements(db, [inv.id])).get(inv.id);
  return { inverter: inv, latest: latest ?? null, status: deriveStatus(inv, latest, now) };
}

function toDayString(v: string | Date): string {
  if (v instanceof Date) {
    // node-postgres liefert `date` je nach Treiber als lokale Mitternacht
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseJson<T>(v: unknown): T | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return v as T;
}

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
