import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Db } from "@/db/types";
import { handleIngest, MAX_MEASUREMENTS, DEVICE_RATE_LIMIT_PER_MIN } from "@/lib/ingest";
import { BAD_TOKEN_LIMIT_PER_MIN } from "@/lib/device-auth";
import { createDevice, createInverter, createTestDb, measurement } from "./helpers";

const NOW = new Date("2026-10-08T14:20:00Z");
const IP = "203.0.113.10";

describe("POST /api/ingest (handleIngest)", () => {
  let db: Db;
  let token: string;
  let deviceId: string;
  let ref: string;
  let inverterId: string;

  beforeEach(async () => {
    ({ db } = await createTestDb());
    const d = await createDevice(db);
    token = d.token;
    deviceId = d.device.id;
    const inv = await createInverter(db, { deviceId, port: 18900 });
    ref = inv.ref;
    inverterId = inv.id;
  });

  const post = (body: unknown, auth: string | null = `Bearer ${token}`, now = NOW) =>
    handleIngest(db, { authorization: auth, ip: IP, rawBody: JSON.stringify(body), now });

  const body = (measurements: unknown[], sticks: unknown[] = []) => ({
    device: { id: "gw", kind: "gateway", firmwareVersion: "0.2.0", uptimeS: 10, sticks },
    measurements,
  });

  it("lehnt fehlendes und falsches Token mit 401 ab", async () => {
    expect((await post(body([]), null)).status).toBe(401);
    expect((await post(body([]), "Bearer smx_falsch_falsch_falsch")).status).toBe(401);
    expect((await post(body([]), token)).status).toBe(401); // ohne "Bearer"
  });

  it("limitiert ungültige Tokens pro IP (429)", async () => {
    let last = 0;
    for (let i = 0; i <= BAD_TOKEN_LIMIT_PER_MIN; i++) {
      last = (await post(body([]), "Bearer smx_ungueltig_123456")).status;
    }
    expect(last).toBe(429);
  });

  it("limitiert pro Device (429)", async () => {
    let last = 0;
    for (let i = 0; i <= DEVICE_RATE_LIMIT_PER_MIN; i++) last = (await post(body([]))).status;
    expect(last).toBe(429);
    // neues Fenster → wieder ok
    expect((await post(body([]), undefined, new Date(NOW.getTime() + 61_000))).status).toBe(200);
  });

  it("validiert das Schema (400)", async () => {
    expect((await handleIngest(db, { authorization: `Bearer ${token}`, ip: IP, rawBody: "{kaputt", now: NOW })).status).toBe(400);
    expect((await post({ device: {}, measurements: [{ inverter: ref, ts: "gestern" }] })).status).toBe(400);
    expect((await post({ measurements: [] })).status).toBe(400);
    const tooMany = Array.from({ length: MAX_MEASUREMENTS + 1 }, (_, i) =>
      measurement(ref, new Date(NOW.getTime() - i * 1000).toISOString()),
    );
    expect((await post(body(tooMany))).status).toBe(400);
  });

  it("akzeptiert leeren Heartbeat und aktualisiert das Device", async () => {
    const res = await post(body([]));
    expect(res).toMatchObject({ status: 200, body: { accepted: 0, duplicates: 0, rejected: 0 } });
    const [d] = await db.select().from(schema.devices).where(eq(schema.devices.id, deviceId));
    expect(d.isOnline).toBe(true);
    expect(d.firmwareVersion).toBe("0.2.0");
    expect(d.lastSeenAt?.toISOString()).toBe(NOW.toISOString());
  });

  it("speichert Messwerte idempotent und zählt Duplikate", async () => {
    const m1 = measurement(ref, "2026-10-08T14:17:57.307Z");
    const m2 = measurement(ref, "2026-10-08T14:18:57.307Z", { energyTodayWh: 10620 });
    expect((await post(body([m1, m2]))).body).toEqual({ accepted: 2, duplicates: 0, rejected: 0 });
    expect((await post(body([m1, m2]))).body).toEqual({ accepted: 0, duplicates: 2, rejected: 0 });
    // Duplikat innerhalb desselben Batches
    const m3 = measurement(ref, "2026-10-08T14:19:57.307Z");
    expect((await post(body([m3, m3]))).body).toEqual({ accepted: 1, duplicates: 1, rejected: 0 });
    const count = await db.select({ n: sql<number>`count(*)::int` }).from(schema.measurements);
    expect(count[0].n).toBe(3);
    // Tagesertrag wird direkt beim Ingest aktualisiert
    const [dy] = await db.select().from(schema.dailyYield);
    expect(dy).toMatchObject({ inverterId, day: "2026-10-08", energyWh: 10620 });
  });

  it("verwirft Messwerte fremder/unbekannter Inverter ohne den Batch abzulehnen", async () => {
    const other = await createDevice(db, "Fremdes Gateway");
    const foreign = await createInverter(db, { deviceId: other.device.id, port: 18900 });
    const res = await post(
      body([
        measurement(ref, "2026-10-08T14:17:00Z"),
        measurement(foreign.ref, "2026-10-08T14:17:00Z"),
        measurement("SC0000-unbekannt", "2026-10-08T14:17:00Z"),
      ]),
    );
    expect(res).toMatchObject({ status: 200, body: { accepted: 1, duplicates: 0, rejected: 2 } });
    const rows = await db.select().from(schema.measurements).where(eq(schema.measurements.inverterId, foreign.id));
    expect(rows).toHaveLength(0);
  });

  it("verwirft Messwerte aus der Zukunft", async () => {
    const res = await post(body([measurement(ref, "2026-10-08T15:00:00Z")]));
    expect(res.body).toEqual({ accepted: 0, duplicates: 0, rejected: 1 });
  });

  it("aktualisiert Stick-Status nur für eigene Inverter", async () => {
    const other = await createDevice(db, "Fremdes Gateway");
    const foreign = await createInverter(db, { deviceId: other.device.id, port: 18901 });
    await post(
      body([], [
        { ref, connected: true, peer: "203.0.113.5:4000", lastOkAt: "2026-10-08T14:19:00Z", lastError: null },
        { ref: foreign.ref, connected: true, lastOkAt: "2026-10-08T14:19:00Z", lastError: "x" },
      ]),
    );
    const [own] = await db.select().from(schema.inverters).where(eq(schema.inverters.id, inverterId));
    expect(own.connected).toBe(true);
    expect(own.lastOkAt?.toISOString()).toBe("2026-10-08T14:19:00.000Z");
    const [f] = await db.select().from(schema.inverters).where(eq(schema.inverters.id, foreign.id));
    expect(f.connected).toBe(false);
    expect(f.lastError).toBeNull();

    await post(body([], [{ ref, connected: false, lastOkAt: null, lastError: "timeout" }]));
    const [own2] = await db.select().from(schema.inverters).where(eq(schema.inverters.id, inverterId));
    expect(own2).toMatchObject({ connected: false, lastError: "timeout" });
    expect(own2.lastOkAt?.toISOString()).toBe("2026-10-08T14:19:00.000Z");
  });
});
