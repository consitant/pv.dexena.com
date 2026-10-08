import { safeEqualHex, sha256Hex } from "./tokens";

/** Prüft `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sendet den Header automatisch). */
export function isAuthorizedCron(authorization: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorization) return false;
  return safeEqualHex(sha256Hex(authorization), sha256Hex(`Bearer ${secret}`));
}
