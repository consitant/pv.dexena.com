/** Kontoverwaltung: Passwort ändern/zurücksetzen und Profil – mit Rechteprüfung. */
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/types";
import { users } from "@/db/schema";
import type { SessionUser } from "./login";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "./passwords";
import { generatePassword } from "./tokens";

export class AccountError extends Error {}

/**
 * Passwort setzen:
 * - eigenes Konto: aktuelles Passwort erforderlich, neues Passwort Pflicht
 * - Admin für fremdes Konto: ohne altes Passwort; leer → generiert (einmalig zurückgegeben)
 * - alle anderen: verboten
 */
export async function changePassword(
  db: Db,
  actor: SessionUser,
  targetUserId: string,
  input: { currentPassword?: string | null; newPassword?: string | null },
): Promise<{ generated: string | null }> {
  const self = actor.id === targetUserId;
  if (!self && actor.role !== "admin") throw new AccountError("Keine Berechtigung");
  const [target] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
  if (!target) throw new AccountError("Benutzer nicht gefunden");

  const next = input.newPassword?.trim() || null;
  if (self) {
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, target.passwordHash))) {
      throw new AccountError("Aktuelles Passwort ist falsch");
    }
    if (!next) throw new AccountError("Neues Passwort fehlt");
  }
  if (next && next.length < MIN_PASSWORD_LENGTH) {
    throw new AccountError(`Passwort: mindestens ${MIN_PASSWORD_LENGTH} Zeichen`);
  }
  const generated = next ? null : generatePassword(16);
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(next ?? generated!) })
    .where(eq(users.id, targetUserId));
  return { generated };
}

const profileSchema = z.object({
  name: z.string().trim().max(200).transform((v) => v || null),
  phone: z.string().trim().max(50).transform((v) => v || null),
});

export async function updateOwnProfile(db: Db, actor: SessionUser, input: unknown) {
  const data = profileSchema.parse(input);
  await db.update(users).set(data).where(eq(users.id, actor.id));
}
