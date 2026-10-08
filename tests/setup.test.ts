import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import * as admin from "@/lib/admin";
import { loadSessionUser } from "@/lib/login";
import { getSetupStatus, nextFreePort, registerInverterForSite, registerSchema } from "@/lib/setup";
import { isPrivateIpv4, serverFields, staFields } from "@/lib/stick-forms";
import { parseStickRef } from "@/lib/stick-ref";
import { createCustomer, createDevice, createInverter, createTestDb } from "./helpers";

describe("Stick-Kennung", () => {
  it("parst WLAN-Name, Etikett und Nummer", () => {
    expect(parseStickRef("10SMT_2313-000000001")).toBe("SC2313-000000001");
    expect(parseStickRef("SC**2313-000000002")).toBe("SC2313-000000002");
    expect(parseStickRef(" sc2313-000000003 ")).toBe("SC2313-000000003");
    expect(parseStickRef("2313-000000004")).toBe("SC2313-000000004");
    expect(parseStickRef("FRITZ!Box 7490")).toBeNull();
    expect(parseStickRef("SC2313")).toBeNull();
    expect(parseStickRef("'; DROP TABLE--")).toBeNull();
  });
});

describe("Port-Vergabe", () => {
  it("nimmt den nächsten freien Port, null wenn voll", () => {
    expect(nextFreePort([])).toBe(18900);
    expect(nextFreePort([18900, 18901, 18903])).toBe(18902);
    expect(nextFreePort(Array.from({ length: 100 }, (_, i) => 18900 + i))).toBeNull();
  });

  it("registriert am Standard-Gateway mit freiem Port; Kollision und voller Bereich", async () => {
    const { db } = await createTestDb();
    const c = await createCustomer(db, "A");
    const [site] = await db.insert(schema.sites).values({ customerId: c.id, name: "Dach" }).returning();
    const gw = await createDevice(db, "Gateway");
    await createInverter(db, { deviceId: gw.device.id, port: 18900 });
    const u = await admin.createUser(db, { email: "k@example.com", role: "customer", customerId: c.id, password: "passwort-123" });
    const me = (await loadSessionUser(db, u.user.id))!;

    const r = await registerInverterForSite(db, me, { siteId: site.id, ref: "10SMT_2313-000000010" });
    expect(r).toMatchObject({ ref: "SC2313-000000010", port: 18901, created: true });
    const [inv] = await db.select().from(schema.inverters).where(eq(schema.inverters.id, r.inverterId));
    expect(inv).toMatchObject({ deviceId: gw.device.id, siteId: site.id, customerId: c.id, setupPending: true, enabled: true });
    // erneuter Aufruf mit demselben Stick → gleicher Wechselrichter, kein neuer Port
    expect(await registerInverterForSite(db, me, { siteId: site.id, ref: "SC2313-000000010" })).toMatchObject({ port: 18901, created: false });

    // voller Portbereich
    for (let p = 18902; p <= 18999; p++) await createInverter(db, { deviceId: gw.device.id, port: p });
    await expect(registerInverterForSite(db, me, { siteId: site.id, ref: "2313-000000011" })).rejects.toThrow(/keine Ports/);
  });
});

describe("Scoping und Datenschutz", () => {
  it("Kunde registriert nur an eigenen Anlagen; fremde Sticks werden nicht übernommen", async () => {
    const { db } = await createTestDb();
    await createDevice(db, "Gateway");
    const a = await createCustomer(db, "A");
    const b = await createCustomer(db, "B");
    const [siteA] = await db.insert(schema.sites).values({ customerId: a.id, name: "A" }).returning();
    const [siteB] = await db.insert(schema.sites).values({ customerId: b.id, name: "B" }).returning();
    const ua = (await admin.createUser(db, { email: "a@example.com", role: "customer", customerId: a.id, password: "passwort-123" })).user;
    const ub = (await admin.createUser(db, { email: "b@example.com", role: "customer", customerId: b.id, password: "passwort-123" })).user;
    const sa = (await loadSessionUser(db, ua.id))!;
    const sb = (await loadSessionUser(db, ub.id))!;
    await expect(registerInverterForSite(db, sa, { siteId: siteB.id, ref: "2313-000000020" })).rejects.toThrow(/nicht gefunden/);
    const r = await registerInverterForSite(db, sb, { siteId: siteB.id, ref: "2313-000000021" });
    // A versucht, den Stick von B an sich zu ziehen
    await expect(registerInverterForSite(db, sa, { siteId: siteA.id, ref: "2313-000000021" })).rejects.toThrow(/bereits registriert/);
    expect(await getSetupStatus(db, sa, r.inverterId)).toBeNull();
    expect(await getSetupStatus(db, sb, r.inverterId)).toMatchObject({ connected: false });
  });

  it("Registrierung nimmt kein WLAN-Passwort oder andere Zusatzfelder an", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    expect(registerSchema.safeParse({ siteId: id, ref: "2313-000000030" }).success).toBe(true);
    expect(registerSchema.safeParse({ siteId: id, ref: "2313-000000030", wifiPassword: "geheim123" }).success).toBe(false);
    expect(registerSchema.safeParse({ siteId: id, ref: "2313-000000030", ssid: "Heimnetz" }).success).toBe(false);
    const { db } = await createTestDb();
    const fake = { id, email: "x@example.com", name: null, role: "admin" as const, customerId: null };
    await expect(registerInverterForSite(db, fake, { siteId: id, ref: "x", sta_setting_wpakey: "geheim123" })).rejects.toThrow();
  });
});

describe("Stick-Formulare", () => {
  it("baut Formularfelder für WLAN und Server", () => {
    const sta = Object.fromEntries(staFields("Heimnetz", "pass-1234").map((f) => [f.name, f.value]));
    expect(sta).toMatchObject({ sta_setting_auth: "WPA2PSK", sta_setting_encry: "AES", wan_setting_dhcp: "DHCP", sta_setting_ssid: "Heimnetz" });
    const net = Object.fromEntries(serverFields(18905).map((f) => [f.name, f.value]));
    expect(net).toEqual({
      net_setting_pro_sel: "TCPCLIENT", net_setting_pro: "TCP", net_setting_cs: "CLIENT",
      net_setting_port: "18905", net_setting_ip: "solarmax.dexena.com", net_setting_to: "300",
    });
    expect(isPrivateIpv4("10.10.100.254")).toBe(true);
    expect(isPrivateIpv4("192.168.1.20")).toBe(true);
    expect(isPrivateIpv4("8.8.8.8")).toBe(false);
    expect(isPrivateIpv4("192.168.1.300")).toBe(false);
  });
});
