import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { getPeriodData, getPortfolio, resolveScope } from "@/lib/dashboard";
import { fmtEnergyWh, fmtNum, fmtPower } from "@/lib/format";
import { one, SITE_COOKIE, uuidList } from "@/lib/params";
import { parsePeriod } from "@/lib/period";
import { getCustomer } from "@/lib/portal-data";
import { resolveViewCustomerId } from "@/lib/session";
import { berlinDay } from "@/lib/time";
import { Sparkline } from "@/components/sparkline";
import { StatusBadge } from "@/components/status-badge";
import { ContextBar } from "./context-bar";
import { DashboardShell } from "./shell";
import { PeriodView } from "./period-view";

export const metadata: Metadata = { title: "Übersicht" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const { user, customerId } = await resolveViewCustomerId(one(sp.customer) ?? null);
  if (!customerId) redirect("/admin/customers");
  const isAdmin = user.role === "admin";
  const db = getDb();
  const now = new Date();
  const [customer, portfolio] = await Promise.all([getCustomer(db, customerId), getPortfolio(db, customerId, now)]);
  if (!customer) notFound();

  const realSites = portfolio.sites.filter((s) => s.id);
  // Kunde öffnet /dashboard ohne Parameter → zuletzt gewählte Anlage (Cookie, nur eigene Anlagen)
  if (!isAdmin && Object.keys(sp).length === 0) {
    const remembered = (await cookies()).get(SITE_COOKIE)?.value;
    if (remembered && realSites.some((s) => s.id === remembered)) redirect(`/dashboard/sites/${remembered}`);
  }
  // Genau eine Anlage (und keine WR ohne Anlage) → direkt deren Dashboard
  if (realSites.length === 1 && portfolio.sites.length === 1) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "all") q.set(k, v);
    redirect(`/dashboard/sites/${realSites[0].id}${q.size ? `?${q}` : ""}`);
  }

  const inv = uuidList(sp.inv);
  if (inv === null) notFound();
  const scope = await resolveScope(db, customerId, { inverterIds: inv });
  if (!scope) notFound();
  const period = parsePeriod(one(sp.view), one(sp.date), berlinDay(now));
  const data = await getPeriodData(db, scope, period, now);
  const q = isAdmin ? `?customer=${customerId}` : "";

  return (
    <DashboardShell customerId={customerId} isAdmin={isAdmin} current="all">
      <ContextBar
        isAdmin={isAdmin}
        customerId={customerId}
        customerName={customer.name}
        title={portfolio.sites.length > 1 ? "Alle Anlagen" : customer.name}
        subtitle={`${portfolio.totals.inverterCount} Wechselrichter${realSites.length ? ` · ${realSites.length} Anlage(n)` : ""}`}
        sites={realSites.map((s) => ({ id: s.id!, name: s.name }))}
        currentSiteId={null}
      />

      {scope.all.length === 0 ? (
        <div className="card text-grey">Es sind noch keine Wechselrichter zugeordnet.</div>
      ) : (
        <>
          {portfolio.sites.length > 1 && (
            <section className="mb-8">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {portfolio.sites.map((s) => {
                  const body = (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-bold">{s.name}</h2>
                          <p className="truncate text-xs text-grey">
                            {s.inverterCount} WR{s.peakPowerKwp ? ` · ${fmtNum(s.peakPowerKwp, 1)} kWp` : ""}
                            {s.address ? ` · ${s.address}` : ""}
                          </p>
                        </div>
                        <StatusBadge status={s.status} />
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-3xl font-bold tabular-nums tracking-tight">{fmtPower(s.powerW)}</p>
                          <p className="text-xs text-grey">heute {fmtEnergyWh(s.todayWh)}</p>
                        </div>
                        <Sparkline values={s.spark} width={120} height={44} />
                      </div>
                    </>
                  );
                  return s.id ? (
                    <Link
                      key={s.id}
                      href={`/dashboard/sites/${s.id}${q}`}
                      className="card block transition duration-300 ease-dx hover:-translate-y-0.5 hover:ring-purple/40"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div key="none" className="card">
                      {body}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          <PeriodView
            data={data}
            scope={scope}
            ctx={{ basePath: "/dashboard", customerParam: isAdmin ? customerId : null, inverterIds: inv, settingsHref: null }}
          />
        </>
      )}
    </DashboardShell>
  );
}
