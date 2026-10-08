import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/types";
import { customers, users } from "@/db/schema";
import { getDummyHash, verifyPassword } from "./passwords";
import { rateLimit } from "./rate-limit";

export const LOGIN_LIMIT_PER_IP = 20; // je 15 min
export const LOGIN_LIMIT_PER_EMAIL = 8; // je 15 min
const WINDOW_S = 15 * 60;

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(200)),
  password: z.string().min(1).max(200),
});

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "customer";
  customerId: string | null;
};

/**
 * Prüft Zugangsdaten inkl. Rate-Limit (pro IP und pro E-Mail).
 * Gibt bei JEDEM Fehler null zurück (generische Fehlermeldung im UI).
 */
export async function verifyLogin(
  db: Db,
  input: { email: unknown; password: unknown; ip: string },
  now: Date = new Date(),
): Promise<SessionUser | null> {
  const parsed = credentialsSchema.safeParse({ email: input.email, password: input.password });
  const ipRl = await rateLimit(db, `login-ip:${input.ip}`, LOGIN_LIMIT_PER_IP, WINDOW_S, now);
  if (!parsed.success || !ipRl.ok) return null;
  const { email, password } = parsed.data;
  const emailRl = await rateLimit(db, `login-email:${email}`, LOGIN_LIMIT_PER_EMAIL, WINDOW_S, now);
  if (!emailRl.ok) return null;

  const [row] = await db
    .select({ user: users, customerActive: customers.active })
    .from(users)
    .leftJoin(customers, eq(customers.id, users.customerId))
    .where(eq(users.email, email))
    .limit(1);
  const user = row?.user;
  const ok = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !ok || !isAllowed(user, row.customerActive)) return null;

  await db.update(users).set({ lastLoginAt: now }).where(eq(users.id, user.id));
  return { id: user.id, email: user.email, name: user.name, role: user.role, customerId: user.customerId };
}

/** Gesperrte Benutzer und Benutzer inaktiver Kunden dürfen sich nicht anmelden. */
function isAllowed(user: { disabled: boolean; role: string; customerId: string | null }, customerActive: boolean | null) {
  if (user.disabled) return false;
  if (user.role === "admin") return true;
  return !!user.customerId && customerActive === true;
}

/**
 * Lädt den aktuellen Stand eines Benutzers (Rolle/Kunde nie blind aus dem JWT übernehmen).
 * Gesperrt/inaktiv → null, d. h. bestehende Sessions verlieren sofort ihre Gültigkeit.
 */
export async function loadSessionUser(db: Db, userId: string): Promise<SessionUser | null> {
  const [row] = await db
    .select({ u: users, customerActive: customers.active })
    .from(users)
    .leftJoin(customers, eq(customers.id, users.customerId))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row || !isAllowed(row.u, row.customerActive)) return null;
  const u = row.u;
  return { id: u.id, email: u.email, name: u.name, role: u.role, customerId: u.customerId };
}
