import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { sites } from "@/db/schema";
import { one } from "@/lib/params";
import { getCustomer, isUuid, listSitesForCustomer } from "@/lib/portal-data";
import { requireAdmin } from "@/lib/session";
import { ContextBar } from "../context-bar";
import { SetupWizard } from "./wizard";

export const metadata: Metadata = { title: "Wechselrichter verbinden" };

export default async function SetupPage({ searchParams }: PageProps<"/dashboard/setup">) {
  const sp = await searchParams;
  // Nur Admins (Einrichtung vor Ort) – Kunden erhalten 404
  const user = await requireAdmin();
  const db = getDb();
  const siteParam = one(sp.site);
  let customerId = user.customerId;
  if (user.role === "admin") {
    customerId = one(sp.customer) ?? null;
    if (siteParam && isUuid(siteParam)) {
      const [s] = await db.select({ customerId: sites.customerId }).from(sites).where(eq(sites.id, siteParam)).limit(1);
      customerId = s?.customerId ?? customerId;
    }
    if (!customerId) redirect("/admin/customers");
  }
  if (!customerId || !isUuid(customerId)) notFound();
  const [customer, siteList] = await Promise.all([getCustomer(db, customerId), listSitesForCustomer(db, customerId)]);
  if (!customer) notFound();
  const isAdmin = user.role === "admin";
  const initialSite = siteList.find((s) => s.id === siteParam)?.id ?? (siteList.length === 1 ? siteList[0].id : "");

  return (
    <div className="mx-auto max-w-2xl">
      <ContextBar
        isAdmin={isAdmin}
        customerId={customerId}
        customerName={customer.name}
        title="Wechselrichter verbinden"
        subtitle="Schritt für Schritt – am besten direkt am Wechselrichter mit dem Handy."
        back={
          initialSite
            ? { href: `/dashboard/sites/${initialSite}${isAdmin ? `?customer=${customerId}` : ""}`, label: "Zurück zur Anlage" }
            : { href: `/dashboard${isAdmin ? `?customer=${customerId}` : ""}`, label: "Zurück" }
        }
      />
      {siteList.length === 0 ? (
        <div className="card text-ink-soft">
          Es ist noch keine Anlage angelegt. {isAdmin ? "Bitte zuerst in der Kundenverwaltung eine Anlage anlegen." : "Bitte wenden Sie sich an dexena."}
        </div>
      ) : (
        <SetupWizard
          sites={siteList.map((s) => ({ id: s.id, name: s.name }))}
          initialSiteId={initialSite}
          dashboardQuery={isAdmin ? `?customer=${customerId}` : ""}
        />
      )}
    </div>
  );
}
