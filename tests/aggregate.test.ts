import { beforeEach, describe, expect, it } from "vitest";
import { asc } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Db } from "@/db/types";
import { aggregateDays, aggregateRecent } from "@/lib/aggregate";
import { berlinDay } from "@/lib/time";
import { createDevice, createInverter, createTestDb } from "./helpers";

async function insertM(db: Db, inverterId: string, ts: string, energyTodayWh: number, energyTotalKwh = 1000) {
  await db.insert(schema.measurements).values({ inverterId, ts: new Date(ts), energyTodayWh, energyTotalKwh, acPowerW: 100, maxPowerTodayW: 500 });
}

describe("Aggregation (Berliner Kalendertag)", () => {
  let db: Db;
  let inv: string;

  beforeEach(async () => {
    ({ db } = await createTestDb());
    const { device } = await createDevice(db);
    inv = (await createInverter(db, { deviceId: device.id, port: 18900 })).id;
  });

  const daily = () => db.select().from(schema.dailyYield).orderBy(asc(schema.dailyYield.day));

  it("JS-Helfer berlinDay kennt Sommer-/Winterzeit", () => {
    expect(berlinDay(new Date("2026-03-28T23:30:00Z"))).toBe("2026-03-29"); // CET +1
    expect(berlinDay(new Date("2026-07-01T21:59:00Z"))).toBe("2026-07-01"); // CEST +2
    expect(berlinDay(new Date("2026-07-01T22:00:00Z"))).toBe("2026-07-02");
    expect(berlinDay(new Date("2026-10-25T22:30:00Z"))).toBe("2026-10-25"); // nach Umstellung CET
    expect(berlinDay(new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-26");
  });

  it("ordnet Messwerte um die Mitternachtsgrenze (Sommerzeit, UTC+2) dem richtigen Tag zu", async () => {
    await insertM(db, inv, "2026-07-01T21:50:00Z", 30000); // 23:50 Berlin am 1.7.
    await insertM(db, inv, "2026-07-01T22:10:00Z", 0); // 00:10 Berlin am 2.7. (Reset)
    await insertM(db, inv, "2026-07-02T10:00:00Z", 12000);
    await aggregateDays(db, "2026-07-01", "2026-07-02");
    expect((await daily()).map((d) => [d.day, d.energyWh])).toEqual([
      ["2026-07-01", 30000],
      ["2026-07-02", 12000],
    ]);
  });

  it("ordnet Messwerte um die Mitternachtsgrenze (Winterzeit, UTC+1) dem richtigen Tag zu", async () => {
    await insertM(db, inv, "2026-12-01T22:50:00Z", 8000); // 23:50 Berlin am 1.12.
    await insertM(db, inv, "2026-12-01T23:10:00Z", 0); // 00:10 Berlin am 2.12.
    await insertM(db, inv, "2026-12-02T11:00:00Z", 4000);
    await aggregateDays(db, "2026-12-01", "2026-12-02");
    expect((await daily()).map((d) => [d.day, d.energyWh])).toEqual([
      ["2026-12-01", 8000],
      ["2026-12-02", 4000],
    ]);
  });

  it("behandelt die Umstellungstage korrekt (29.03. / 25.10.2026)", async () => {
    await insertM(db, inv, "2026-03-29T00:30:00Z", 10); // 01:30 CET am 29.3.
    await insertM(db, inv, "2026-03-28T22:59:00Z", 999); // 23:59 CET am 28.3.
    await insertM(db, inv, "2026-10-25T22:30:00Z", 50); // 23:30 CET am 25.10.
    await insertM(db, inv, "2026-10-25T23:30:00Z", 7); // 00:30 CET am 26.10.
    await aggregateDays(db, "2026-03-28", "2026-03-29");
    await aggregateDays(db, "2026-10-25", "2026-10-26");
    expect((await daily()).map((d) => [d.day, d.energyWh])).toEqual([
      ["2026-03-28", 999],
      ["2026-03-29", 10],
      ["2026-10-25", 50],
      ["2026-10-26", 7],
    ]);
  });

  it("verwendet max(energy_today_wh), nicht Differenz des Gesamtzählers", async () => {
    // Gesamtzähler steigt nur um 1 kWh (Auflösung), Tageszähler sagt 1870 Wh
    await insertM(db, inv, "2026-06-10T05:00:00Z", 0, 3000);
    await insertM(db, inv, "2026-06-10T10:00:00Z", 1870, 3001);
    // fallender Wert (z. B. Störung) darf das Maximum nicht verringern
    await insertM(db, inv, "2026-06-10T12:00:00Z", 1200, 3001);
    await aggregateDays(db, "2026-06-10", "2026-06-10");
    const [d] = await daily();
    expect(d.energyWh).toBe(1870);
    expect(d.maxPowerW).toBe(500);
  });

  it("ist idempotent und bildet Monatssummen aus Tagen", async () => {
    await insertM(db, inv, "2026-06-01T10:00:00Z", 1000);
    await insertM(db, inv, "2026-06-02T10:00:00Z", 2000);
    await insertM(db, inv, "2026-06-30T21:30:00Z", 3000); // 23:30 Berlin am 30.6.
    await insertM(db, inv, "2026-06-30T22:30:00Z", 500); // 00:30 Berlin am 1.7.
    await aggregateDays(db, "2026-06-01", "2026-07-01");
    await aggregateDays(db, "2026-06-01", "2026-07-01");
    const months = await db.select().from(schema.monthlyYield).orderBy(asc(schema.monthlyYield.month));
    expect(months.map((m) => [m.month, m.energyWh])).toEqual([
      ["2026-06-01", 6000],
      ["2026-07-01", 500],
    ]);
    expect(await daily()).toHaveLength(4);
  });

  it("Cron-Variante aggregiert die letzten 2 Berliner Tage", async () => {
    await insertM(db, inv, "2026-10-07T12:00:00Z", 5000);
    await insertM(db, inv, "2026-10-08T12:00:00Z", 6000);
    await insertM(db, inv, "2026-10-05T12:00:00Z", 9999); // außerhalb
    const r = await aggregateRecent(db, new Date("2026-10-08T23:30:00Z")); // 01:30 Berlin am 9.10.
    expect(r).toMatchObject({ fromDay: "2026-10-08", toDay: "2026-10-09" });
    expect((await daily()).map((d) => d.day)).toEqual(["2026-10-08"]);
  });
});
