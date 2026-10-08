import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/types";
import { devices, inverters, measurements } from "@/db/schema";
import { authenticateDevice } from "./device-auth";
import { rateLimit } from "./rate-limit";
import { upsertDailyFromRange } from "./aggregate";

export const MAX_BODY_BYTES = 1024 * 1024;
export const MAX_MEASUREMENTS = 500;
/** Gateway sendet ca. alle 1–5 min; großzügiges Limit pro Device. */
export const DEVICE_RATE_LIMIT_PER_MIN = 30;
/** Messwerte, die mehr als so weit in der Zukunft liegen, werden verworfen (Uhrfehler). */
const MAX_FUTURE_SKEW_MS = 10 * 60 * 1000;

const num = z.number().finite();
const optNum = num.nullish();

const acPhase = z.object({ u: num, i: num, p: num, f: num });
const pvString = z.object({ u: num, i: num, p: num });

export const measurementSchema = z.object({
  inverter: z.string().min(1).max(64),
  ts: z.iso.datetime({ offset: true }),
  mode: z.number().int().min(0).max(255).nullish(),
  acPowerW: optNum,
  energyTodayWh: z.number().int().min(0).max(2_000_000_000).nullish(),
  energyTotalKwh: z.number().int().min(0).max(2_000_000_000).nullish(),
  temperatureC: optNum,
  maxPowerTodayW: optNum,
  ac: z.array(acPhase).max(3).nullish(),
  pv: z.array(pvString).max(3).nullish(),
  raw: z.record(z.string().max(16), num).nullish(),
});

const stickSchema = z.object({
  ref: z.string().min(1).max(64),
  connected: z.boolean(),
  peer: z.string().max(100).nullish(),
  lastOkAt: z.iso.datetime({ offset: true }).nullish(),
  lastError: z.string().max(500).nullish(),
});

export const ingestSchema = z.object({
  device: z
    .object({
      id: z.string().max(100).optional(),
      kind: z.string().max(20).optional(),
      firmwareVersion: z.string().max(50).nullish(),
      uptimeS: z.number().nullish(),
      freeHeap: z.number().nullish(),
      network: z.string().max(50).nullish(),
      sticks: z.array(stickSchema).max(200).optional(),
    })
    .passthrough(),
  measurements: z.array(measurementSchema).max(MAX_MEASUREMENTS),
});

export type IngestBody = z.infer<typeof ingestSchema>;

export type IngestResult = {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
};

export type IngestInput = {
  authorization: string | null;
  ip: string;
  rawBody: string;
  now?: Date;
};

/** Vollständige Ingest-Verarbeitung (ohne HTTP-Abhängigkeit, testbar mit PGlite). */
export async function handleIngest(db: Db, input: IngestInput): Promise<IngestResult> {
  const now = input.now ?? new Date();

  // 1) Auth (401 / 429 für wiederholt ungültige Tokens je IP)
  const auth = await authenticateDevice(db, input.authorization, input.ip, now);
  if (!auth.ok) {
    return auth.status === 429
      ? { status: 429, body: { error: "rate_limited" }, headers: { "retry-after": String(auth.retryAfterS ?? 60) } }
      : { status: 401, body: { error: "unauthorized" } };
  }
  const device = auth.device;

  // 2) Rate-Limit je Device
  const rl = await rateLimit(db, `ingest:${device.id}`, DEVICE_RATE_LIMIT_PER_MIN, 60, now);
  if (!rl.ok) {
    return { status: 429, body: { error: "rate_limited" }, headers: { "retry-after": String(rl.retryAfterS) } };
  }

  // 3) Body-Limit + Schema
  if (Buffer.byteLength(input.rawBody, "utf8") > MAX_BODY_BYTES) {
    return { status: 413, body: { error: "payload_too_large" } };
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.rawBody);
  } catch {
    return { status: 400, body: { error: "invalid_json" } };
  }
  const parsed = ingestSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        error: "invalid_body",
        issues: parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    };
  }
  const body = parsed.data;

  // 4) Inverter dieses Devices laden
  const own = await db
    .select({ id: inverters.id, ref: inverters.ref })
    .from(inverters)
    .where(eq(inverters.deviceId, device.id));
  const refToId = new Map(own.map((i) => [i.ref, i.id]));

  // 5) Messwerte zuordnen, fremde/unbekannte/zukünftige verwerfen
  let rejected = 0;
  const rows: (typeof measurements.$inferInsert)[] = [];
  for (const m of body.measurements) {
    const inverterId = refToId.get(m.inverter);
    const ts = new Date(m.ts);
    if (!inverterId || ts.getTime() > now.getTime() + MAX_FUTURE_SKEW_MS) {
      rejected++;
      continue;
    }
    rows.push({
      inverterId,
      ts,
      mode: m.mode ?? null,
      acPowerW: m.acPowerW ?? null,
      energyTodayWh: m.energyTodayWh ?? null,
      energyTotalKwh: m.energyTotalKwh ?? null,
      temperatureC: m.temperatureC ?? null,
      maxPowerTodayW: m.maxPowerTodayW ?? null,
      ac: m.ac ?? null,
      pv: m.pv ?? null,
      raw: m.raw ?? null,
    });
  }

  let accepted = 0;
  if (rows.length > 0) {
    const inserted = await db
      .insert(measurements)
      .values(rows)
      .onConflictDoNothing()
      .returning({ inverterId: measurements.inverterId, ts: measurements.ts });
    accepted = inserted.length;

    if (inserted.length > 0) {
      // Pro Inverter: last_ok_at auf den jüngsten neuen Messwert ziehen
      const latest = new Map<string, Date>();
      let minTs = inserted[0].ts;
      let maxTs = inserted[0].ts;
      for (const r of inserted) {
        const prev = latest.get(r.inverterId);
        if (!prev || r.ts > prev) latest.set(r.inverterId, r.ts);
        if (r.ts < minTs) minTs = r.ts;
        if (r.ts > maxTs) maxTs = r.ts;
      }
      for (const [inverterId, ts] of latest) {
        await db
          .update(inverters)
          .set({ lastOkAt: sql`GREATEST(${inverters.lastOkAt}, ${ts.toISOString()}::timestamptz)` })
          .where(eq(inverters.id, inverterId));
      }
      // Heutigen Tagesertrag sofort aktualisieren (Dashboard aktuell halten)
      await upsertDailyFromRange(db, [...latest.keys()], minTs, maxTs);
    }
  }
  const duplicates = rows.length - accepted;

  // 6) Stick-Status (nur eigene Inverter)
  for (const s of body.device.sticks ?? []) {
    const inverterId = refToId.get(s.ref);
    if (!inverterId) continue;
    const lastOk = s.lastOkAt ? new Date(Math.min(new Date(s.lastOkAt).getTime(), now.getTime())) : null;
    await db
      .update(inverters)
      .set({
        connected: s.connected,
        lastError: s.lastError ?? null,
        ...(lastOk
          ? { lastOkAt: sql`GREATEST(${inverters.lastOkAt}, ${lastOk.toISOString()}::timestamptz)` }
          : {}),
      })
      .where(and(eq(inverters.id, inverterId), eq(inverters.deviceId, device.id)));
  }

  // 7) Device-Heartbeat
  await db
    .update(devices)
    .set({
      lastSeenAt: now,
      isOnline: true,
      firmwareVersion: body.device.firmwareVersion ?? device.firmwareVersion,
      lastHeartbeat: { ...body.device, receivedAt: now.toISOString() },
    })
    .where(eq(devices.id, device.id));

  return { status: 200, body: { accepted, duplicates, rejected } };
}
