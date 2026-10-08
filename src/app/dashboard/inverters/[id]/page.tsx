import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { inverters } from "@/db/schema";
import { getInverterDay } from "@/lib/dashboard";
import { fmtDay, fmtDayLong, fmtNum, fmtPower, fmtTime, fmtAgo } from "@/lib/format";
import { one } from "@/lib/params";
import { parsePeriod } from "@/lib/period";
import { getCustomer, getInverterDetail, isUuid, listSitesForCustomer } from "@/lib/portal-data";
import { requireUser } from "@/lib/session";
import { berlinDay } from "@/lib/time";
import { LinesChart } from "@/components/charts";
import { modeLabel, StatusBadge } from "@/components/status-badge";
import { ContextBar } from "../../context-bar";

export const metadata: Metadata = { title: "Wechselrichter" };

const MODE_COLOR: Record<string, string> = { "3": "#6f45dc", "1": "#9b82e8", "5": "#e5532e", "0": "#0f766e", "9": "#8a8787" };

export default async function InverterPage({ params, searchParams }: PageProps<"/dashboard/inverters/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  if (!isUuid(id)) notFound();
  const db = getDb();
  // Kunde: nur eigene WR; Admin: Kunde aus dem WR ableiten
  let customerId = user.customerId;
  if (user.role === "admin") {
    const [inv] = await db.select({ customerId: inverters.customerId }).from(inverters).where(eq(inverters.id, id)).limit(1);
    customerId = inv?.customerId ?? null;
  }
  if (!customerId) notFound();
  const now = new Date();
  const detail = await getInverterDetail(db, customerId, id, now);
  if (!detail) notFound();
  const isAdmin = user.role === "admin";
  const period = parsePeriod("day", one(sp.date), berlinDay(now));
  const [customer, siteList, day] = await Promise.all([
    getCustomer(db, customerId),
    listSitesForCustomer(db, customerId),
    getInverterDay(db, id, period.key),
  ]);
  const inv = detail.inverter;
  const l = detail.latest;
  const q = (date?: string | null) => {
    const p = new URLSearchParams();
    if (isAdmin) p.set("customer", customerId!);
    if (date) p.set("date", date);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const back = inv.siteId
    ? { href: `/dashboard/sites/${inv.siteId}${q()}`, label: inv.siteName ?? "Anlage" }
    : { href: `/dashboard${q()}`, label: "Übersicht" };
  const dayStart = day.points[0]?.t;
  const dayEnd = day.points[day.points.length - 1]?.t;
  const span = dayStart && dayEnd && dayEnd > dayStart ? dayEnd - dayStart : 1;

  return (
    <>
      <ContextBar
        isAdmin={isAdmin}
        customerId={customerId}
        customerName={customer?.name ?? ""}
        title={inv.name ?? inv.ref}
        subtitle={[inv.model, inv.ref, inv.ratedPowerW ? `${fmtNum(inv.ratedPowerW / 1000, 1)} kW` : null].filter(Boolean).join(" · ")}
        sites={siteList.map((s) => ({ id: s.id, name: s.name }))}
        currentSiteId={inv.siteId}
        back={back}
        actions={<StatusBadge status={detail.status} className="px-3 py-1 text-sm" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <h2 className="card-title">Aktuell</h2>
          <p className="text-4xl font-bold tabular-nums">{fmtPower(detail.status === "offline" || detail.status === "night" ? 0 : l?.acPowerW)}</p>
          <dl className="mt-4 space-y-1.5 text-sm">
            <Row k="Betriebsmodus" v={modeLabel(l?.mode)} />
            <Row k="Temperatur" v={l?.temperatureC != null ? `${fmtNum(l.temperatureC, 0)} °C` : "–"} />
            <Row k="Max. heute" v={fmtPower(l?.maxPowerTodayW)} />
            <Row k="Zählerstand" v={l?.energyTotalKwh != null ? `${fmtNum(l.energyTotalKwh, 0)} kWh` : "–"} />
            <Row k="Letzter Messwert" v={fmtAgo(l?.ts, now)} />
          </dl>
        </div>
        <div className="card">
          <h2 className="card-title">PV-Strings (DC)</h2>
          <table className="table">
            <thead>
              <tr>
                <th>String</th>
                <th className="text-right">U</th>
                <th className="text-right">I</th>
                <th className="text-right">P</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {(l?.pv ?? []).map((s, i) => (
                <tr key={i}>
                  <td className="font-semibold">PV{i + 1}</td>
                  <td className="text-right">{fmtNum(s.u, 1)} V</td>
                  <td className="text-right">{fmtNum(s.i, 2)} A</td>
                  <td className="text-right">{fmtPower(s.p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2 className="card-title">Netz (AC)</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Phase</th>
                <th className="text-right">U</th>
                <th className="text-right">I</th>
                <th className="text-right">P</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {(l?.ac ?? []).map((s, i) => (
                <tr key={i}>
                  <td className="font-semibold">{["L1-L2", "L2-L3", "L3-L1"][i] ?? `L${i + 1}`}</td>
                  <td className="text-right">{fmtNum(s.u, 1)} V</td>
                  <td className="text-right">{fmtNum(s.i, 2)} A</td>
                  <td className="text-right">{fmtPower(s.p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {l?.ac?.[0]?.f != null && <p className="mt-2 text-xs text-grey">Frequenz {fmtNum(l.ac[0].f, 2)} Hz · Spannungen sind Außenleiterspannungen</p>}
        </div>
      </section>

      <section className="card mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{fmtDayLong(period.key)}</h2>
          <div className="flex items-center gap-2">
            {period.prevKey && <Link href={q(period.prevKey)} className="btn btn-sm">← {fmtDay(period.prevKey)}</Link>}
            {period.nextKey && <Link href={q(period.nextKey)} className="btn btn-sm">{fmtDay(period.nextKey)} →</Link>}
            {!period.isCurrent && <Link href={q()} className="btn btn-sm">Heute</Link>}
          </div>
        </div>
        <h3 className="card-title">Leistung AC und PV-Strings</h3>
        <LinesChart
          points={day.points.map((p) => ({ t: p.t, ac: p.acPowerW, pv1: p.pv1, pv2: p.pv2, ...(p.pv3 ? { pv3: p.pv3 } : {}) }))}
          lines={[
            { key: "ac", name: "AC gesamt", color: "#342854" },
            { key: "pv1", name: "PV1", color: "#6f45dc" },
            { key: "pv2", name: "PV2", color: "#e5532e" },
            ...(day.points.some((p) => (p.pv3 ?? 0) > 0) ? [{ key: "pv3", name: "PV3", color: "#a789f2" }] : []),
          ]}
          unit="W"
          height={260}
        />
        <h3 className="card-title mt-8">Temperatur</h3>
        <LinesChart points={day.points.map((p) => ({ t: p.t, temp: p.temperatureC }))} lines={[{ key: "temp", name: "Temperatur", color: "#e5532e" }]} unit="°C" height={180} />
        <h3 className="card-title mt-8">Statusverlauf</h3>
        {day.segments.length === 0 ? (
          <p className="text-sm text-grey">Keine Daten an diesem Tag.</p>
        ) : (
          <>
            <div className="relative h-6 w-full overflow-hidden rounded-full bg-stone-100">
              {day.segments.map((s, i) => (
                <span
                  key={i}
                  title={`${fmtTime(s.from)}–${fmtTime(s.to)}: ${modeLabel(s.mode)}`}
                  className="absolute top-0 h-full"
                  style={{
                    left: `${((s.from - dayStart!) / span) * 100}%`,
                    width: `${Math.max(0.6, ((s.to - s.from) / span) * 100)}%`,
                    background: MODE_COLOR[String(s.mode)] ?? "#d6d3d1",
                  }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-grey">
              <span>{fmtTime(dayStart!)}</span>
              <span>{fmtTime(dayEnd!)}</span>
            </div>
            <ul className="mt-3 flex flex-wrap gap-3 text-xs text-grey">
              {[3, 1, 5, 0, 9].map((m) => (
                <li key={m} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: MODE_COLOR[String(m)] }} />
                  {modeLabel(m)}
                </li>
              ))}
              <li>Lücken = keine Verbindung/Nachtruhe</li>
            </ul>
          </>
        )}
      </section>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-grey">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}
