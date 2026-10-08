import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";
import type { Db } from "@/db/types";
import { generateDeviceToken } from "@/lib/tokens";

/** Frische In-Process-Postgres mit denselben Drizzle-Migrationen wie Produktion. */
export async function createTestDb(): Promise<{ db: Db; client: PGlite }> {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../drizzle") });
  return { db, client };
}

let refCounter = 0;
/** Fiktive Wechselrichter-Kennung (keine echten Seriennummern im öffentlichen Repo). */
export function fakeRef(): string {
  refCounter++;
  return `SC0000-${String(100000000 + refCounter)}`;
}

export async function createCustomer(db: Db, name: string) {
  const [c] = await db.insert(schema.customers).values({ name }).returning();
  return c;
}

export async function createDevice(db: Db, name = "Test-Gateway") {
  const t = generateDeviceToken();
  const [d] = await db
    .insert(schema.devices)
    .values({ name, tokenHash: t.hash, tokenPrefix: t.prefix })
    .returning();
  return { device: d, token: t.token };
}

export async function createInverter(
  db: Db,
  values: { deviceId: string; port: number; customerId?: string | null; siteId?: string | null; ref?: string; enabled?: boolean },
) {
  const [i] = await db
    .insert(schema.inverters)
    .values({ ref: values.ref ?? fakeRef(), ...values })
    .returning();
  return i;
}

export function measurement(ref: string, ts: string, extra: Record<string, unknown> = {}) {
  return {
    inverter: ref,
    ts,
    mode: 3,
    acPowerW: 672.2,
    energyTodayWh: 10600,
    energyTotalKwh: 3062,
    temperatureC: 45,
    maxPowerTodayW: 5297,
    ac: [
      { u: 404.4, i: 1.26, p: 224.6, f: 50.02 },
      { u: 401.8, i: 1.25, p: 224.3, f: 50.02 },
      { u: 404.4, i: 1.28, p: 225.5, f: 50.02 },
    ],
    pv: [
      { u: 415.7, i: 1.19, p: 498.5 },
      { u: 357.2, i: 1.11, p: 398.3 },
      { u: 0, i: 0, p: 0 },
    ],
    raw: { "4131": 0, "4132": 803 },
    ...extra,
  };
}
