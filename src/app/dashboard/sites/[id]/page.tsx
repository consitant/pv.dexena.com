import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getPeriodData, resolveScope } from "@/lib/dashboard";
import { fmtNum } from "@/lib/format";
import { one, uuidList } from "@/lib/params";
import { parsePeriod } from "@/lib/period";
import { getCustomer, listSitesForCustomer } from "@/lib/portal-data";
import { resolveSiteViewer } from "@/lib/session";
import { berlinDay } from "@/lib/time";
import { ContextBar } from "../../context-bar";
import { PeriodView } from "../../period-view";
import { DashboardShell } from "../../shell";

export const metadata: Metadata = { title: "Anlage" };

export default async function SitePage({ params, searchParams }: PageProps<"/dashboard/sites/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { site, customerId, isAdmin } = await resolveSiteViewer(id);
  const inv = uuidList(sp.inv);
  if (inv === null) notFound();
  const db = getDb();
  const now = new Date();
  const [customer, siteList, scope] = await Promise.all([
    getCustomer(db, customerId),
    listSitesForCustomer(db, customerId),
    resolveScope(db, customerId, { siteId: site.id, inverterIds: inv }),
  ]);
  if (!customer || !scope) notFound();
  const period = parsePeriod(one(sp.view), one(sp.date), berlinDay(now));
  const data = await getPeriodData(db, scope, period, now);
  const q = isAdmin ? `?customer=${customerId}` : "";
  const settingsHref = `/dashboard/sites/${site.id}/settings${q}`;

  return (
    <DashboardShell customerId={customerId} isAdmin={isAdmin} current={site.id}>
      <ContextBar
        isAdmin={isAdmin}
        customerId={customerId}
        customerName={customer.name}
        title={site.name}
        subtitle={[site.address, site.peakPowerKwp ? `${fmtNum(site.peakPowerKwp, 1)} kWp` : null, `${scope.all.length} Wechselrichter`]
          .filter(Boolean)
          .join(" · ")}
        sites={siteList.map((s) => ({ id: s.id, name: s.name }))}
        currentSiteId={site.id}
        actions={
          <>
            {isAdmin && (
              <Link href={`/dashboard/setup?site=${site.id}&customer=${customerId}`} className="btn btn-primary">
                + Wechselrichter hinzufügen
              </Link>
            )}
            <Link href={settingsHref} className="btn">
              Einstellungen
            </Link>
          </>
        }
      />
      {scope.all.length === 0 ? (
        <div className="card text-grey">Dieser Anlage sind noch keine Wechselrichter zugeordnet.</div>
      ) : (
        <PeriodView
          data={data}
          scope={scope}
          ctx={{ basePath: `/dashboard/sites/${site.id}`, customerParam: isAdmin ? customerId : null, inverterIds: inv, settingsHref }}
        />
      )}
    </DashboardShell>
  );
}
