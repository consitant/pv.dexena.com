import { getDb } from "@/db/client";
import { readBodyCapped } from "@/lib/body";
import { clientIp, json } from "@/lib/http";
import { handleIngest, MAX_BODY_BYTES } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rawBody = await readBodyCapped(req, MAX_BODY_BYTES);
  if (rawBody === null) return json({ error: "payload_too_large" }, 413);
  try {
    const res = await handleIngest(getDb(), {
      authorization: req.headers.get("authorization"),
      ip: clientIp(req.headers),
      rawBody,
    });
    return json(res.body, res.status, res.headers);
  } catch (err) {
    console.error("[ingest] Fehler:", err instanceof Error ? err.message : err);
    return json({ error: "internal_error" }, 500);
  }
}
