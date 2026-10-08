import { eq } from "drizzle-orm";
import type { Db } from "@/db/types";
import { devices } from "@/db/schema";
import { parseBearer, safeEqualHex, sha256Hex } from "./tokens";
import { rateLimit } from "./rate-limit";

export type AuthedDevice = typeof devices.$inferSelect;

/** Ungültige Tokens je IP und Minute, bevor 429 kommt. */
export const BAD_TOKEN_LIMIT_PER_MIN = 10;

/** Prüft das Device-Token (SHA-256 → devices.token_hash, zeitkonstanter Vergleich). */
export async function findDeviceByAuthHeader(
  db: Db,
  authorization: string | null | undefined,
): Promise<AuthedDevice | null> {
  const token = parseBearer(authorization);
  if (!token) return null;
  const hash = sha256Hex(token);
  const [device] = await db.select().from(devices).where(eq(devices.tokenHash, hash)).limit(1);
  if (!device || !safeEqualHex(device.tokenHash, hash)) return null;
  return device;
}

export type DeviceAuthResult =
  | { ok: true; device: AuthedDevice }
  | { ok: false; status: 401 | 429; retryAfterS?: number };

/** Device-Auth inkl. IP-Rate-Limit für ungültige Tokens. */
export async function authenticateDevice(
  db: Db,
  authorization: string | null | undefined,
  ip: string,
  now: Date = new Date(),
): Promise<DeviceAuthResult> {
  const device = await findDeviceByAuthHeader(db, authorization);
  if (device) return { ok: true, device };
  const rl = await rateLimit(db, `badtoken:${ip}`, BAD_TOKEN_LIMIT_PER_MIN, 60, now);
  if (!rl.ok) return { ok: false, status: 429, retryAfterS: rl.retryAfterS };
  return { ok: false, status: 401 };
}
