/** Admin-Geschäftslogik (DB injizierbar). Rollenprüfung erfolgt in den Server Actions. */
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { exec, type Db } from "@/db/types";
import {
  auditLog,
  customerNotes,
  customers,
  devices,
  inverters,
  PORT_MAX,
  PORT_MIN,
  sites,
  users,
} from "@/db/schema";
import { generateDeviceToken, generatePassword } from "./tokens";
import { hashPassword, MIN_PASSWORD_LENGTH } from "./passwords";

export class AdminError extends Error {}

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optText = (max = 200) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional()).transform((v) => v ?? null);
const optUuid = z.preprocess(emptyToNull, z.uuid().nullable().optional()).transform((v) => v ?? null);
const optInt = (min: number, max: number) =>
  z.preprocess(emptyToNull, z.coerce.number().int().min(min).max(max).nullable().optional()).transform((v) => v ?? null);

// ---------- Audit ----------
export async function audit(
  db: Db,
  userId: string | null,
  action: string,
  target?: string,
  details?: unknown,
  customerId?: string | null,
) {
  await db
    .insert(auditLog)
    .values({ userId, action, target: target ?? null, details: details ?? null, customerId: customerId ?? null });
}

// ---------- Kunden ----------
const optDate = z
  .preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum").nullable().optional())
  .transform((v) => v ?? null);
const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

export const customerSchema = z
  .object({
    customerNo: z
      .preprocess(emptyToNull, z.string().trim().regex(/^[A-Za-z0-9-]{1,20}$/, "Kundennummer: A–Z, 0–9, -").nullable().optional())
      .transform((v) => v ?? null),
    kind: z.enum(["private", "business"]).default("private"),
    salutation: optText(30),
    firstName: optText(100),
    lastName: optText(100),
    companyName: optText(200),
    contactPerson: optText(200),
    email: z.preprocess(emptyToNull, z.email("Ungültige E-Mail").nullable().optional()).transform((v) => v ?? null),
    phone: optText(50),
    address: optText(500),
    city: optText(100),
    notes: optText(5000),
    tags: z
      .preprocess((v) => (typeof v === "string" ? v.split(",") : (v ?? [])), z.array(z.string()))
      .transform((a) => [...new Set(a.map((t) => t.trim()).filter(Boolean).map((t) => t.slice(0, 40)))].slice(0, 20)),
    active: checkbox,
    contractStart: optDate,
    maintenanceContract: checkbox,
    nextMaintenanceOn: optDate,
  })
  .superRefine((c, ctx) => {
    if (c.kind === "business" && !c.companyName) ctx.addIssue({ code: "custom", message: "Firmenname fehlt", path: ["companyName"] });
    if (c.kind === "private" && !c.lastName) ctx.addIssue({ code: "custom", message: "Nachname fehlt", path: ["lastName"] });
  })
  .transform((c) => ({
    ...c,
    name: c.kind === "business" ? c.companyName! : [c.firstName, c.lastName].filter(Boolean).join(" "),
  }));

function customerValues(data: z.infer<typeof customerSchema>) {
  const { customerNo, ...rest } = data;
  return customerNo ? { ...rest, customerNo } : rest;
}

async function assertCustomerNoFree(db: Db, customerNo: string | null, excludeId?: string) {
  if (!customerNo) return;
  const clash = await db
    .select({ id: customers.id })
    .from(customers)
    .where(excludeId ? and(eq(customers.customerNo, customerNo), ne(customers.id, excludeId)) : eq(customers.customerNo, customerNo))
    .limit(1);
  if (clash.length) throw new AdminError("Kundennummer ist bereits vergeben");
}

export async function createCustomer(db: Db, input: unknown) {
  const data = customerSchema.parse(input);
  await assertCustomerNoFree(db, data.customerNo);
  const [c] = await db.insert(customers).values(customerValues(data)).returning();
  return c;
}

