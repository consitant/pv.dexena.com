import { getDb } from "@/db/client";
import { authenticateDevice } from "@/lib/device-auth";
import { compareVersions, FIRMWARE_URL_TTL_S, latestReleasedFirmware, signFirmwareDownload } from "@/lib/firmware";
import { clientIp, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const db = getDb();
  const auth = await authenticateDevice(db, req.headers.get("authorization"), clientIp(req.headers));
  if (!auth.ok) {
    return auth.status === 429 ? json({ error: "rate_limited" }, 429) : json({ error: "unauthorized" }, 401);
  }
  const url = new URL(req.url);
  const current = url.searchParams.get("current")?.slice(0, 50) ?? "";
  const latest = await latestReleasedFirmware(db);
  if (!latest || (current && compareVersions(latest.version, current) <= 0)) {
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  }
  const exp = Math.floor(Date.now() / 1000) + FIRMWARE_URL_TTL_S;
  const sig = signFirmwareDownload(latest.id, exp);
  const download = new URL(`/api/firmware/download/${latest.id}`, url.origin);
  download.searchParams.set("exp", String(exp));
  download.searchParams.set("sig", sig);
  return json({ version: latest.version, url: download.toString(), sha256: latest.sha256, size: latest.size });
}
