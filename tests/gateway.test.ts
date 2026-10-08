import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { findDeviceByAuthHeader } from "@/lib/device-auth";
import { getGatewayConfig } from "@/lib/gateway-config";
import { markOffline } from "@/lib/offline";
import { createDevice, createInverter, createTestDb } from "./helpers";

describe("GET /api/gateway/config", () => {
  it("liefert nur Inverter des authentifizierten Devices", async () => {
    const { db } = await createTestDb();
    const a = await createDevice(db, "A");
    const b = await createDevice(db, "B");
    const i1 = await createInverter(db, { deviceId: a.device.id, port: 18901 });
    const i2 = await createInverter(db, { deviceId: a.device.id, port: 18900, enabled: false });
    await createInverter(db, { deviceId: b.device.id, port: 18900 });

    const dev = await findDeviceByAuthHeader(db, `Bearer ${a.token}`);
    expect(dev?.id).toBe(a.device.id);
    const cfg = await getGatewayConfig(db, dev!);
    expect(cfg).toEqual({
      pollIntervalS: 300,
      inverters: [
        { ref: i2.ref, port: 18900, enabled: false },
        { ref: i1.ref, port: 18901, enabled: true },
      ],
    });
    expect(await findDeviceByAuthHeader(db, "Bearer smx_unbekannt_000000")).toBeNull();
  });

  it("erzwingt Port-Bereich und Eindeutigkeit je Device", async () => {
    const { db } = await createTestDb();
    const a = await createDevice(db, "A");
    const b = await createDevice(db, "B");
    await createInverter(db, { deviceId: a.device.id, port: 18900 });
    await expect(createInverter(db, { deviceId: a.device.id, port: 18900 })).rejects.toThrow();
    await expect(createInverter(db, { deviceId: a.device.id, port: 19000 })).rejects.toThrow();
    await expect(createInverter(db, { deviceId: b.device.id, port: 18900 })).resolves.toBeTruthy();
  });
});

describe("Offline-Erkennung", () => {
  it("markiert Devices und Inverter ohne aktuelle Meldung offline", async () => {
    const { db } = await createTestDb();
    const now = new Date("2026-10-08T12:00:00Z");
    const a = await createDevice(db, "A");
    const inv = await createInverter(db, { deviceId: a.device.id, port: 18900 });
    await db.update(schema.devices).set({ isOnline: true, lastSeenAt: new Date(now.getTime() - 5 * 60_000) });
    await db.update(schema.inverters).set({ connected: true, lastOkAt: new Date(now.getTime() - 14 * 60_000) });
    expect(await markOffline(db, now)).toEqual({ devicesOffline: 0, invertersOffline: 0 });

    const later = new Date(now.getTime() + 11 * 60_000); // Device 16 min, Inverter 25 min alt
    expect(await markOffline(db, later)).toEqual({ devicesOffline: 1, invertersOffline: 1 });
    const [i] = await db.select().from(schema.inverters).where(eq(schema.inverters.id, inv.id));
    expect(i.connected).toBe(false);
  });
});