export async function updateCustomer(db: Db, id: string, input: unknown) {
  const data = customerSchema.parse(input);
  await assertCustomerNoFree(db, data.customerNo, id);
  const [c] = await db.update(customers).set(customerValues(data)).where(eq(customers.id, id)).returning();
  if (!c) throw new AdminError("Kunde nicht gefunden");
  return c;
}

/** Aktiv/inaktiv – ein inaktiver Kunde sperrt den Login aller seiner Benutzer (siehe login.ts). */
export async function setCustomerActive(db: Db, id: string, active: boolean) {
  await db.update(customers).set({ active }).where(eq(customers.id, id));
}

/** Löschen nur mit exakt eingetipptem Namen als Bestätigung. */
export async function deleteCustomer(db: Db, id: string, confirmName?: string) {
  const [c] = await db.select({ name: customers.name }).from(customers).where(eq(customers.id, id)).limit(1);
  if (!c) throw new AdminError("Kunde nicht gefunden");
  if (confirmName !== undefined && confirmName.trim() !== c.name) {
    throw new AdminError("Zur Bestätigung den Kundennamen exakt eingeben");
  }
  // Inverter bleiben erhalten (customer_id/site_id → NULL), Benutzer und Anlagen werden gelöscht.
  await db.delete(customers).where(eq(customers.id, id));
}

export async function addCustomerNote(db: Db, customerId: string, authorId: string, body: string) {
  const text = body.trim();
  if (!text) throw new AdminError("Notiz ist leer");
  if (text.length > 5000) throw new AdminError("Notiz zu lang (max. 5000 Zeichen)");
  await db.insert(customerNotes).values({ customerId, authorId, body: text });
}

export async function listCustomerHistory(db: Db, customerId: string, limit = 50) {
  const [notes, events] = await Promise.all([
    db
      .select({ n: customerNotes, email: users.email })
      .from(customerNotes)
      .leftJoin(users, eq(users.id, customerNotes.authorId))
      .where(eq(customerNotes.customerId, customerId))
      .orderBy(desc(customerNotes.createdAt))
      .limit(limit),
    db
      .select({ a: auditLog, email: users.email })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(eq(auditLog.customerId, customerId))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit),
  ]);
  return { notes, events };
}

// ---------- Anlagen ----------
export const siteSchema = z.object({
  name: z.string().trim().min(1, "Name fehlt").max(200),
  address: optText(500),
  timezone: z.string().trim().min(1).max(64).default("Europe/Berlin"),
  peakPowerKwp: z
    .preprocess(
      (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim().replace(",", ".")) : v),
      z.coerce.number().min(0).max(100_000).nullable().optional(),
    )
    .transform((v) => v ?? null),
  commissionedOn: z
    .preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum").nullable().optional())
    .transform((v) => v ?? null),
});

export async function createSite(db: Db, customerId: string, input: unknown) {
  const data = siteSchema.parse(input);
  const [s] = await db.insert(sites).values({ ...data, customerId }).returning();
  return s;
}

export async function updateSite(db: Db, id: string, input: unknown) {
  const data = siteSchema.parse(input);
  const [s] = await db.update(sites).set(data).where(eq(sites.id, id)).returning();
  if (!s) throw new AdminError("Anlage nicht gefunden");
  return s;
}

export async function deleteSite(db: Db, id: string) {
  await db.delete(sites).where(eq(sites.id, id));
}

// ---------- Benutzer ----------
export const userSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email("Ungültige E-Mail")),
    name: optText(200),
    role: z.enum(["admin", "customer"]),
    customerId: optUuid,
    password: z.preprocess(emptyToNull, z.string().min(MIN_PASSWORD_LENGTH, `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`).max(200).nullable().optional()),
  })
  .refine((u) => u.role === "admin" || !!u.customerId, { message: "Kunden-Benutzer brauchen einen Kunden", path: ["customerId"] });

