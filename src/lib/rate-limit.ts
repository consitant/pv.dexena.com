import { sql } from "drizzle-orm";
import { exec, type Db } from "@/db/types";

export type RateLimitResult = { ok: boolean; count: number; limit: number; retryAfterS: number };

/**
 * Fixed-Window-Rate-Limit in Postgres (ein atomares Upsert-Statement).
 * `windowS` Sekunden je Fenster, `limit` erlaubte Treffer je Fenster.
 */
export async function rateLimit(
  db: Db,
  key: string,
  limit: number,
  windowS: number,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const windowMs = windowS * 1000;
  const startMs = Math.floor(now.getTime() / windowMs) * windowMs;
  const windowStart = new Date(startMs).toISOString();
  const res = await exec<{ count: number }>(db, sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, ${windowStart}::timestamptz, 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start = EXCLUDED.window_start
                   THEN rate_limits.count + 1 ELSE 1 END,
      window_start = EXCLUDED.window_start
    RETURNING count
  `);
  const count = Number(res.rows[0]?.count ?? 1);
  const retryAfterS = Math.max(1, Math.ceil((startMs + windowMs - now.getTime()) / 1000));
  return { ok: count <= limit, count, limit, retryAfterS };
}

/** Entfernt abgelaufene Rate-Limit-Einträge (vom Cron aufgerufen). */
export async function pruneRateLimits(db: Db, now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  await db.execute(sql`DELETE FROM rate_limits WHERE window_start < ${cutoff}::timestamptz`);
}
