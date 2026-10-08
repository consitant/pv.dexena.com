import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { aggregateDays } from "@/lib/aggregate";
import { resolveScope } from "@/lib/dashboard";
import { buildCsv } from "@/lib/export";
import { parsePeriod } from "@/lib/period";
import { createCustomer, createDevice, createInverter, createTestDb } from "./helpers";

describe("CSV-Export (Scoping)", () => {
  it("exportiert nur Daten des eigenen Kunden", async () => {
    const { db } = await createTestDb();
    const a = await createCustomer(db, "A");
    const b = await createCustomer(db, "B");
    const [siteB] = await db.insert(schema.sites).values({ customerId: b.id, name: "Dach B" }).returning();
    const { device } = await createDevice(db);
    const invA = await createInverter(db, { deviceId: device.id, port: 18900, customerId: a.id, ref: "SC0000-AAA" });
    const invB = await createInverter(db, { deviceId: device.id, port: 18901, customerId: b.id, siteId: siteB.id, ref: "SC0000-BBB" });
    for (const inv of [invA, invB]) {
      await db.insert(schema.measurements).values({ inverterId: inv.id, ts: new Date("2026-09-10T10:00:00Z"), energyTodayWh: 7770, acPowerW: 1234.5 });
    }
    await aggregateDays(db, "2026-09-01", "2026-09-30");

    const scopeA = (await resolveScope(db, a.id))!;
    for (const p of [parsePeriod("day", "2026-09-10", "2026-10-08"), parsePeriod("month", "2026-09", "2026-10-08"), parsePeriod("total", null, "2026-10-08")]) {
      const { csv } = await buildCsv(db, scopeA, p);
      expect(csv).toContain("SC0000-AAA");
      expect(csv).not.toContain("SC0000-BBB");
      expect(csv.startsWith("﻿")).toBe(true);
    }
    const day = await buildCsv(db, scopeA, parsePeriod("day", "2026-09-10", "2026-10-08"));
    expect(day.csv).toContain("2026-09-10 12:00:00;SC0000-AAA;SC0000-AAA;;1234,5;7770");
    const month = await buildCsv(db, scopeA, parsePeriod("month", "2026-09", "2026-10-08"));
    expect(month.csv).toContain("2026-09-10;SC0000-AAA;SC0000-AAA;7,77;0,00;0,00;0,00;7,77");
    // Versuch, über Anlage oder WR-ID von B zu exportieren
    expect(await resolveScope(db, a.id, { siteId: siteB.id })).toBeNull();
    expect(await resolveScope(db, a.id, { inverterIds: [invB.id] })).toBeNull();
  });
});
