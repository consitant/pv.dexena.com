import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { getCustomer, getDashboardData, isUuid } from "@/lib/portal-data";
import { resolveViewCustomerId } from "@/lib/session";
import { addDays, isValidDay } from "@/lib/time";
import { fmtDay, fmtEnergyWh, fmtKwh, fmtMonth, fmtPower } from "@/lib/format";
import { DayCurveChart, EnergyBarChart } from "@/components/charts";
import { AutoRefresh } from "@/components/auto-refresh";
import { InverterCard } from "./inverter-card";

export const metadata: Metadata = { title: "Dashboard" };

type Search = { customer?: string; site?: string; day?: string };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = (await searchParams) as Search;
  const { user, customerId } = await resolveViewCustomerId(typeof sp.customer === "string" ? sp.customer : null);
  if (!customerId) redirect("/admin/customers");

  const siteId = typeof sp.site === "string" && sp.site ? sp.site : null;
  if (siteId && !isUuid(siteId)) notFound();
  const day = typeof sp.day === "string" && isValidDay(sp.day) ? sp.day : undefined;

  const db = getDb();
  const [customer, data] = await Promise.all([
    getCustomer(db, customerId),
    getDashboardData(db, customerId, { day, siteId }),
  ]);
  if (!customer || !data) notFound();

  const isAdmin = user.role === "admin";
  const href = (p: Partial<Search>) => {
    const q = new URLSearchParams();
    if (isAdmin) q.set("customer", customerId);
    const site = p.site === undefined ? data.siteId : p.site;
    if (site) q.set("site", site);
    const d = p.day === undefined ? data.day : p.day;
    if (d && d !== data.today) q.set("day", d);
    const s = q.toString();
    return `/dashboard${s ? `?${s}` : ""}`;
  };
  const isToday = data.day === data.today;
  const utilisation = data.totals.ratedW > 0 ? Math.round((data.totals.powerW / data.totals.ratedW) * 100) : null;
  const series = data.inverters.map((i) => ({ id: i.id, name: i.name ?? i.ref }));

  return (
    <div className="space-y-6">
      {isToday && <AutoRefresh intervalS={60} />}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {isAdmin && (
            <Link href={`/admin/customers/${customerId}`} className="link text-sm">
              ← Kunde verwalten
            </Link>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
          <p className="text-sm text-stone-500">
            {data.inverters.length} Wechselrichter{data.sites.length > 0 && ` · ${data.sites.length} Anlage(n)`}
          </p>
        </div>
        {data.sites.length > 1 && (
          <nav className="flex flex-wrap gap-1 rounded-xl bg-stone-100 p-1 text-sm">
            <Link
              href={href({ site: "" })}
              className={`rounded-lg px-3 py-1.5 ${!data.siteId ? "bg-white font-medium shadow-sm" : "text-stone-600"}`}
            >
              Alle Anlagen
            </Link>
            {data.sites.map((s) => (
              <Link
                key={s.id}
                href={href({ site: s.id })}
                className={`rounded-lg px-3 py-1.5 ${data.siteId === s.id ? "bg-white font-medium shadow-sm" : "text-stone-600"}`}
              >
                {s.name}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {data.inverters.length === 0 ? (
        <div className="card text-sm text-stone-500">Es sind noch keine Wechselrichter zugeordnet.</div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Aktuelle Leistung"
              value={fmtPower(data.totals.powerW)}
              sub={utilisation !== null ? `${utilisation} % der Nennleistung` : undefined}
              accent
            />
            <Kpi label="Ertrag heute" value={fmtEnergyWh(data.totals.todayWh)} />
            <Kpi label={`Ertrag ${data.year.year}`} value={fmtEnergyWh(data.year.totalWh)} sub={`${fmtMonth(data.month.month)}: ${fmtEnergyWh(data.month.totalWh)}`} />
            <Kpi label="Gesamtertrag" value={fmtKwh(data.totals.totalKwh)} />
          </section>

          <section className="card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="card-title mb-0">Leistung am {fmtDay(data.day)}</h2>
              <div className="flex items-center gap-1">
                <Link className="btn btn-sm" href={href({ day: addDays(data.day, -1) })} aria-label="Vorheriger Tag">
                  ←
                </Link>
                {!isToday && (
                  <>
                    <Link className="btn btn-sm" href={href({ day: addDays(data.day, 1) })} aria-label="Nächster Tag">
                      →
                    </Link>
                    <Link className="btn btn-sm" href={href({ day: data.today })}>
                      Heute
                    </Link>
                  </>
                )}
              </div>
            </div>
            <DayCurveChart points={data.curve.points} series={series} />
            {series.length > 1 && (
              <ul className="mt-2 flex flex-wrap gap-3 text-xs text-stone-500">
                {series.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: LEGEND[i % LEGEND.length] }} />
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="card">
              <h2 className="card-title">
                {fmtMonth(data.month.month)} · {fmtEnergyWh(data.month.totalWh)}
              </h2>
              <EnergyBarChart bars={data.month.bars} highlightKey={data.day} />
            </div>
            <div className="card">
              <h2 className="card-title">
                Jahr {data.year.year} · {fmtEnergyWh(data.year.totalWh)}
              </h2>
              <EnergyBarChart bars={data.year.bars} highlightKey={data.month.month} />
            </div>
          </section>

          <section>
            <h2 className="card-title">Wechselrichter</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {data.inverters.map((inv) => (
                <InverterCard key={inv.id} inv={inv} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

const LEGEND = ["#f59e0b", "#0ea5e9", "#10b981", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#6366f1"];

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`card ${accent ? "border-sun-400 bg-sun-50" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-stone-500">{sub}</p>}
    </div>
  );
}
