import { getDb } from "@/db/client";
import { isAuthorizedCron } from "@/lib/cron";
import { json } from "@/lib/http";
import { markOffline } from "@/lib/offline";
import { pruneRateLimits } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req.headers.get("authorization"))) return json({ error: "unauthorized" }, 401);
  const db = getDb();
  const result = await markOffline(db);
  await pruneRateLimits(db);
  return json({ ok: true, ...result });
}
