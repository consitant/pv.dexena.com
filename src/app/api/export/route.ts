import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { sites } from "@/db/schema";
import { resolveScope } from "@/lib/dashboard";
import { buildCsv } from "@/lib/export";
import { json } from "@/lib/http";
import { parsePeriod } from "@/lib/period";
import { isUuid } from "@/lib/portal-data";
import { getSessionUser } from "@/lib/session";
import { berlinDay } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV-Export – Kunde nur eigene Daten; Admin über customer= bzw. die Anlage. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const url = new URL(req.url);
  const sp = url.searchParams;
  const db = getDb();

  const siteId = sp.get("site");
  const requested = sp.get("customer");
  if ((siteId && !isUuid(siteId)) || (requested && !isUuid(requested))) return json({ error: "not_found" }, 404);

  let customerId: string | null;
  if (user.role === "admin") {
    customerId = requested;
    if (siteId) {
      const [s] = await db.select({ customerId: sites.customerId }).from(sites).where(eq(sites.id, siteId)).limit(1);
      customerId = s?.customerId ?? null;
    }
  } else {
    if (requested && requested !== user.customerId) return json({ error: "not_found" }, 404);
    customerId = user.customerId;
  }
  if (!customerId) return json({ error: "not_found" }, 404);

  const invParam = sp.get("inv");
  const inverterIds = invParam ? invParam.split(",").filter(Boolean) : [];
  if (inverterIds.length > 50 || !inverterIds.every(isUuid)) return json({ error: "not_found" }, 404);

  const scope = await resolveScope(db, customerId, { siteId, inverterIds });
  if (!scope) return json({ error: "not_found" }, 404);
  const period = parsePeriod(sp.get("view"), sp.get("date"), berlinDay(new Date()));
  const { filename, csv } = await buildCsv(db, scope, period);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
      "cache-control": "private, no-store",
    },
  });
}
