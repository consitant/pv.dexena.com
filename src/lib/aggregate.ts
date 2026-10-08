import { sql } from "drizzle-orm";
import type { Db } from "@/db/types";
import { addDays, berlinDay, monthOf } from "./time";

/**
 * Tagesertrag = max(energy_today_wh) je Inverter und Berliner Kalendertag.
 * Rechnet die Tage [fromDay, toDay] (inklusive, "YYYY-MM-DD") vollständig neu – idempotent.
 * Optional nur für bestimmte Inverter.
 */
export async function aggregateDays(
  db: Db,
  fromDay: string,
  toDay: string,
  inverterIds?: string[],
): Promise<number> {
  const filter =
    inverterIds && inverterIds.length > 0
      ? sql`AND inverter_id = ANY(${toPgUuidArray(inverterIds)}::uuid[])`
      : sql``;
  const res = await db.execute(sql`
    INSERT INTO daily_yield (inverter_id, day, energy_wh, max_power_w)
    SELECT inverter_id,
           (ts AT TIME ZONE 'Europe/Berlin')::date AS day,
           max(energy_today_wh),
           max(max_power_today_w)
    FROM measurements
    WHERE ts >= (${fromDay}::date::timestamp AT TIME ZONE 'Europe/Berlin')
      AND ts <  ((${toDay}::date + 1)::timestamp AT TIME ZONE 'Europe/Berlin')
      AND energy_today_wh IS NOT NULL
      ${filter}
    GROUP BY 1, 2
    ON CONFLICT (inverter_id, day) DO UPDATE
      SET energy_wh = EXCLUDED.energy_wh,
          max_power_w = EXCLUDED.max_power_w
  `);
  await aggregateMonths(db, monthOf(fromDay), monthOf(toDay), inverterIds);
  return res.rowCount ?? 0;
}

/** Monatsertrag = Summe der Tageserträge; rechnet die Monate [fromMonth, toMonth] neu. */
export async function aggregateMonths(
  db: Db,
  fromMonth: string,
  toMonth: string,
  inverterIds?: string[],
): Promise<void> {
  const filter =
    inverterIds && inverterIds.length > 0
      ? sql`AND inverter_id = ANY(${toPgUuidArray(inverterIds)}::uuid[])`
      : sql``;
  await db.execute(sql`
    INSERT INTO monthly_yield (inverter_id, month, energy_wh)
    SELECT inverter_id, date_trunc('month', day)::date, sum(energy_wh)
    FROM daily_yield
    WHERE day >= ${fromMonth}::date
      AND day < (${toMonth}::date + interval '1 month')::date
      ${filter}
    GROUP BY 1, 2
    ON CONFLICT (inverter_id, month) DO UPDATE SET energy_wh = EXCLUDED.energy_wh
  `);
}

/**
 * Inkrementelles Upsert beim Ingest: nur für die betroffenen Inverter und Zeitspanne,
 * kombiniert per GREATEST (max ist über Teilmengen kombinierbar).
 */
export async function upsertDailyFromRange(
  db: Db,
  inverterIds: string[],
  minTs: Date,
  maxTs: Date,
): Promise<void> {
  if (inverterIds.length === 0) return;
  await db.execute(sql`
    INSERT INTO daily_yield (inverter_id, day, energy_wh, max_power_w)
    SELECT inverter_id,
           (ts AT TIME ZONE 'Europe/Berlin')::date,
           max(energy_today_wh),
           max(max_power_today_w)
    FROM measurements
    WHERE inverter_id = ANY(${toPgUuidArray(inverterIds)}::uuid[])
      AND ts >= ${minTs.toISOString()}::timestamptz
      AND ts <= ${maxTs.toISOString()}::timestamptz
      AND energy_today_wh IS NOT NULL
    GROUP BY 1, 2
    ON CONFLICT (inverter_id, day) DO UPDATE
      SET energy_wh = GREATEST(daily_yield.energy_wh, EXCLUDED.energy_wh),
          max_power_w = GREATEST(daily_yield.max_power_w, EXCLUDED.max_power_w)
  `);
  await aggregateMonths(db, monthOf(berlinDay(minTs)), monthOf(berlinDay(maxTs)), inverterIds);
}

/** Cron: die letzten `days` Berliner Tage (inkl. heute) neu aggregieren. */
export async function aggregateRecent(db: Db, now: Date = new Date(), days = 2) {
  const toDay = berlinDay(now);
  const fromDay = addDays(toDay, -(days - 1));
  const rows = await aggregateDays(db, fromDay, toDay);
  return { fromDay, toDay, rows };
}

/** Postgres-Array-Literal für UUIDs (IDs stammen aus der DB, werden trotzdem validiert). */
export function toPgUuidArray(ids: string[]): string {
  for (const id of ids) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Ungültige UUID");
  }
  return `{${ids.join(",")}}`;
}
