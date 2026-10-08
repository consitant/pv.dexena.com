import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import * as admin from "@/lib/admin";
import { verifyLogin, LOGIN_LIMIT_PER_EMAIL } from "@/lib/login";
import { verifyPassword } from "@/lib/passwords";
import { sha256Hex } from "@/lib/tokens";
import { createCustomer, createTestDb } from "./helpers";

describe("Admin-Logik", () => {
  it("Device-Token: smx_-Präfix, nur Hash gespeichert, Rotation invalidiert altes Token", async () => {
    const { db } = await createTestDb();
    const { device, token } = await admin.createDevice(db, { name: "GW" });
    expect(token).toMatch(/^smx_[A-Za-z0-9_-]{43}$/);
    expect(device.tokenHash).toBe(sha256Hex(token));
    expect(JSON.stringify(device)).not.toContain(token);
    expect(device.pollIntervalS).toBe(300);
    expect(device.offlineAfterMin).toBe(15);
    const newToken = await admin.rotateDeviceToken(db, device.id);
    const [d] = await db.select().from(schema.devices).where(eq(schema.devices.id, device.id));
    expect(d.tokenHash).toBe(sha256Hex(newToken));
    expect(d.tokenHash).not.toBe(sha256Hex(token));
  });

  it("schlägt den nächsten freien Port vor und verhindert Doppelbelegung", async () => {
    const { db } = await createTestDb();
    const { device } = await admin.createDevice(db, { name: "GW" });
    expect(await admin.suggestNextPort(db, device.id)).toBe(18900);
    await admin.createInverter(db, { ref: "SC0000-1", deviceId: device.id, port: "18900", enabled: "on" });
    await admin.createInverter(db, { ref: "SC0000-2", deviceId: device.id, port: "18902", enabled: "on" });
    expect(await admin.suggestNextPort(db, device.id)).toBe(18901);
    await expect(admin.createInverter(db, { ref: "SC0000-3", deviceId: device.id, port: "18900" })).rejects.toThrow(/belegt/);
    await expect(admin.createInverter(db, { ref: "SC0000-1", deviceId: device.id, port: "18903" })).rejects.toThrow(/vergeben/);
    await expect(admin.createInverter(db, { ref: "SC0000-4", deviceId: device.id, port: "19000" })).rejects.toThrow();
    // "**" aus der Modul-ID wird entfernt
    const inv = await admin.createInverter(db, { ref: "SC**0000-5", deviceId: device.id, port: "18903" });
    expect(inv.ref).toBe("SC0000-5");
    expect(inv.enabled).toBe(false); // Checkbox nicht gesetzt
  });

  it("leitet den Kunden aus der Anlage ab und verhindert falsche Kombinationen beim Umhängen", async () => {
    const { db } = await createTestDb();
    const a = await createCustomer(db, "A");
    const b = await createCustomer(db, "B");
    const siteA = await admin.createSite(db, a.id, { name: "Dach A" });
    const { device } = await admin.createDevice(db, { name: "GW" });
    const inv = await admin.createInverter(db, { ref: "SC0000-9", deviceId: device.id, port: "18900", siteId: siteA.id });
    expect(inv.customerId).toBe(a.id);
    await expect(
      admin.updateInverter(db, inv.id, { ref: inv.ref, deviceId: device.id, port: "18900", customerId: b.id, siteId: siteA.id }),
    ).rejects.toThrow(/gehört nicht/);
    const moved = await admin.updateInverter(db, inv.id, { ref: inv.ref, deviceId: device.id, port: "18900", customerId: b.id });
    expect(moved).toMatchObject({ customerId: b.id, siteId: null });
    const unassigned = await admin.updateInverter(db, inv.id, { ref: inv.ref, deviceId: device.id, port: "18900" });
    expect(unassigned).toMatchObject({ customerId: null, siteId: null });
  });

  it("legt Benutzer mit generiertem Passwort an (bcrypt cost 12) und erzwingt Kundenzuordnung", async () => {
    const { db } = await createTestDb();
    const c = await createCustomer(db, "A");
    await expect(admin.createUser(db, { email: "x@example.com", role: "customer" })).rejects.toThrow();
    const { user, generatedPassword } = await admin.createUser(db, { email: " Kunde@Example.com ", role: "customer", customerId: c.id });
    expect(user.email).toBe("kunde@example.com");
    expect(generatedPassword).toHaveLength(16);
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
    expect(u.passwordHash.startsWith("$2b$12$") || u.passwordHash.startsWith("$2a$12$")).toBe(true);
    expect(await verifyPassword(generatedPassword!, u.passwordHash)).toBe(true);
    await expect(admin.createUser(db, { email: "kunde@example.com", role: "admin" })).rejects.toThrow(/vergeben/);
  });
});

describe("Login", () => {
  it("prüft Passwort, normalisiert E-Mail und limitiert Fehlversuche pro E-Mail", async () => {
    const { db } = await createTestDb();
    const { user } = await admin.createUser(db, { email: "admin@example.com", role: "admin", password: "richtig-richtig" });
    const now = new Date("2026-10-08T12:00:00Z");
    const ok = await verifyLogin(db, { email: "ADMIN@example.com", password: "richtig-richtig", ip: "203.0.113.7" }, now);
    expect(ok).toMatchObject({ id: user.id, role: "admin", customerId: null });
    expect(await verifyLogin(db, { email: "admin@example.com", password: "falsch", ip: "203.0.113.7" }, now)).toBeNull();
    expect(await verifyLogin(db, { email: "niemand@example.com", password: "x", ip: "203.0.113.7" }, now)).toBeNull();
    for (let i = 0; i < LOGIN_LIMIT_PER_EMAIL; i++) {
      await verifyLogin(db, { email: "admin@example.com", password: "falsch", ip: `203.0.113.${20 + i}` }, now);
    }
    // gesperrt – auch mit richtigem Passwort
    expect(await verifyLogin(db, { email: "admin@example.com", password: "richtig-richtig", ip: "203.0.113.99" }, now)).toBeNull();
    // nach Ablauf des Fensters wieder möglich
    const later = new Date(now.getTime() + 16 * 60_000);
    expect(await verifyLogin(db, { email: "admin@example.com", password: "richtig-richtig", ip: "203.0.113.99" }, later)).not.toBeNull();
  }, 60_000);
});
