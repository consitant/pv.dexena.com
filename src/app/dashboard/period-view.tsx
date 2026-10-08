import Link from "next/link";
import type { PeriodData, Scope } from "@/lib/dashboard";
import { roundEur, type Money } from "@/lib/money";
import type { View } from "@/lib/period";
import {
  fmtDay,
  fmtDayLong,
  fmtEnergyWh,
  fmtEur,
  fmtKwh,
  fmtMonth,
  fmtNum,
  fmtPct,
  fmtPower,
  fmtAgo,
} from "@/lib/format";
import { EnergyChart, PowerChart, SERIES_COLORS } from "@/components/charts";
import { EnergyFlow } from "@/components/energy-flow";
import { MonthHeatmap, YearHeatmap } from "@/components/heatmap";
import { PeriodNav } from "@/components/period-nav";
import { StatusBadge } from "@/components/status-badge";
import { WireSphere } from "@/components/wire-sphere";
import { AutoRefresh } from "@/components/auto-refresh";

export type ViewCtx = {
  /** Basis-Pfad der Seite, z. B. /dashboard oder /dashboard/sites/<id> */
  basePath: string;
  /** Admin-Kontext: customer-Parameter weiterreichen */
  customerParam: string | null;
  inverterIds: string[];
  settingsHref: string | null;
};

type HrefOpts = { view?: View; date?: string | null; inv?: string[] };

export function makeHref(ctx: ViewCtx, current: { view: View; key: string }) {
  return (o: HrefOpts = {}, path = ctx.basePath) => {
    const q = new URLSearchParams();
    if (ctx.customerParam) q.set("customer", ctx.customerParam);
    const view = o.view ?? current.view;
    if (view !== "day") q.set("view", view);
    const date = o.date === undefined ? (o.view && o.view !== current.view ? null : current.key) : o.date;
    if (date && view !== "total") q.set("date", date);
    const inv = o.inv ?? ctx.inverterIds;
    if (inv.length) q.set("inv", inv.join(","));
    const s = q.toString();
    return `${path}${s ? `?${s}` : ""}`;
  };
}

