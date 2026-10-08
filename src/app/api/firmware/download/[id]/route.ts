import { get } from "@vercel/blob";
import { getDb } from "@/db/client";
import { getReleasedFirmware, verifyFirmwareDownload } from "@/lib/firmware";
import { json } from "@/lib/http";
import { isUuid } from "@/lib/portal-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kurzlebiger, HMAC-signierter Download (privater Blob wird durchgereicht). */
export async function GET(req: Request, ctx: RouteContext<"/api/firmware/download/[id]">) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";
  if (!isUuid(id) || !verifyFirmwareDownload(id, exp, sig)) return json({ error: "forbidden" }, 403);
  const fw = await getReleasedFirmware(getDb(), id);
  if (!fw) return json({ error: "not_found" }, 404);
  const blob = await get(fw.blobPathname, { access: "private" });
  if (!blob || blob.statusCode !== 200) return json({ error: "not_found" }, 404);
  return new Response(blob.stream, {
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(fw.size),
      "content-disposition": `attachment; filename="firmware-${fw.version.replace(/[^\w.-]/g, "_")}.bin"`,
      "x-firmware-sha256": fw.sha256,
      "cache-control": "private, no-store",
    },
  });
}
