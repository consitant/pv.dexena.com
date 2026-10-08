import { getDb } from "@/db/client";
import { authenticateDevice } from "@/lib/device-auth";
import { getGatewayConfig } from "@/lib/gateway-config";
import { clientIp, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const db = getDb();
  const auth = await authenticateDevice(db, req.headers.get("authorization"), clientIp(req.headers));
  if (!auth.ok) {
    return auth.status === 429
      ? json({ error: "rate_limited" }, 429, { "retry-after": String(auth.retryAfterS ?? 60) })
      : json({ error: "unauthorized" }, 401);
  }
  return json(await getGatewayConfig(db, auth.device));
}
