import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/types";
import { sites, tariffs } from "@/db/schema";
import type { SessionUser } from "./login";
import { isUuid } from "./portal-data";
import { isValidDay } from "./time";

export class TariffError extends Error {}

const num = (min: number, max: number, msg: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace(",", ".") : v),
    z.coerce.number({ message: msg }).finite().min(min, msg).max(max, msg),
  );

export const tariffSchema = z.object({
  validFrom: z.string().refine((s) => isValidDay(s) && s >= "2000-01-01" && s <= "2100-12-31", "Ungültiges Datum"),
  priceCtPerKwh: num(0, 200, "Bezugspreis: 0–200 ct/kWh"),
  feedInCtPerKwh: num(0, 100, "Einspeisevergütung: 0–100 ct/kWh"),
  selfConsumptionPct: num(0, 100, "Eigenverbrauch: 0–100 %").default(30),
});

/**
 * Darf der Benutzer die Tarife dieser Anlage bearbeiten?
 * Admin: jede Anlage; Kunde: nur Anlagen des eigenen Kunden. Sonst null (→ 404).
 */
export async function siteForEditor(db: Db, user: SessionUser, siteId: string) {
  if (!isUuid(siteId)) return null;
  const [s] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!s) return null;
  if (user.role === "admin") return s;
  return user.customerId && s.customerId === user.customerId ? s : null;
}

export async function listTariffs(db: Db, siteId: string) {
  return db.select().from(tariffs).where(eq(tariffs.siteId, siteId)).orderBy(asc(tariffs.validFrom));
}

export async function upsertTariff(db: Db, user: SessionUser, siteId: string, input: unknown) {
  const site = await siteForEditor(db, user, siteId);
  if (!site) throw new TariffError("Anlage nicht gefunden");
  const data = tariffSchema.parse(input);
  const [t] = await db
    .insert(tariffs)
    .values({ siteId: site.id, ...data })
    .onConflictDoUpdate({
      target: [tariffs.siteId, tariffs.validFrom],
      set: {
        priceCtPerKwh: data.priceCtPerKwh,
        feedInCtPerKwh: data.feedInCtPerKwh,
        selfConsumptionPct: data.selfConsumptionPct,
      },
    })
    .returning();
  return { tariff: t, site };
}

export async function deleteTariff(db: Db, user: SessionUser, siteId: string, tariffId: string) {
  const site = await siteForEditor(db, user, siteId);
  if (!site || !isUuid(tariffId)) throw new TariffError("Anlage nicht gefunden");
  await db.delete(tariffs).where(and(eq(tariffs.id, tariffId), eq(tariffs.siteId, site.id)));
  return site;
}
