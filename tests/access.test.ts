import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Db } from "@/db/types";
import { getPeriodData, resolveScope } from "@/lib/dashboard";
import { parsePeriod } from "@/lib/period";
import {
  getInverterDetail,
  getInverterForCustomer,
  getSiteForCustomer,
  listInvertersForCustomer,
  listSitesForCustomer,
} from "@/lib/portal-data";
import { handleIngest } from "@/lib/ingest";
import { createCustomer, createDevice, createInverter, createTestDb, measurement } from "./helpers";

const NOW = new Date("2026-10-08T12:00:00Z");

describe("Rechteprüfung: Kunde A sieht nie Daten von Kunde B", () => {
  let db: Db;
  const ids = {} as Record<string, string>;

  beforeAll(async () => {
    ({ db } = await createTestDb());
    const a = await createCustomer(db, "Kunde A");
    const b = await createCustomer(db, "Kunde B");
    ids.a = a.id;
    ids.b = b.id;
    const [siteA] = await db.insert(schema.sites).values({ customerId: a.id, name: "Dach A" }).returning();
    const [siteB] = await db.insert(schema.sites).values({ customerId: b.id, name: "Dach B" }).returning();
    ids.siteA = siteA.id;
    ids.siteB = siteB.id;
    const { device, token } = await createDevice(db);
    const invA = await createInverter(db, { deviceId: device.id, port: 18900, customerId: a.id, siteId: siteA.id });
    const invA2 = await createInverter(db, { deviceId: device.id, port: 18901, customerId: a.id }); // ohne Anlage
    const invB = await createInverter(db, { deviceId: device.id, port: 18902, customerId: b.id, siteId: siteB.id });
    await createInverter(db, { deviceId: device.id, port: 18903 }); // nicht zugeordnet
    ids.invA = invA.id;
    ids.invA2 = invA2.id;
    ids.invB = invB.id;
    await handleIngest(db, {
      authorization: `Bearer ${token}`,
      ip: "203.0.113.1",
      now: NOW,
      rawBody: JSON.stringify({
        device: {
          sticks: [invA, invA2, invB].map((i) => ({ ref: i.ref, connected: true, lastOkAt: "2026-10-08T11:59:00Z" })),
        },
        measurements: [
          measurement(invA.ref, "2026-10-08T11:59:00Z", { acPowerW: 1000, energyTodayWh: 5000 }),
          measurement(invA2.ref, "2026-10-08T11:59:00Z", { acPowerW: 500, energyTodayWh: 2000 }),
          measurement(invB.ref, "2026-10-08T11:59:00Z", { acPowerW: 9999, energyTodayWh: 99999 }),
        ],
      }),
    });
  });

  it("listet nur eigene Anlagen und Inverter (auch Inverter ohne Anlage)", async () => {
    expect((await listSitesForCustomer(db, ids.a)).map((s) => s.id)).toEqual([ids.siteA]);
    const invs = await listInvertersForCustomer(db, ids.a);
    expect(invs.map((i) => i.id).sort()).toEqual([ids.invA, ids.invA2].sort());
    expect((await listInvertersForCustomer(db, ids.b)).map((i) => i.id)).toEqual([ids.invB]);
  });

  it("liefert null für fremde IDs (→ 404)", async () => {
    expect(await getInverterForCustomer(db, ids.a, ids.invB)).toBeNull();
    expect(await getInverterDetail(db, ids.a, ids.invB, NOW)).toBeNull();
    expect(await getSiteForCustomer(db, ids.a, ids.siteB)).toBeNull();
    expect(await getInverterForCustomer(db, ids.a, "kein-uuid")).toBeNull();
    expect(await getInverterForCustomer(db, ids.a, ids.invA)).not.toBeNull();
  });

  const dash = async (customerId: string, opts: { siteId?: string } = {}, now = NOW, view = "day") => {
    const scope = await resolveScope(db, customerId, opts);
    if (!scope) return null;
    return getPeriodData(db, scope, parsePeriod(view, null, "2026-10-08"), now);
  };

  it("Dashboard von A enthält keine Werte von B; fremde Anlage → null", async () => {
    const d = await dash(ids.a);
    expect(d).not.toBeNull();
    expect(d!.inverters.map((i) => i.id).sort()).toEqual([ids.invA, ids.invA2].sort());
    expect(d!.kpis.powerW).toBe(1500);
    expect(d!.kpis.todayWh).toBe(7000);
    expect(d!.kpis.monthWh).toBe(7000);
    expect(d!.kpis.yearWh).toBe(7000);
    expect(JSON.stringify(d)).not.toContain(ids.invB);
    expect(JSON.stringify(await dash(ids.a, {}, NOW, "month"))).not.toContain(ids.invB);
    expect(await dash(ids.a, { siteId: ids.siteB })).toBeNull();
    const onlySite = await dash(ids.a, { siteId: ids.siteA });
    expect(onlySite!.inverters.map((i) => i.id)).toEqual([ids.invA]);
  });

  it("Status: OnGrid bei frischem Wert, Offline wenn veraltet (tagsüber)", async () => {
    const d = await dash(ids.a);
    expect(d!.inverters.every((i) => i.status === "ongrid")).toBe(true);
    const later = await dash(ids.a, {}, new Date(NOW.getTime() + 20 * 60_000));
    expect(later!.inverters.every((i) => i.status === "offline")).toBe(true);
    expect(later!.kpis.powerW).toBe(0);
  });
});