export function PeriodView({ data, scope, ctx }: { data: PeriodData; scope: Scope; ctx: ViewCtx }) {
  const p = data.period;
  const href = makeHref(ctx, { view: p.view, key: p.key });
  const series = scope.selected.map((i) => ({ id: i.id, name: i.name ?? i.ref }));
  const k = data.kpis;
  const util = k.kwp ? Math.round((k.powerW / (k.kwp * 1000)) * 100) : null;
  const title =
    p.view === "day" ? fmtDayLong(p.key) : p.view === "month" ? fmtMonth(p.key) : p.view === "year" ? p.key : "Gesamte Laufzeit";
  const firstYear = Number((data.bars[0]?.key ?? data.today).slice(0, 4)) || Number(data.today.slice(0, 4));
  const drill: Record<string, string> = {};
  for (const b of data.bars) {
    if (p.view === "month") drill[b.key] = href({ view: "day", date: b.key });
    if (p.view === "year") drill[b.key] = href({ view: "month", date: b.key });
    if (p.view === "total") drill[b.key] = href({ view: "year", date: b.key });
  }
  const heatValues = new Map(data.heat.map((h) => [h.day, h.wh]));
  const exportQuery = new URLSearchParams();
  if (ctx.customerParam) exportQuery.set("customer", ctx.customerParam);
  if (scope.site) exportQuery.set("site", scope.site.id);
  exportQuery.set("view", p.view);
  exportQuery.set("date", p.key);
  if (ctx.inverterIds.length) exportQuery.set("inv", ctx.inverterIds.join(","));
  const statuses = data.inverters.map((i) => i.status);
  const anyFault = statuses.some((s) => s === "error" || s === "offline");
  const allNight = statuses.length > 0 && statuses.every((s) => s === "night");

  return (
    <div className="space-y-6 sm:space-y-8">
      {p.view === "day" && p.isCurrent && <AutoRefresh intervalS={60} />}

      {/* Hero + Kennzahlen */}
      <section className="grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
        <div className="relative overflow-hidden rounded-[28px] bg-brand p-6 text-white shadow-[0_20px_60px_-20px_rgba(133,92,237,0.7)] sm:rounded-[40px] sm:p-8">
          <WireSphere size={260} color="#ff7049" lines={16} tilt={20} className="absolute -right-16 -top-20 opacity-80" />
          <WireSphere size={120} color="#cdb9ff" lines={10} tilt={-25} className="absolute -bottom-10 right-24 opacity-60" />
          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-white/75">Aktuelle Leistung</p>
            <p className="mt-2 text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">{fmtPower(k.powerW)}</p>
            <p className="mt-2 text-sm text-white/80">
              {util !== null ? `${util} % der installierten ${fmtNum(k.kwp, 1)} kWp` : `${data.inverters.length} Wechselrichter`}
            </p>
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              <span className={`h-2 w-2 rounded-full ${anyFault ? "bg-orange-300" : allNight ? "bg-white/50" : "bg-emerald-300"}`} />
              {anyFault ? "Mindestens ein Wechselrichter meldet sich nicht" : allNight ? "Nachtruhe" : "Alle Wechselrichter in Betrieb"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label="Heute" value={fmtEnergyWh(k.todayWh)} />
          <Kpi label="Dieser Monat" value={fmtEnergyWh(k.monthWh)} />
          <Kpi label="Dieses Jahr" value={fmtEnergyWh(k.yearWh)} />
          <Kpi label="Gesamtertrag" value={fmtKwh(k.totalKwh)} sub="laut Zählerstand" />
          <Kpi label="CO₂ vermieden" value={`ca. ${fmtNum(k.co2Kg / 1000, 1)} t`} sub="0,38 kg je kWh" />
          <Kpi
            label="Spez. Ertrag"
            value={k.specificYieldYear !== null ? `${fmtNum(k.specificYieldYear, 0)} kWh/kWp` : "–"}
            sub={k.specificYieldYear !== null ? "im laufenden Jahr" : "Leistung nicht hinterlegt"}
          />
        </div>
      </section>

      {/* Ersparnis */}
      <section className="card">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="card-title mb-0">Ersparnis & Vergütung</h2>
          <span className="text-xs text-grey">Schätzung auf Basis der angegebenen Eigenverbrauchsquote</span>
        </div>
        {k.hasTariff ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MoneyTile label="Heute" m={k.money.today} />
            <MoneyTile label="Dieser Monat" m={k.money.month} />
            <MoneyTile label="Dieses Jahr" m={k.money.year} />
            <MoneyTile label="Gesamt" m={k.money.total} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-mist px-5 py-4 text-sm">
            <span>Noch kein Strompreis hinterlegt – die Ersparnis kann erst mit Bezugspreis und Einspeisevergütung berechnet werden.</span>
            {ctx.settingsHref && (
              <Link href={ctx.settingsHref} className="btn btn-primary btn-sm">
                Strompreis eintragen
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Zeitraum */}
      <section className="card">
        <PeriodNav
          view={p.view}
          periodKey={p.key}
          title={p.view === "day" ? fmtDay(p.key) : title}
          tabs={(["day", "month", "year", "total"] as View[]).map((v) => ({ view: v, href: href({ view: v, date: null }) }))}
          prevHref={p.prevKey ? href({ date: p.prevKey }) : null}
          nextHref={p.nextKey ? href({ date: p.nextKey }) : null}
          todayHref={p.isCurrent ? null : href({ date: null })}
          pickerBase={pickerBase(ctx)}
          firstYear={Math.min(firstYear, Number(data.today.slice(0, 4)))}
          currentYear={Number(data.today.slice(0, 4))}
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="min-w-0">
            {p.view === "day" ? (
              <PowerChart points={data.curve} series={series} />
            ) : (
              <EnergyChart
                bars={data.bars}
                series={series}
                highlightKey={p.view === "month" ? data.today : p.view === "year" ? data.today.slice(0, 7) : data.today.slice(0, 4)}
                compareLabel={p.view === "month" ? "Vormonat" : p.view === "year" ? "Vorjahr" : undefined}
                drill={drill}
                allowEur={k.hasTariff}
              />
            )}
          </div>
          <aside className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Stat label={p.view === "day" ? "Tagesertrag" : "Ertrag im Zeitraum"} value={fmtEnergyWh(data.periodWh)} big />
            {p.view === "day" && (
              <Stat label="Spitze (5-min-Mittel)" value={data.peakW !== null ? fmtPower(data.peakW) : "–"} />
            )}
            {data.delta && p.view !== "day" && (
              <Stat
                label={`ggü. ${p.view === "month" ? "Vormonat" : "Vorjahr"} ${data.compareToDate ? "(gleicher Zeitraum)" : "gesamt"}`}
                value={`${data.delta.wh >= 0 ? "+" : "−"}${fmtEnergyWh(Math.abs(data.delta.wh))}`}
                sub={data.delta.pct !== null ? fmtPct(data.delta.pct) : "kein Vergleichswert"}
                tone={data.delta.wh >= 0 ? "up" : "down"}
              />
            )}
            {data.best && p.view === "month" && <Stat label="Bester Tag" value={fmtEnergyWh(data.best.wh)} sub={fmtDay(data.best.key)} />}
            {data.best && p.view === "year" && <Stat label="Bester Monat" value={fmtEnergyWh(data.best.wh)} sub={fmtMonth(data.best.key)} />}
            {data.best && p.view === "total" && <Stat label="Bestes Jahr" value={fmtEnergyWh(data.best.wh)} sub={data.best.key} />}
            {k.hasTariff && p.view !== "day" && (
              <Stat label="Ersparnis + Vergütung" value={fmtEur(roundEur(data.periodMoney.selfEur + data.periodMoney.feedEur))} sub="Schätzung" />
            )}
            {p.view === "day" &&
              data.dayStats.length > 1 &&
              data.dayStats.map((s, i) => {
                const inv = scope.selected.find((x) => x.id === s.inverterId);
                return (
                  <Stat
                    key={s.inverterId}
                    label={inv?.name ?? inv?.ref ?? ""}
                    value={fmtEnergyWh(s.wh)}
                    sub={`max. ${fmtPower(s.maxPowerW)}`}
                    dot={SERIES_COLORS[i % SERIES_COLORS.length]}
                  />
                );
              })}
            {p.view === "day" && data.dayStats.length === 1 && (
              <Stat label="Max. Leistung" value={fmtPower(data.dayStats[0].maxPowerW)} />
            )}
            <a href={`/api/export?${exportQuery.toString()}`} className="btn mt-1 sm:col-span-2 lg:col-span-1" download>
              CSV exportieren
            </a>
          </aside>
        </div>
      </section>

      {/* Kalender + Energiefluss */}
      {(p.view === "month" || p.view === "year" || data.periodWh > 0) && (
        <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          {(p.view === "month" || p.view === "year") && (
            <div className="card">
              <h2 className="card-title">Ertragskalender</h2>
              {p.view === "month" ? (
                <MonthHeatmap month={p.start} values={heatValues} today={data.today} hrefFor={(d) => href({ view: "day", date: d })} />
              ) : (
                <YearHeatmap year={p.key} values={heatValues} today={data.today} hrefFor={(d) => href({ view: "day", date: d })} />
              )}
            </div>
          )}
          {data.periodWh > 0 && (
            <div className={`card ${p.view === "day" || p.view === "total" ? "lg:col-span-2 lg:max-w-xl" : ""}`}>
              <h2 className="card-title">Energiefluss im Zeitraum</h2>
              <EnergyFlow {...data.flow} />
            </div>
          )}
        </section>
      )}

      {/* Wechselrichter */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Wechselrichter</h2>
          {scope.all.length > 1 && (
            <div className="flex flex-wrap items-center gap-2" aria-label="Wechselrichter filtern">
              <Link
                href={href({ inv: [] })}
                className={`chip border ${ctx.inverterIds.length === 0 ? "border-transparent bg-ink text-white" : "border-ink/10 text-ink/70 hover:border-purple"}`}
              >
                Alle
              </Link>
              {scope.all.map((i) => {
                const on = ctx.inverterIds.includes(i.id);
                const next = on ? ctx.inverterIds.filter((x) => x !== i.id) : [...ctx.inverterIds, i.id];
                return (
                  <Link
                    key={i.id}
                    href={href({ inv: next.length === scope.all.length ? [] : next })}
                    aria-pressed={on}
                    className={`chip border ${on ? "border-transparent bg-purple text-white" : "border-ink/10 text-ink/70 hover:border-purple"}`}
                  >
                    {i.name ?? i.ref}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {data.inverters.map((inv) => (
            <article key={inv.id} className="card">
              <header className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold">{inv.name ?? inv.ref}</h3>
                  <p className="truncate text-xs text-grey">
                    {[inv.model, inv.siteName, inv.name ? inv.ref : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <StatusBadge status={inv.status} />
              </header>
              <dl className="grid grid-cols-3 gap-2">
                <MiniStat label="Leistung" value={fmtPower(inv.powerW)} />
                <MiniStat label="Heute" value={fmtEnergyWh(inv.todayWh)} />
                <MiniStat label="Temperatur" value={inv.latest?.temperatureC != null ? `${fmtNum(inv.latest.temperatureC, 0)} °C` : "–"} />
              </dl>
              {inv.latest?.pv && inv.status !== "offline" && inv.status !== "night" && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {inv.latest.pv
                    .filter((s, i) => i < 2 || s.p > 0)
                    .map((s, i) => (
                      <span key={i} className="rounded-2xl bg-mist px-3 py-1.5">
                        <strong>PV{i + 1}</strong> {fmtNum(s.u, 0)} V · {fmtNum(s.i, 2)} A · {fmtPower(s.p)}
                      </span>
                    ))}
                </div>
              )}
              <footer className="mt-4 flex items-center justify-between gap-2 text-xs text-grey">
                <span>Letzter Messwert {fmtAgo(inv.latest?.ts)}</span>
                <Link href={detailHref(ctx, inv.id, p.view === "day" ? p.key : null)} className="link">
                  Details →
                </Link>
              </footer>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function pickerBase(ctx: ViewCtx) {
  const q = new URLSearchParams();
  if (ctx.customerParam) q.set("customer", ctx.customerParam);
  if (ctx.inverterIds.length) q.set("inv", ctx.inverterIds.join(","));
  const s = q.toString();
  return `${ctx.basePath}${s ? `?${s}` : ""}`;
}

function detailHref(ctx: ViewCtx, inverterId: string, day: string | null) {
  const q = new URLSearchParams();
  if (ctx.customerParam) q.set("customer", ctx.customerParam);
  if (day) q.set("date", day);
  const s = q.toString();
  return `/dashboard/inverters/${inverterId}${s ? `?${s}` : ""}`;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[24px] bg-mist/70 p-4 sm:rounded-[32px] sm:p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink/55">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums tracking-tight sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-grey">{sub}</p>}
    </div>
  );
}

function MoneyTile({ label, m }: { label: string; m: Money }) {
  return (
    <div className="rounded-[24px] border border-ink/5 bg-hero p-4 sm:rounded-[32px]">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink/55">{label}</p>
      <p className="mt-1 bg-brand bg-clip-text text-xl font-bold tabular-nums text-transparent sm:text-2xl">
        {fmtEur(roundEur(m.selfEur + m.feedEur))}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-grey">
        Eigenverbrauch {fmtEur(roundEur(m.selfEur))}
        <br />
        Einspeisung {fmtEur(roundEur(m.feedEur))}
        {m.unpricedWh > 0 && (
          <>
            <br />
            <span className="text-orange">{fmtEnergyWh(m.unpricedWh)} ohne Tarif</span>
          </>
        )}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  big,
  tone,
  dot,
}: {
  label: string;
  value: string;
  sub?: string;
  big?: boolean;
  tone?: "up" | "down";
  dot?: string;
}) {
  return (
    <div className="rounded-3xl bg-mist/70 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink/55">
        {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
        {label}
      </p>
      <p className={`font-bold tabular-nums ${big ? "text-2xl" : "text-lg"} ${tone === "up" ? "text-emerald-700" : tone === "down" ? "text-orange" : ""}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-grey">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-mist/70 px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink/55">{label}</dt>
      <dd className="text-sm font-bold tabular-nums">{value}</dd>
    </div>
  );
}