/** Legt einen Benutzer an. Ohne Passwort wird eines generiert und EINMALIG zurückgegeben. */
export async function createUser(db: Db, input: unknown) {
  const data = userSchema.parse(input);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).limit(1);
  if (existing.length) throw new AdminError("E-Mail ist bereits vergeben");
  const generated = data.password ? null : generatePassword(16);
  const passwordHash = await hashPassword(data.password ?? generated!);
  const [u] = await db
    .insert(users)
    .values({
      email: data.email,
      name: data.name,
      role: data.role,
      customerId: data.role === "admin" ? null : data.customerId,
      passwordHash,
    })
    .returning({ id: users.id, email: users.email });
  return { user: u, generatedPassword: generated };
}

export const userUpdateSchema = z
  .object({
    name: optText(200),
    role: z.enum(["admin", "customer"]),
    customerId: optUuid,
  })
  .refine((u) => u.role === "admin" || !!u.customerId, { message: "Kunden-Benutzer brauchen einen Kunden", path: ["customerId"] });

export async function updateUser(db: Db, id: string, actingUserId: string, input: unknown) {
  const data = userUpdateSchema.parse(input);
  if (id === actingUserId && data.role !== "admin") throw new AdminError("Eigene Admin-Rolle kann nicht entfernt werden");
  await db
    .update(users)
    .set({ name: data.name, role: data.role, customerId: data.role === "admin" ? null : data.customerId })
    .where(eq(users.id, id));
}

export async function resetUserPassword(db: Db, id: string, password?: string | null) {
  if (password && password.length < MIN_PASSWORD_LENGTH) throw new AdminError(`Passwort: mindestens ${MIN_PASSWORD_LENGTH} Zeichen`);
  const generated = password ? null : generatePassword(16);
  const res = await db
    .update(users)
    .set({ passwordHash: await hashPassword(password ?? generated!) })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (!res.length) throw new AdminError("Benutzer nicht gefunden");
  return generated;
}

export async function setUserDisabled(db: Db, id: string, actingUserId: string, disabled: boolean) {
  if (id === actingUserId && disabled) throw new AdminError("Eigenen Benutzer nicht sperrbar");
  await db.update(users).set({ disabled }).where(eq(users.id, id));
}

export async function deleteUser(db: Db, id: string, actingUserId: string) {
  if (id === actingUserId) throw new AdminError("Eigenen Benutzer nicht löschbar");
  await db.delete(users).where(eq(users.id, id));
}

// ---------- Devices ----------
export const deviceSchema = z.object({
  name: z.string().trim().min(1, "Name fehlt").max(100),
  kind: z.enum(["gateway", "esp32"]).default("gateway"),
  pollIntervalS: z.coerce.number().int().min(30, "mindestens 30 s").max(3600).default(300),
  offlineAfterMin: z.coerce.number().int().min(2).max(1440).default(15),
});

/** Registriert ein Device. Das Klartext-Token wird nur hier zurückgegeben. */
export async function createDevice(db: Db, input: unknown) {
  const data = deviceSchema.parse(input);
  const t = generateDeviceToken();
  const [d] = await db
    .insert(devices)
    .values({ ...data, tokenHash: t.hash, tokenPrefix: t.prefix })
    .returning();
  return { device: d, token: t.token };
}

export async function updateDevice(db: Db, id: string, input: unknown) {
  const data = deviceSchema.parse(input);
  const [d] = await db.update(devices).set(data).where(eq(devices.id, id)).returning();
  if (!d) throw new AdminError("Device nicht gefunden");
  return d;
}

export async function rotateDeviceToken(db: Db, id: string) {
  const t = generateDeviceToken();
  const res = await db
    .update(devices)
    .set({ tokenHash: t.hash, tokenPrefix: t.prefix })
    .where(eq(devices.id, id))
    .returning({ id: devices.id });
  if (!res.length) throw new AdminError("Device nicht gefunden");
  return t.token;
}

