import { sql } from "drizzle-orm";
import type { Db } from "@/db/types";

/** Inverter gilt als offline, wenn der letzte erfolgreiche Abruf älter ist. */
export const INVERTER_OFFLINE_AFTER_MIN = 15;

/** Cron: Devices/Inverter ohne aktuelle Meldung als offline markieren. */
export async function markOffline(db: Db, now: Date = new Date()) {
  const nowIso = now.toISOString();
  const dev = await db.execute(sql`
    UPDATE devices SET is_online = false
    WHERE is_online
      AND (last_seen_at IS NULL
           OR last_seen_at < ${nowIso}::timestamptz - make_interval(mins => offline_after_min))
  `);
  const inv = await db.execute(sql`
    UPDATE inverters SET connected = false
    WHERE connected
      AND (last_ok_at IS NULL
           OR last_ok_at < ${nowIso}::timestamptz - make_interval(mins => ${INVERTER_OFFLINE_AFTER_MIN}::int)
           OR device_id IN (SELECT id FROM devices WHERE NOT is_online))
  `);
  return { devicesOffline: dev.rowCount ?? 0, invertersOffline: inv.rowCount ?? 0 };
}

/** Status-Ableitung für die Anzeige (unabhängig vom Cron-Takt). */
export function isInverterOnline(
  inv: { connected: boolean; lastOkAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (!inv.connected || !inv.lastOkAt) return false;
  return now.getTime() - inv.lastOkAt.getTime() < INVERTER_OFFLINE_AFTER_MIN * 60_000;
}

export function isDeviceOnline(
  dev: { lastSeenAt: Date | null; offlineAfterMin: number },
  now: Date = new Date(),
): boolean {
  if (!dev.lastSeenAt) return false;
  return now.getTime() - dev.lastSeenAt.getTime() < dev.offlineAfterMin * 60_000;
}
