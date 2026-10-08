import { createHmac } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/types";
import { firmwareReleases } from "@/db/schema";
import { safeEqualHex } from "./tokens";

export const FIRMWARE_URL_TTL_S = 10 * 60;

function signingKey(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET fehlt");
  return s;
}

export function signFirmwareDownload(id: string, exp: number): string {
  return createHmac("sha256", signingKey()).update(`firmware:${id}:${exp}`).digest("hex");
}

export function verifyFirmwareDownload(id: string, exp: number, sig: string, now = Date.now()): boolean {
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  return safeEqualHex(signFirmwareDownload(id, exp), sig);
}

/** Vergleich "1.2.10" > "1.2.9" (numerisch je Segment, Rest lexikografisch). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/);
  const pb = b.split(/[.+-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? "0";
    const y = pb[i] ?? "0";
    const nx = Number(x);
    const ny = Number(y);
    const c = Number.isFinite(nx) && Number.isFinite(ny) ? nx - ny : x.localeCompare(y);
    if (c !== 0) return c > 0 ? 1 : -1;
  }
  return 0;
}

export async function latestReleasedFirmware(db: Db) {
  const rows = await db
    .select()
    .from(firmwareReleases)
    .where(eq(firmwareReleases.released, true))
    .orderBy(desc(firmwareReleases.createdAt));
  rows.sort((a, b) => compareVersions(b.version, a.version));
  return rows[0] ?? null;
}

export async function getReleasedFirmware(db: Db, id: string) {
  const [r] = await db
    .select()
    .from(firmwareReleases)
    .where(and(eq(firmwareReleases.id, id), eq(firmwareReleases.released, true)))
    .limit(1);
  return r ?? null;
}
