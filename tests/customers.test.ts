import { describe, expect, it } from "vitest";
import * as admin from "@/lib/admin";
import { changePassword } from "@/lib/account";
import { searchCustomers } from "@/lib/customer-search";
import { loadSessionUser, verifyLogin } from "@/lib/login";
import { createDevice, createInverter, createTestDb } from "./helpers";

const NOW = new Date("2026-10-08T10:00:00Z");

describe("Kundenverwaltung", () => {
  it("vergibt Kundennummern automatisch, Name aus Firma bzw. Vor-/Nachname", async () => {
    const { db } = await createTestDb();
    const a = await admin.createCustomer(db, { kind: "private", firstName: "Erika", lastName: "Muster", active: "on" });
    const b = await admin.createCustomer(db, { kind: "business", companyName: "Beispiel GmbH", tags: "Gewerbe, Wartung", active: "on" });
    expect(a).toMatchObject({ customerNo: "K-00001", name: "Erika Muster", active: true });
    expect(b).toMatchObject({ customerNo: "K-00002", name: "Beispiel GmbH", tags: ["Gewerbe", "Wartung"] });
    await expect(admin.createCustomer(db, { kind: "business" })).rejects.toThrow();
    await expect(admin.updateCustomer(db, b.id, { kind: "business", companyName: "X", customerNo: "K-00001" })).rejects.toThrow(/vergeben/);
    await expect(admin.deleteCustomer(db, a.id, "falsch")).rejects.toThrow(/Bestätigung/);
    await admin.deleteCustomer(db, a.id, "Erika Muster");
  });

  it("deaktivierter Kunde sperrt den Login aller seiner Benutzer (auch bestehende Sessions)", async () => {
    const { db } = await createTestDb();
    const c = await admin.createCustomer(db, { kind: "private", lastName: "Muster", active: "on" });
    const u1 = await admin.createUser(db, { email: "a@example.com", role: "customer", customerId: c.id, password: "passwort-123" });
    await admin.createUser(db, { email: "b@example.com", role: "customer", customerId: c.id, password: "passwort-456" });
    const login = (email: string, password: string) => verifyLogin(db, { email, password, ip: "203.0.113.5" }, NOW);
    expect(await login("a@example.com", "passwort-123")).not.toBeNull();
    await admin.setCustomerActive(db, c.id, false);
    expect(await login("a@example.com", "passwort-123")).toBeNull();
    expect(await login("b@example.com", "passwort-456")).toBeNull();
    expect(await loadSessionUser(db, u1.user.id)).toBeNull();
    await admin.setCustomerActive(db, c.id, true);
    expect(await loadSessionUser(db, u1.user.id)).not.toBeNull();
    await admin.setUserDisabled(db, u1.user.id, "other-admin", true);
    expect(await login("a@example.com", "passwort-123")).toBeNull();
  });

  it("Suche, Filter, Sortierung und Pagination", async () => {
    const { db } = await createTestDb();
    const { device } = await createDevice(db);
    const a = await admin.createCustomer(db, { kind: "private", firstName: "Anna", lastName: "Alt", city: "Gießen", email: "anna@example.com", active: "on" });
    const b = await admin.createCustomer(db, { kind: "business", companyName: "Zebra GmbH", city: "Wetzlar" });
    await createInverter(db, { deviceId: device.id, port: 18900, customerId: a.id });
    expect((await searchCustomers(db, { q: "gieß" }, NOW)).rows.map((r) => r.id)).toEqual([a.id]);
    expect((await searchCustomers(db, { q: "K-00002" }, NOW)).rows.map((r) => r.id)).toEqual([b.id]);
    expect((await searchCustomers(db, { status: "inactive" }, NOW)).rows.map((r) => r.id)).toEqual([b.id]);
    // A hat einen WR ohne Daten → „ohne Daten > 24 h“ und Störung (offline am Tag)
    expect((await searchCustomers(db, { health: "stale" }, NOW)).rows.map((r) => r.id)).toEqual([a.id]);
    expect((await searchCustomers(db, { health: "fault" }, NOW)).rows.map((r) => r.id)).toEqual([a.id]);
    expect((await searchCustomers(db, { sort: "name", dir: "desc" }, NOW)).rows.map((r) => r.name)).toEqual(["Zebra GmbH", "Anna Alt"]);
    const res = await searchCustomers(db, { page: 99, sort: "bogus" as never }, NOW);
    expect(res.query).toMatchObject({ page: 1, sort: "customerNo" });
  });

  it("Passwort-Reset nur durch Admin oder eigenes Konto", async () => {
    const { db } = await createTestDb();
    const c = await admin.createCustomer(db, { kind: "private", lastName: "Muster", active: "on" });
    const adm = (await admin.createUser(db, { email: "admin@example.com", role: "admin", password: "admin-passwort" })).user;
    const u1 = (await admin.createUser(db, { email: "a@example.com", role: "customer", customerId: c.id, password: "passwort-123" })).user;
    const u2 = (await admin.createUser(db, { email: "b@example.com", role: "customer", customerId: c.id, password: "passwort-456" })).user;
    const s1 = (await loadSessionUser(db, u1.id))!;
    const sAdmin = (await loadSessionUser(db, adm.id))!;
    await expect(changePassword(db, s1, u2.id, { newPassword: "neues-passwort-1" })).rejects.toThrow(/Berechtigung/);
    await expect(changePassword(db, s1, u1.id, { currentPassword: "falsch", newPassword: "neues-passwort-1" })).rejects.toThrow(/falsch/);
    await changePassword(db, s1, u1.id, { currentPassword: "passwort-123", newPassword: "neues-passwort-1" });
    expect(await verifyLogin(db, { email: "a@example.com", password: "neues-passwort-1", ip: "203.0.113.9" }, NOW)).not.toBeNull();
    const { generated } = await changePassword(db, sAdmin, u2.id, {});
    expect(generated).toHaveLength(16);
    expect(await verifyLogin(db, { email: "b@example.com", password: generated!, ip: "203.0.113.9" }, NOW)).not.toBeNull();
  }, 60_000);
});