export async function deleteDevice(db: Db, id: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(inverters)
    .where(eq(inverters.deviceId, id));
  if (n > 0) throw new AdminError("Device hat noch Inverter – erst umhängen oder löschen");
  await db.delete(devices).where(eq(devices.id, id));
}

// ---------- Inverter ----------
export const inverterSchema = z.object({
  ref: z
    .string()
    .trim()
    .transform((s) => s.replace(/\*/g, ""))
    .pipe(z.string().min(3, "Kennung fehlt").max(64).regex(/^[A-Za-z0-9._-]+$/, "Nur Buchstaben, Ziffern, . _ -")),
  deviceId: z.uuid("Device wählen"),
  port: z.coerce.number().int().min(PORT_MIN, `Port ${PORT_MIN}–${PORT_MAX}`).max(PORT_MAX, `Port ${PORT_MIN}–${PORT_MAX}`),
  enabled: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()),
  name: optText(100),
  model: optText(50),
  ratedPowerW: optInt(0, 10_000_000),
  customerId: optUuid,
  siteId: optUuid,
});

/** Nächster freier Port für ein Device (oder null, wenn alle belegt). */
export async function suggestNextPort(db: Db, deviceId: string, excludeInverterId?: string): Promise<number | null> {
  const used = await db
    .select({ port: inverters.port })
    .from(inverters)
    .where(excludeInverterId ? and(eq(inverters.deviceId, deviceId), ne(inverters.id, excludeInverterId)) : eq(inverters.deviceId, deviceId));
  const set = new Set(used.map((u) => u.port));
  for (let p = PORT_MIN; p <= PORT_MAX; p++) if (!set.has(p)) return p;
  return null;
}

/**
 * Konsistenz Kunde/Anlage: Ist eine Anlage gesetzt, wird der Kunde daraus abgeleitet.
 * Ein abweichend gewählter Kunde ist ein Fehler.
 */
async function resolveAssignment(db: Db, customerId: string | null, siteId: string | null) {
  if (!siteId) {
    if (customerId) {
      const [c] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).limit(1);
      if (!c) throw new AdminError("Kunde nicht gefunden");
    }
    return { customerId, siteId: null };
  }
  const [s] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!s) throw new AdminError("Anlage nicht gefunden");
  if (customerId && customerId !== s.customerId) throw new AdminError("Anlage gehört nicht zum gewählten Kunden");
  return { customerId: s.customerId, siteId: s.id };
}

async function assertPortFree(db: Db, deviceId: string, port: number, excludeId?: string) {
  const clash = await db
    .select({ id: inverters.id, ref: inverters.ref })
    .from(inverters)
    .where(
      excludeId
        ? and(eq(inverters.deviceId, deviceId), eq(inverters.port, port), ne(inverters.id, excludeId))
        : and(eq(inverters.deviceId, deviceId), eq(inverters.port, port)),
    )
    .limit(1);
  if (clash.length) throw new AdminError(`Port ${port} ist auf diesem Device bereits belegt (${clash[0].ref})`);
}

async function assertRefFree(db: Db, ref: string, excludeId?: string) {
  const clash = await db
    .select({ id: inverters.id })
    .from(inverters)
    .where(excludeId ? and(eq(inverters.ref, ref), ne(inverters.id, excludeId)) : eq(inverters.ref, ref))
    .limit(1);
  if (clash.length) throw new AdminError("Kennung ist bereits vergeben");
}

export async function createInverter(db: Db, input: unknown) {
  const data = inverterSchema.parse(input);
  await assertRefFree(db, data.ref);
  await assertPortFree(db, data.deviceId, data.port);
  const assignment = await resolveAssignment(db, data.customerId, data.siteId);
  const [inv] = await db
    .insert(inverters)
    .values({ ...data, ...assignment })
    .returning();
  return inv;
}

