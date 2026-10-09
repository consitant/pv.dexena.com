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

  const kpiSavings = k.hasTariff;
  return (
    <div className="space-y-5 sm:space-y-8">
      {p.view === "day" && p.isCurrent && <AutoRefresh intervalS={60} />}

      {/* 1. Leistung + Kennzahlen */}
      <section className="grid gap-3 sm:gap-4 lg:grid-cols-[1.1fr_1.9fr]">
        <div className="relative overflow-hidden rounded-[24px] bg-brand-deep p-5 text-white shadow-[0_20px_60px_-20px_rgba(111,69,220,0.7)] sm:rounded-[40px] sm:p-8">
          <WireSphere size={260} color="#ff7049" lines={16} tilt={20} className="absolute -right-14 -top-16 h-auto w-36 opacity-50 sm:-right-16 sm:-top-20 sm:w-[260px] sm:opacity-80" />
          <WireSphere size={120} color="#cdb9ff" lines={10} tilt={-25} className="absolute -bottom-10 right-24 hidden opacity-60 sm:block" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-white/90 sm:text-sm">Aktuelle Leistung</p>
            <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight sm:mt-2 sm:text-6xl">{fmtPower(k.powerW)}</p>
            <p className="mt-1 text-sm text-white/90 sm:mt-2">
              {util !== null ? `${util} % von ${fmtNum(k.kwp, 1)} kWp` : `${data.inverters.length} Wechselrichter`}
            </p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur sm:mt-6">
              <span className={`h-2 w-2 rounded-full ${anyFault ? "bg-orange-300" : allNight ? "bg-white/50" : "bg-emerald-300"}`} />
              {anyFault ? "Ein Wechselrichter meldet sich nicht" : allNight ? "Nachtruhe" : "Alle Wechselrichter in Betrieb"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <Kpi label="Heute" value={fmtEnergyWh(k.todayWh)} />
          <Kpi label="Dieser Monat" value={fmtEnergyWh(k.monthWh)} />
          <Kpi label="Dieses Jahr" value={fmtEnergyWh(k.yearWh)} />
          <Kpi label="Gesamtertrag" value={fmtKwh(k.totalKwh)} sub="laut Zählerstand" />
          <Kpi label="CO₂ vermieden" value={`ca. ${fmtNum(k.co2Kg / 1000, 1)} t`} sub="0,38 kg je kWh" />
          <Kpi
            label="Spez. Ertrag"
            value={k.specificYieldYear !== null ? `${fmtNum(k.specificYieldYear, 0)} kWh/kWp` : "–"}
            sub={k.specificYieldYear !== null ? "laufendes Jahr" : "Leistung fehlt"}
          />
        </div>
      </section>

      {/* 2. Zeitraum */}
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

        <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
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
                allowEur={false}
              />
            )}
          </div>
          <aside className="grid grid-cols-2 content-start gap-2 sm:gap-3 lg:grid-cols-1">
            <Stat label={p.view === "day" ? "Tagesertrag" : "Ertrag im Zeitraum"} value={fmtEnergyWh(data.periodWh)} big wide />
            {p.view === "day" && <Stat label="Spitze (5-min)" value={data.peakW !== null ? fmtPower(data.peakW) : "–"} />}
            {data.delta && p.view !== "day" && (
              <Stat
                label={`ggü. ${p.view === "month" ? "Vormonat" : "Vorjahr"}${data.compareToDate ? " (gl. Zeitraum)" : ""}`}
                value={`${data.delta.wh >= 0 ? "+" : "−"}${fmtEnergyWh(Math.abs(data.delta.wh))}`}
                sub={data.delta.pct !== null ? fmtPct(data.delta.pct) : "kein Vergleichswert"}
                tone={data.delta.wh >= 0 ? "up" : "down"}
              />
            )}
            {data.best && p.view === "month" && <Stat label="Bester Tag" value={fmtEnergyWh(data.best.wh)} sub={fmtDay(data.best.key)} />}
            {data.best && p.view === "year" && <Stat label="Bester Monat" value={fmtEnergyWh(data.best.wh)} sub={fmtMonth(data.best.key)} />}
            {data.best && p.view === "total" && <Stat label="Bestes Jahr" value={fmtEnergyWh(data.best.wh)} sub={data.best.key} />}
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
            {p.view === "day" && data.dayStats.length === 1 && <Stat label="Max. Leistung" value={fmtPower(data.dayStats[0].maxPowerW)} />}
            <a href={`/api/export?${exportQuery.toString()}`} className="btn col-span-2 min-h-11 lg:col-span-1" download>
              CSV exportieren
            </a>
          </aside>
        </div>
      </section>

      {/* 3. Ertragskalender + Vergleich */}
      {(p.view === "month" || p.view === "year") && (
        <section className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="card min-w-0">
            <h2 className="card-title">Ertragskalender</h2>
            {p.view === "month" ? (
              <MonthHeatmap month={p.start} values={heatValues} today={data.today} hrefFor={(d) => href({ view: "day", date: d })} />
            ) : (
              <YearHeatmap year={p.key} values={heatValues} today={data.today} hrefFor={(d) => href({ view: "day", date: d })} />
            )}
          </div>
          <CompareCard data={data} />
        </section>
      )}

      {/* 4. Wechselrichter */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4 sm:gap-3">
          <h2 className="text-lg font-bold sm:text-xl">Wechselrichter</h2>
          {scope.all.length > 1 && (
            <div className="-mx-1 flex w-full gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" aria-label="Wechselrichter filtern">
              <Link
                href={href({ inv: [] })}
                className={`chip min-h-11 shrink-0 border sm:min-h-0 ${ctx.inverterIds.length === 0 ? "border-transparent bg-ink text-white" : "border-ink/10 text-ink-soft hover:border-purple-600"}`}
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
                    className={`chip min-h-11 shrink-0 whitespace-nowrap border sm:min-h-0 ${on ? "border-transparent bg-purple-600 text-white" : "border-ink/10 text-ink-soft hover:border-purple-600"}`}
                  >
                    {i.name ?? i.ref}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          {data.inverters.map((inv) => (
            <article key={inv.id} className="card">
              <header className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold sm:text-lg">{inv.name ?? inv.ref}</h3>
                  <p className="truncate text-xs text-grey">
                    {[inv.model, inv.siteName, inv.name ? inv.ref : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <StatusBadge status={inv.status} />
              </header>
              <dl className="grid grid-cols-3 gap-2">
                <MiniStat label="Leistung" value={fmtPower(inv.powerW)} />
                <MiniStat label="Heute" value={fmtEnergyWh(inv.todayWh)} />
                <MiniStat label="Temp." value={inv.latest?.temperatureC != null ? `${fmtNum(inv.latest.temperatureC, 0)} °C` : "–"} />
              </dl>
              {inv.latest?.pv && inv.status !== "offline" && inv.status !== "night" && (
                <div className="mt-3 hidden flex-wrap gap-2 text-xs sm:flex">
                  {inv.latest.pv
                    .filter((s, i) => i < 2 || s.p > 0)
                    .map((s, i) => (
                      <span key={i} className="rounded-2xl bg-mist px-3 py-1.5">
                        <strong>PV{i + 1}</strong> {fmtNum(s.u, 0)} V · {fmtNum(s.i, 2)} A · {fmtPower(s.p)}
                      </span>
                    ))}
                </div>
              )}
              <footer className="mt-3 flex items-center justify-between gap-2 text-xs text-grey sm:mt-4">
                <span>Messwert {fmtAgo(inv.latest?.ts)}</span>
                <Link href={detailHref(ctx, inv.id, p.view === "day" ? p.key : null)} className="link inline-flex min-h-11 items-center sm:min-h-0">
                  Details →
                </Link>
              </footer>
            </article>
          ))}
        </div>
      </section>

      {/* 5. Ersparnis & Vergütung (Schätzung) */}
      <section className="card">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 sm:mb-4">
          <h2 className="card-title mb-0">Ersparnis & Vergütung</h2>
          <span className="text-xs text-grey">Schätzung auf Basis der angegebenen Eigenverbrauchsquote</span>
        </div>
        {kpiSavings ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
              <MoneyTile label="Heute" m={k.money.today} />
              <MoneyTile label="Dieser Monat" m={k.money.month} />
              <MoneyTile label="Dieses Jahr" m={k.money.year} />
              <MoneyTile label="Gesamt" m={k.money.total} />
            </div>
            {p.view !== "day" && (
              <div className="mt-5 sm:mt-6">
                <p className="mb-2 text-sm font-semibold">
                  {title}: {fmtEur(roundEur(data.periodMoney.selfEur + data.periodMoney.feedEur))}
                </p>
                <EnergyChart bars={data.bars} series={series} drill={drill} allowEur unitLocked="eur" height={220} />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-mist px-4 py-3 text-sm sm:px-5 sm:py-4">
            <span>Noch kein Strompreis hinterlegt – die Ersparnis kann erst mit Bezugspreis und Einspeisevergütung berechnet werden.</span>
            {ctx.settingsHref && (
              <Link href={ctx.settingsHref} className="btn btn-primary btn-sm min-h-11 sm:min-h-0">
                Strompreis eintragen
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/** Vergleich mit Vormonat/Vorjahr als horizontale Balken. */
function CompareCard({ data }: { data: PeriodData }) {
  const p = data.period;
  const label = p.view === "month" ? "Vormonat" : "Vorjahr";
  const curLabel = p.view === "month" ? fmtMonth(p.key) : p.key;
  const cmpLabel = p.view === "month" ? fmtMonth(p.compare!.key) : p.compare!.key;
  const rows = [
    { label: data.compareToDate ? `${curLabel} bis heute` : curLabel, wh: data.periodWh, strong: true },
    ...(data.compareToDate
      ? [{ label: `${cmpLabel} bis zum gleichen Tag`, wh: data.compareWh ?? 0, strong: false }]
      : []),
    { label: `${cmpLabel} gesamt`, wh: data.compareFullWh ?? 0, strong: false },
  ];
  const max = Math.max(1, ...rows.map((r) => r.wh));
  return (
    <div className="card">
      <h2 className="card-title">Vergleich mit {label}</h2>
      <ul className="space-y-4">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className={r.strong ? "font-bold" : "text-ink-soft"}>{r.label}</span>
              <span className="font-bold tabular-nums">{fmtEnergyWh(r.wh)}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-mist" aria-hidden>
              <div
                className={`h-full rounded-full ${r.strong ? "bg-brand-deep" : "bg-[#9b82e8]"}`}
                style={{ width: `${Math.max(2, (r.wh / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      {data.delta && (
        <p className={`mt-5 rounded-2xl px-4 py-3 text-sm font-semibold ${data.delta.wh >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-orange/10 text-orange-700"}`}>
          {data.delta.wh >= 0 ? "▲" : "▼"} {fmtEnergyWh(Math.abs(data.delta.wh))}
          {data.delta.pct !== null ? ` (${fmtPct(data.delta.pct)})` : ""} {data.compareToDate ? "ggü. gleichem Zeitraum" : `ggü. ${label}`}
        </p>
      )}
      {data.best && (
        <p className="mt-3 text-sm text-ink-soft">
          {p.view === "month" ? `Bester Tag: ${fmtDay(data.best.key)}` : `Bester Monat: ${fmtMonth(data.best.key)}`} mit{" "}
          <strong className="text-ink">{fmtEnergyWh(data.best.wh)}</strong>
        </p>
      )}
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
    <div className="rounded-[20px] bg-mist/70 px-3 py-2.5 sm:rounded-[32px] sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft sm:text-[11px]">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums leading-tight tracking-tight sm:mt-1 sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-grey">{sub}</p>}
    </div>
  );
}

function MoneyTile({ label, m }: { label: string; m: Money }) {
  return (
    <div className="rounded-[20px] border border-ink/5 bg-hero px-3 py-2.5 sm:rounded-[32px] sm:p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-purple-600 sm:text-2xl">
        {fmtEur(roundEur(m.selfEur + m.feedEur))}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-grey">
        Eigenverbrauch {fmtEur(roundEur(m.selfEur))}
        <br />
        Einspeisung {fmtEur(roundEur(m.feedEur))}
        {m.unpricedWh > 0 && (
          <>
            <br />
            <span className="text-orange-700">{fmtEnergyWh(m.unpricedWh)} ohne Tarif</span>
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
  wide,
  tone,
  dot,
}: {
  label: string;
  value: string;
  sub?: string;
  big?: boolean;
  wide?: boolean;
  tone?: "up" | "down";
  dot?: string;
}) {
  return (
    <div className={`rounded-[20px] bg-mist/70 px-3 py-2.5 sm:rounded-3xl sm:px-4 sm:py-3 ${wide ? "col-span-2 lg:col-span-1" : ""}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft">
        {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
        {label}
      </p>
      <p className={`font-bold tabular-nums ${big ? "text-xl sm:text-2xl" : "text-base sm:text-lg"} ${tone === "up" ? "text-emerald-700" : tone === "down" ? "text-orange-700" : ""}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-grey">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-mist/70 px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft">{label}</dt>
      <dd className="text-sm font-bold tabular-nums">{value}</dd>
    </div>
  );
}
