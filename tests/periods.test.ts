import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Db } from "@/db/types";
import { aggregateDays } from "@/lib/aggregate";
import { getPeriodData, resolveScope, worstStatus } from "@/lib/dashboard";
import { parsePeriod } from "@/lib/period";
import { deriveStatus, isNightRest } from "@/lib/portal-data";
import { createCustomer, createDevice, createInverter, createTestDb } from "./helpers";

const TODAY = "2026-10-08";
const NOW = new Date("2026-10-08T10:00:00Z"); // 12:00 Berlin

async function m(db: Db, inverterId: string, ts: string, wh: number) {
  await db.insert(schema.measurements).values({ inverterId, ts: new Date(ts), energyTodayWh: wh, energyTotalKwh: 1000, acPowerW: 500 });
}

describe("parsePeriod", () => {
  it("validiert und klemmt Zeiträume", () => {
    expect(parsePeriod("month", "2026-09", TODAY)).toMatchObject({ key: "2026-09", start: "2026-09-01", end: "2026-10-01", prevKey: "2026-08", nextKey: "2026-10" });
    expect(parsePeriod("month", "2026-12", TODAY)).toMatchObject({ key: "2026-10", nextKey: null, isCurrent: true });
    expect(parsePeriod("month", "kaputt", TODAY).key).toBe("2026-10");
    expect(parsePeriod("year", "2025", TODAY)).toMatchObject({ start: "2025-01-01", end: "2026-01-01", compare: { key: "2024" } });
    expect(parsePeriod("day", "2026-02-30", TODAY).key).toBe(TODAY);
    expect(parsePeriod("day", "2026-03-01", TODAY)).toMatchObject({ prevKey: "2026-02-28", nextKey: "2026-03-02" });
    expect(parsePeriod("bogus", null, TODAY).view).toBe("day");
    expect(parsePeriod("total", "x", TODAY)).toMatchObject({ key: "total", compare: null });
  });
});