export async function updateInverter(db: Db, id: string, input: unknown) {
  const data = inverterSchema.parse(input);
  await assertRefFree(db, data.ref, id);
  await assertPortFree(db, data.deviceId, data.port, id);
  const assignment = await resolveAssignment(db, data.customerId, data.siteId);
  const [inv] = await db
    .update(inverters)
    .set({ ...data, ...assignment })
    .where(eq(inverters.id, id))
    .returning();
  if (!inv) throw new AdminError("Inverter nicht gefunden");
  return inv;
}

export async function setInverterEnabled(db: Db, id: string, enabled: boolean) {
  await db.update(inverters).set({ enabled }).where(eq(inverters.id, id));
}

export async function deleteInverter(db: Db, id: string) {
  await db.delete(inverters).where(eq(inverters.id, id));
}

export function atCommandFor(port: number, host = "solarmax.dexena.com"): string {
  return `AT+SOCKB=TCP,${port},${host}`;
}

// ---------- Listen für die Admin-Oberfläche ----------
export async function listCustomers(db: Db) {
  return db.select().from(customers).orderBy(asc(customers.name));
}

export async function listAllSites(db: Db) {
  return db
    .select({ id: sites.id, name: sites.name, customerId: sites.customerId, customerName: customers.name })
    .from(sites)
    .innerJoin(customers, eq(customers.id, sites.customerId))
    .orderBy(asc(customers.name), asc(sites.name));
}

export async function listDevices(db: Db) {
  return db.select().from(devices).orderBy(asc(devices.name));
}

export async function listUsers(db: Db) {
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      customerId: users.customerId,
      customerName: customers.name,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(customers, eq(customers.id, users.customerId))
    .orderBy(asc(users.email));
}

export async function listInvertersAdmin(db: Db) {
  return db
    .select({
      inverter: inverters,
      deviceName: devices.name,
      customerName: customers.name,
      siteName: sites.name,
    })
    .from(inverters)
    .innerJoin(devices, eq(devices.id, inverters.deviceId))
    .leftJoin(customers, eq(customers.id, inverters.customerId))
    .leftJoin(sites, eq(sites.id, inverters.siteId))
    .orderBy(asc(devices.name), asc(inverters.port));
}

/** Letzter Messwert je Inverter für die Admin-Übersicht. */
export async function latestPerInverter(db: Db) {
  const res = await exec<{
    inverter_id: string;
    ts: string | Date;
    mode: number | null;
    ac_power_w: number | null;
    energy_today_wh: number | null;
    temperature_c: number | null;
  }>(db, sql`
    SELECT i.id AS inverter_id, m.ts, m.mode, m.ac_power_w, m.energy_today_wh, m.temperature_c
    FROM inverters i
    CROSS JOIN LATERAL (
      SELECT ts, mode, ac_power_w, energy_today_wh, temperature_c
      FROM measurements WHERE inverter_id = i.id ORDER BY ts DESC LIMIT 1
    ) m
  `);
  return new Map(
    res.rows.map((r) => [
      r.inverter_id,
      {
        ts: new Date(r.ts),
        mode: r.mode === null ? null : Number(r.mode),
        acPowerW: r.ac_power_w === null ? null : Number(r.ac_power_w),
        energyTodayWh: r.energy_today_wh === null ? null : Number(r.energy_today_wh),
        temperatureC: r.temperature_c === null ? null : Number(r.temperature_c),
      },
    ]),
  );
}

export async function recentAudit(db: Db, limit = 20) {
  return db
    .select({ a: auditLog, email: users.email })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

/** Kurztext für zod-Fehler in Formularen. */
export function errorMessage(err: unknown): string {
  if (err instanceof AdminError) return err.message;
  if (err instanceof z.ZodError) return err.issues.map((i) => i.message).join(", ");
  console.error("[admin] unerwarteter Fehler:", err instanceof Error ? err.message : err);
  return "Unerwarteter Fehler – bitte erneut versuchen";
}
