import { getDb } from "@/db/client";
import { json } from "@/lib/http";
import { getSessionUser } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live-Status für den Assistenten (Schritt 4) – nur Admins; alle anderen erhalten 404. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.role !== "admin") return json({ error: "not_found" }, 404);
  const id = new URL(req.url).searchParams.get("inverter") ?? "";
  const status = await getSetupStatus(getDb(), user, id);
  if (!status) return json({ error: "not_found" }, 404);
  return json(status);
}
