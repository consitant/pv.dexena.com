import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { aggregateDays } from "@/lib/aggregate";
import { getPeriodData, resolveScope } from "@/lib/dashboard";
import { roundEur, valueDay } from "@/lib/money";
import { parsePeriod } from "@/lib/period";
import { createCustomer, createDevice, createInverter, createTestDb } from "./helpers";

const NOW = new Date("2026-10-08T10:00:00Z");

describe("Ersparnis / Tarife", () => {
  it("rechnet Ersparnis und Einspeisung je Tag mit dem gültigen Tarif (Tarifwechsel im Monat)", async () => {
    const { db } = await createTestDb();
    const c = await createCustomer(db, "A");
    const [site] = await db.insert(schema.sites).values({ customerId: c.id, name: "Dach" }).returning();
    const { device } = await createDevice(db);
    const inv = await createInverter(db, { deviceId: device.id, port: 18900, customerId: c.id, siteId: site.id });
    await db.insert(schema.tariffs).values([
      { siteId: site.id, validFrom: "2026-01-01", priceCtPerKwh: 30, feedInCtPerKwh: 8, selfConsumptionPct: 30 },
      { siteId: site.id, validFrom: "2026-09-15", priceCtPerKwh: 40, feedInCtPerKwh: 10, selfConsumptionPct: 50 },
    ]);
    for (const [ts, wh] of [["2026-09-10T10:00:00Z", 10000], ["2026-09-20T10:00:00Z", 10000]] as const) {
      await db.insert(schema.measurements).values({ inverterId: inv.id, ts: new Date(ts), energyTodayWh: wh });
    }
    await aggregateDays(db, "2026-09-01", "2026-09-30");
    const scope = (await resolveScope(db, c.id, { siteId: site.id }))!;
    const d = await getPeriodData(db, scope, parsePeriod("month", "2026-09", "2026-10-08"), NOW);
    // 10.9.: 10 kWh × 30 % × 0,30 € = 0,90 €; 10 kWh × 70 % × 0,08 € = 0,56 €
    // 20.9.: 10 kWh × 50 % × 0,40 € = 2,00 €; 10 kWh × 50 % × 0,10 € = 0,50 €
    expect(roundEur(d.periodMoney.selfEur)).toBe(2.9);
    expect(roundEur(d.periodMoney.feedEur)).toBe(1.06);
    expect(d.periodMoney.unpricedWh).toBe(0);
    expect(roundEur(d.bars[9].selfEur)).toBe(0.9);
    expect(roundEur(d.bars[19].feedEur)).toBe(0.5);
    expect(d.kpis.hasTariff).toBe(true);
  });

  it("ohne Tarif: nichts bewertet, Hinweis-Flag statt 0 €", async () => {
    const { db } = await createTestDb();
    const c = await createCustomer(db, "A");
    const { device } = await createDevice(db);
    const inv = await createInverter(db, { deviceId: device.id, port: 18900, customerId: c.id });
    await db.insert(schema.measurements).values({ inverterId: inv.id, ts: new Date("2026-09-10T10:00:00Z"), energyTodayWh: 5000 });
    await aggregateDays(db, "2026-09-01", "2026-09-30");
    const d = await getPeriodData(db, (await resolveScope(db, c.id))!, parsePeriod("month", "2026-09", "2026-10-08"), NOW);
    expect(d.kpis.hasTariff).toBe(false);
    expect(d.periodMoney.unpricedWh).toBe(5000);
  });

  it("rundet erst am Ende kaufmännisch auf Cent", () => {
    const t = { siteId: "x", validFrom: "2026-01-01", priceCtPerKwh: 33.33, feedInCtPerKwh: 8.11, selfConsumptionPct: 30 };
    const a = valueDay(1234, t);
    expect(a.selfEur).toBeCloseTo(0.12338, 4);
    expect(roundEur(a.selfEur)).toBe(0.12);
    expect(roundEur(0.125)).toBe(0.13);
    expect(roundEur(1.005)).toBe(1.01);
  });
});
