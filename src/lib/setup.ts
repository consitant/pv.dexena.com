/**
 * Einrichtungsassistent „Wechselrichter verbinden“ – serverseitiger Teil.
 * WICHTIG: Heim-WLAN-Name/-Passwort werden NIE an den Server gesendet; das Eingabeschema ist strikt
 * und lehnt jedes zusätzliche Feld ab.
 */
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/types";
import { devices, inverters, PORT_MAX, PORT_MIN } from "@/db/schema";
import type { SessionUser } from "./login";
import { isUuid } from "./portal-data";
import { parseStickRef } from "./stick-ref";
import { siteForEditor } from "./tariffs";

export class SetupError extends Error {}
/** Kein Admin → wird von Seite/Action/Endpunkt als 404 behandelt. */
export class SetupForbidden extends Error {}

/** Strikt: nur Anlage + Stick-Kennung. Zusätzliche Felder (z. B. WLAN-Passwort) → Fehler. */
export const registerSchema = z.strictObject({
  siteId: z.uuid("Anlage wählen"),
  ref: z.string().trim().min(1, "Kennung fehlt").max(64),
});

/** Standard-Gateway für neue Wechselrichter: das älteste Device vom Typ „gateway“. */
export async function defaultGateway(db: Db) {
  const [d] = await db
    .select()
    .from(devices)
    .where(eq(devices.kind, "gateway"))
    .orderBy(asc(devices.createdAt))
    .limit(1);
  return d ?? null;
}

/** Nächster freier Port im Bereich 18900–18999 für ein Gateway (null = alle belegt). */
export function nextFreePort(used: Iterable<number>): number | null {
  const set = new Set(used);
  for (let p = PORT_MIN; p <= PORT_MAX; p++) if (!set.has(p)) return p;
  return null;
}

export type RegisterResult = {
  inverterId: string;
  ref: string;
  port: number;
  siteId: string;
  created: boolean;
};

/**
 * Legt einen Wechselrichter für eine Anlage an (oder liefert den bestehenden, wenn derselbe Stick
 * bereits dieser Anlage zugeordnet ist – der Assistent darf wiederholt werden).
 * Nur Admins (Einrichtung vor Ort) – Kunden dürfen keine Wechselrichter hinzufügen.
 */
export async function registerInverterForSite(db: Db, actor: SessionUser, input: unknown): Promise<RegisterResult> {
  if (actor.role !== "admin") throw new SetupForbidden();
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) throw new SetupError(parsed.error.issues.map((i) => i.message).join(", "));
  const site = await siteForEditor(db, actor, parsed.data.siteId);
  if (!site) throw new SetupError("Anlage nicht gefunden");
  const ref = parseStickRef(parsed.data.ref);
  if (!ref) throw new SetupError("Kennung nicht erkannt – Beispiel: SC2313-123456789 oder WLAN-Name 10SMT_2313-123456789");

  const [existing] = await db.select().from(inverters).where(eq(inverters.ref, ref)).limit(1);
  if (existing) {
    if (existing.siteId === site.id) {
      return { inverterId: existing.id, ref, port: existing.port, siteId: site.id, created: false };
    }
    throw new SetupError("Dieser Stick ist bereits registriert. Bitte wenden Sie sich an den Support.");
  }

  const gw = await defaultGateway(db);
  if (!gw) throw new SetupError("Kein Gateway eingerichtet – bitte den Support kontaktieren.");

  // Bei gleichzeitiger Vergabe kann der Port kollidieren (UNIQUE device_id+port) → neu versuchen
  for (let attempt = 0; attempt < 5; attempt++) {
    const used = await db.select({ port: inverters.port }).from(inverters).where(eq(inverters.deviceId, gw.id));
    const port = nextFreePort(used.map((u) => u.port));
    if (port === null) throw new SetupError("Am Gateway sind keine Ports mehr frei – bitte den Support kontaktieren.");
    try {
      const [inv] = await db
        .insert(inverters)
        .values({
          ref,
          deviceId: gw.id,
          port,
          enabled: true,
          setupPending: true,
          name: `Wechselrichter ${ref.slice(-4)}`,
          siteId: site.id,
          customerId: site.customerId,
        })
        .returning();
      return { inverterId: inv.id, ref, port, siteId: site.id, created: true };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const [again] = await db.select().from(inverters).where(eq(inverters.ref, ref)).limit(1);
      if (again) {
        if (again.siteId === site.id) return { inverterId: again.id, ref, port: again.port, siteId: site.id, created: false };
        throw new SetupError("Dieser Stick ist bereits registriert. Bitte wenden Sie sich an den Support.");
      }
    }
  }
  throw new SetupError("Port konnte nicht vergeben werden – bitte erneut versuchen.");
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  return e?.code === "23505" || e?.cause?.code === "23505" || /unique|duplicate/i.test(String(e?.message ?? ""));
}

export type SetupStatus = {
  connected: boolean;
  lastOkAt: string | null;
  hasMeasurement: boolean;
  gatewaySeenAt: string | null;
};

/** Live-Status für Schritt 4 – nur für Admins. */
export async function getSetupStatus(db: Db, actor: SessionUser, inverterId: string): Promise<SetupStatus | null> {
  if (actor.role !== "admin" || !isUuid(inverterId)) return null;
  const [row] = await db
    .select({ inv: inverters, gwSeen: devices.lastSeenAt })
    .from(inverters)
    .innerJoin(devices, eq(devices.id, inverters.deviceId))
    .where(eq(inverters.id, inverterId))
    .limit(1);
  if (!row) return null;
  const hasMeasurement = !!row.inv.lastOkAt;
  return {
    connected: row.inv.connected,
    lastOkAt: row.inv.lastOkAt?.toISOString() ?? null,
    hasMeasurement,
    gatewaySeenAt: row.gwSeen?.toISOString() ?? null,
  };
}

/** Admin: Einrichtung freigeben (Flag entfernen). */
export async function approveSetup(db: Db, inverterId: string) {
  await db.update(inverters).set({ setupPending: false }).where(and(eq(inverters.id, inverterId)));
}
