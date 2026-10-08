import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const PORT_MIN = 18900;
export const PORT_MAX = 18999;

export const userRole = pgEnum("user_role", ["admin", "customer"]);
export const deviceKind = pgEnum("device_kind", ["gateway", "esp32"]);
export const customerKind = pgEnum("customer_kind", ["private", "business"]);

export const customerNoSeq = pgSequence("customer_no_seq", { startWith: 1 });

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Kundennummer, automatisch K-00001 …, editierbar */
    customerNo: text("customer_no")
      .notNull()
      .unique()
      .default(sql`'K-' || lpad(nextval('customer_no_seq')::text, 5, '0')`),
    kind: customerKind("kind").notNull().default("private"),
    /** Anzeigename (Firmenname bzw. Vor- + Nachname), wird beim Speichern gebildet */
    name: text("name").notNull(),
    salutation: text("salutation"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    companyName: text("company_name"),
    contactPerson: text("contact_person"),
    email: text("email"),
    phone: text("phone"),
    /** Rechnungsadresse (Anlagenadressen stehen an den Anlagen) */
    address: text("address"),
    city: text("city"),
    notes: text("notes"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    active: boolean("active").notNull().default(true),
    contractStart: date("contract_start", { mode: "string" }),
    maintenanceContract: boolean("maintenance_contract").notNull().default(false),
    nextMaintenanceOn: date("next_maintenance_on", { mode: "string" }),
    createdAt: createdAt(),
  },
  (t) => [index("customers_name_idx").on(t.name)],
);

/** Freie interne Notizen je Kunde (mit Autor und Zeitstempel). */
export const customerNotes = pgTable(
  "customer_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("customer_notes_customer_idx").on(t.customerId, t.createdAt)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name"),
    phone: text("phone"),
    role: userRole("role").notNull().default("customer"),
    /** Einzelnen Benutzer sperren (zusätzlich zur Sperre über inaktiven Kunden) */
    disabled: boolean("disabled").notNull().default(false),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [
    check("users_email_lower", sql`${t.email} = lower(${t.email})`),
    check(
      "users_customer_role",
      sql`(${t.role} = 'admin') OR (${t.customerId} IS NOT NULL)`,
    ),
  ],
);

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    timezone: text("timezone").notNull().default("Europe/Berlin"),
    peakPowerKwp: real("peak_power_kwp"),
    commissionedOn: date("commissioned_on", { mode: "string" }),
    createdAt: createdAt(),
  },
  (t) => [index("sites_customer_idx").on(t.customerId)],
);

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: deviceKind("kind").notNull().default("gateway"),
  tokenHash: text("token_hash").notNull().unique(),
  tokenPrefix: text("token_prefix").notNull(),
  firmwareVersion: text("firmware_version"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  lastHeartbeat: jsonb("last_heartbeat"),
  pollIntervalS: integer("poll_interval_s").notNull().default(300),
  offlineAfterMin: integer("offline_after_min").notNull().default(15),
  isOnline: boolean("is_online").notNull().default(false),
  createdAt: createdAt(),
});

export const inverters = pgTable(
  "inverters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "restrict" }),
    ref: text("ref").notNull().unique(),
    port: integer("port").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    name: text("name"),
    model: text("model"),
    ratedPowerW: integer("rated_power_w"),
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    connected: boolean("connected").notNull().default(false),
    /** Über den Einrichtungsassistenten angelegt, Admin-Freigabe/Korrektur steht aus */
    setupPending: boolean("setup_pending").notNull().default(false),
    lastOkAt: timestamp("last_ok_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("inverters_device_port_uq").on(t.deviceId, t.port),
    check("inverters_port_range", sql`${t.port} BETWEEN 18900 AND 18999`),
    index("inverters_customer_idx").on(t.customerId),
    index("inverters_site_idx").on(t.siteId),
  ],
);

export type AcPhase = { u: number; i: number; p: number; f: number };
export type PvString = { u: number; i: number; p: number };

export const measurements = pgTable(
  "measurements",
  {
    inverterId: uuid("inverter_id")
      .notNull()
      .references(() => inverters.id, { onDelete: "cascade" }),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    mode: smallint("mode"),
    acPowerW: real("ac_power_w"),
    energyTodayWh: integer("energy_today_wh"),
    energyTotalKwh: integer("energy_total_kwh"),
    temperatureC: real("temperature_c"),
    maxPowerTodayW: real("max_power_today_w"),
    ac: jsonb("ac").$type<AcPhase[]>(),
    pv: jsonb("pv").$type<PvString[]>(),
    raw: jsonb("raw").$type<Record<string, number>>(),
  },
  (t) => [
    primaryKey({ columns: [t.inverterId, t.ts] }),
    index("measurements_inverter_ts_desc_idx").on(t.inverterId, t.ts.desc()),
  ],
);

export const dailyYield = pgTable(
  "daily_yield",
  {
    inverterId: uuid("inverter_id")
      .notNull()
      .references(() => inverters.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    energyWh: integer("energy_wh").notNull(),
    maxPowerW: real("max_power_w"),
  },
  (t) => [primaryKey({ columns: [t.inverterId, t.day] })],
);

export const monthlyYield = pgTable(
  "monthly_yield",
  {
    inverterId: uuid("inverter_id")
      .notNull()
      .references(() => inverters.id, { onDelete: "cascade" }),
    month: date("month", { mode: "string" }).notNull(),
    energyWh: bigint("energy_wh", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.inverterId, t.month] })],
);

export const firmwareReleases = pgTable("firmware_releases", {
  id: uuid("id").primaryKey().defaultRandom(),
  version: text("version").notNull().unique(),
  blobPathname: text("blob_pathname").notNull(),
  blobUrl: text("blob_url").notNull(),
  sha256: text("sha256").notNull(),
  size: integer("size").notNull(),
  released: boolean("released").notNull().default(false),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    target: text("target"),
    details: jsonb("details"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt), index("audit_log_customer_idx").on(t.customerId, t.createdAt)],
);

/** Strompreise je Anlage mit Gültigkeit ab einem Tag (mehrere Einträge = Preisänderungen). */
export const tariffs = pgTable(
  "tariffs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    validFrom: date("valid_from", { mode: "string" }).notNull(),
    /** Bezugspreis brutto in ct/kWh */
    priceCtPerKwh: real("price_ct_per_kwh").notNull(),
    /** Einspeisevergütung in ct/kWh */
    feedInCtPerKwh: real("feed_in_ct_per_kwh").notNull(),
    /** Geschätzte Eigenverbrauchsquote 0–100 % */
    selfConsumptionPct: real("self_consumption_pct").notNull().default(30),
    createdAt: createdAt(),
  },
  (t) => [
    unique("tariffs_site_valid_from_uq").on(t.siteId, t.validFrom),
    check("tariffs_price_range", sql`${t.priceCtPerKwh} >= 0 AND ${t.priceCtPerKwh} <= 500`),
    check("tariffs_feed_in_range", sql`${t.feedInCtPerKwh} >= 0 AND ${t.feedInCtPerKwh} <= 200`),
    check("tariffs_self_consumption_range", sql`${t.selfConsumptionPct} >= 0 AND ${t.selfConsumptionPct} <= 100`),
  ],
);
