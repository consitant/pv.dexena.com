import { getDb } from "@/db/client";
import { aggregateRecent } from "@/lib/aggregate";
import { isAuthorizedCron } from "@/lib/cron";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isAuthorizedCron(req.headers.get("authorization"))) return json({ error: "unauthorized" }, 401);
  const result = await aggregateRecent(getDb(), new Date(), 2);
  return json({ ok: true, ...result });
}
