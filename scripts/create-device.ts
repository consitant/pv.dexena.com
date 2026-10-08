/**
 * Registriert ein Device (Gateway) und gibt das Token EINMAL aus.
 * Aufruf: npm run db:create-device -- "LXC solarmax-gateway"
 */
import { createDevice } from "../src/lib/admin";
import { openDb } from "./_db";

async function main() {
  const name = process.argv.slice(2).join(" ").trim();
  if (!name) {
    console.error('Aufruf: npm run db:create-device -- "<name>"');
    process.exit(1);
  }
  const { db, close } = openDb();
  try {
    const { device, token } = await createDevice(db, { name, kind: "gateway" });
    console.log(`Device "${device.name}" angelegt (id ${device.id}).`);
    console.log(`Token (wird nur jetzt angezeigt): ${token}`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error("Fehler:", err instanceof Error ? err.message : err);
  process.exit(1);
});