describe("Zeitraum-Daten (Berliner Monats-/Jahresgrenzen)", () => {
  let db: Db;
  let customerId: string;
  let inv: string;

  beforeEach(async () => {
    ({ db } = await createTestDb());
    customerId = (await createCustomer(db, "A")).id;
    const { device } = await createDevice(db);
    inv = (await createInverter(db, { deviceId: device.id, port: 18900, customerId })).id;
  });

  it("ordnet 00:30 Berlin am Monats-/Jahresersten dem neuen Monat/Jahr zu", async () => {
    await m(db, inv, "2026-09-30T21:30:00Z", 4000); // 23:30 Berlin 30.9.
    await m(db, inv, "2026-09-30T22:30:00Z", 100); // 00:30 Berlin 1.10. (CEST)
    await m(db, inv, "2026-10-31T23:30:00Z", 200); // 00:30 Berlin 1.11. (CET)
    await m(db, inv, "2025-12-31T23:30:00Z", 300); // 00:30 Berlin 1.1.2026
    await aggregateDays(db, "2025-12-01", "2026-11-30");
    const scope = (await resolveScope(db, customerId))!;
    const sep = await getPeriodData(db, scope, parsePeriod("month", "2026-09", TODAY), NOW);
    expect(sep.periodWh).toBe(4000);
    const oct = await getPeriodData(db, scope, parsePeriod("month", "2026-10", TODAY), NOW);
    expect(oct.bars[0]).toMatchObject({ key: "2026-10-01", wh: 100 });
    const y2025 = await getPeriodData(db, scope, parsePeriod("year", "2025", TODAY), NOW);
    expect(y2025.periodWh).toBe(0);
    const y2026 = await getPeriodData(db, scope, parsePeriod("year", "2026", TODAY), NOW);
    expect(y2026.bars.find((b) => b.key === "2026-01")!.wh).toBe(300);
    expect(y2026.bars.find((b) => b.key === "2026-09")!.wh).toBe(4000);
  });

  it("vergleicht mit dem Vormonat (absolut + %) und findet den besten Tag", async () => {
    await m(db, inv, "2026-08-10T10:00:00Z", 10000);
    await m(db, inv, "2026-08-11T10:00:00Z", 10000);
    await m(db, inv, "2026-09-05T10:00:00Z", 12000);
    await m(db, inv, "2026-09-06T10:00:00Z", 13000);
    await aggregateDays(db, "2026-08-01", "2026-09-30");
    const scope = (await resolveScope(db, customerId))!;
    const d = await getPeriodData(db, scope, parsePeriod("month", "2026-09", TODAY), NOW);
    expect(d.periodWh).toBe(25000);
    expect(d.compareWh).toBe(20000);
    expect(d.delta).toEqual({ wh: 5000, pct: 25 });
    expect(d.best).toEqual({ key: "2026-09-06", wh: 13000 });
    expect(d.bars[9].compareWh).toBe(10000); // 10. Tag des Vormonats
    // laufender Monat: Vergleich nur bis zum gleichen Tag des Vormonats (1.–8.9.)
    const cur = await getPeriodData(db, scope, parsePeriod("month", "2026-10", TODAY), NOW);
    expect(cur.compareToDate).toBe(true);
    expect(cur.compareWh).toBe(25000);
    await m(db, inv, "2026-09-20T10:00:00Z", 9000);
    await aggregateDays(db, "2026-09-20", "2026-09-20");
    const cur2 = await getPeriodData(db, scope, parsePeriod("month", "2026-10", TODAY), NOW);
    expect(cur2.compareWh).toBe(25000); // 20.9. liegt nach dem 8. → nicht im Vergleich
    // leerer Vormonat → keine Prozentangabe
    const aug = await getPeriodData(db, scope, parsePeriod("month", "2026-07", TODAY), NOW);
    expect(aug.delta).toEqual({ wh: 0, pct: null });
  });

  it("Gesamt-Ansicht: Balken je Jahr und Gesamtzähler", async () => {
    await m(db, inv, "2025-06-01T10:00:00Z", 30000);
    await m(db, inv, "2026-06-01T10:00:00Z", 20000);
    await aggregateDays(db, "2025-01-01", "2026-10-08");
    const scope = (await resolveScope(db, customerId))!;
    const d = await getPeriodData(db, scope, parsePeriod("total", null, TODAY), NOW);
    expect(d.bars.map((b) => [b.key, b.wh])).toEqual([["2025", 30000], ["2026", 20000]]);
    expect(d.kpis.totalKwh).toBe(1000);
    expect(d.kpis.co2Kg).toBeCloseTo(380);
  });

  it("Scope: fremde Anlage oder fremder Wechselrichter → null", async () => {
    const other = await createCustomer(db, "B");
    const [siteB] = await db.insert(schema.sites).values({ customerId: other.id, name: "B" }).returning();
    const { device } = await createDevice(db, "GW2");
    const invB = await createInverter(db, { deviceId: device.id, port: 18900, customerId: other.id });
    expect(await resolveScope(db, customerId, { siteId: siteB.id })).toBeNull();
    expect(await resolveScope(db, customerId, { inverterIds: [invB.id] })).toBeNull();
    expect(await resolveScope(db, customerId, { inverterIds: [inv, invB.id] })).toBeNull();
    expect((await resolveScope(db, customerId, { inverterIds: [inv] }))!.selected).toHaveLength(1);
  });
});

describe("Status Nachtruhe", () => {
  const inv = { connected: false, lastOkAt: new Date("2026-10-08T15:00:00Z") };
  it("nachts (18–8 Uhr Berlin) offline → Nachtruhe", () => {
    expect(isNightRest(2000, new Date("2026-10-08T16:00:00Z"))).toBe(true); // 18:00 Berlin
    expect(isNightRest(2000, new Date("2026-10-08T15:59:00Z"))).toBe(false); // 17:59
    expect(isNightRest(2000, new Date("2026-10-08T05:59:00Z"))).toBe(true); // 07:59
    expect(isNightRest(2000, new Date("2026-10-08T06:00:00Z"))).toBe(false); // 08:00
    expect(isNightRest(30, new Date("2026-10-08T10:00:00Z"))).toBe(true); // < 50 W
    const latest = { ts: new Date("2026-10-08T15:00:00Z"), mode: 3, acPowerW: 800 };
    expect(deriveStatus(inv, latest, new Date("2026-10-08T19:00:00Z"))).toBe("night");
    expect(deriveStatus(inv, latest, new Date("2026-10-08T15:30:00Z"))).toBe("offline");
    expect(worstStatus(["ongrid", "night", "offline"])).toBe("offline");
  });
});
