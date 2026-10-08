/**
 * Legt einen Admin an (oder setzt das Passwort eines bestehenden Admins neu).
 * Aufruf: npm run db:seed-admin -- admin@example.com
 * Das generierte Passwort wird EINMAL auf stdout ausgegeben und nirgends gespeichert.
 */
import { eq } from "drizzle-orm";
import { users } from "../src/db/schema";
import { hashPassword } from "../src/lib/passwords";
import { generatePassword } from "../src/lib/tokens";
import { openDb } from "./_db";

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Aufruf: npm run db:seed-admin -- <email>");
    process.exit(1);
  }
  const { db, close } = openDb();
  try {
    const password = generatePassword(20);
    const passwordHash = await hashPassword(password);
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      if (existing.role !== "admin") {
        console.error("Benutzer existiert bereits als Kunde – Abbruch.");
        process.exit(1);
      }
      await db.update(users).set({ passwordHash }).where(eq(users.id, existing.id));
      console.log(`Admin ${email} existierte bereits – Passwort wurde neu gesetzt.`);
    } else {
      await db.insert(users).values({ email, passwordHash, role: "admin", name: "Administrator" });
      console.log(`Admin ${email} angelegt.`);
    }
    console.log(`Passwort (wird nur jetzt angezeigt): ${password}`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error("Fehler:", err instanceof Error ? err.message : err);
  process.exit(1);
});
