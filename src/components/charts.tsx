"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Serienfarben mit ≥ 3:1 Kontrast zu Weiß (WCAG 1.4.11 für Grafiken)
export const SERIES_COLORS = ["#6f45dc", "#e5532e", "#342854", "#9b6cf2", "#b8432a", "#0f766e", "#a3477f", "#5b3fb8"];
const COMPARE_COLOR = "#9b82e8";
const GRID = "#ece7f6";
const TICK = { fontSize: 11, fill: "#5f5e5e" };

const nf1 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });
const eurFmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const timeFmt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });

function powerLabel(w: number) {
  return Math.abs(w) >= 1000 ? `${nf2.format(w / 1000)} kW` : `${nf1.format(w)} W`;
}

/** Einheit je nach Größenordnung (kWh/MWh). */
function energyScale(maxWh: number) {
  return maxWh >= 1_000_000 ? { div: 1_000_000, unit: "MWh" } : { div: 1000, unit: "kWh" };
}

export type Series = { id: string; name: string };

/** Legende mit An/Aus-Schaltern je Serie. */
function LegendToggles({
  series,
  hidden,
  toggle,
  extra,
}: {
  series: Series[];
  hidden: Set<string>;
  toggle: (id: string) => void;
  extra?: React.ReactNode;
}) {
  if (series.length < 2 && !extra) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {series.length > 1 &&
        series.map((s, i) => {
          const off = hidden.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              aria-pressed={!off}
              className={`chip border text-xs ${off ? "border-ink/10 text-grey line-through" : "border-transparent bg-mist text-ink"}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: off ? "#d6d3d1" : SERIES_COLORS[i % SERIES_COLORS.length] }} />
              {s.name}
            </button>
          );
        })}
      {extra}
    </div>
  );
}

function useHidden() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return { hidden, toggle };
}

// ---------------------------------------------------------------------------
// Tageskurve
// ---------------------------------------------------------------------------

export function PowerChart({
  points,
  series,
  height = 300,
}: {
  points: { t: number; sum: number; [k: string]: number }[];
  series: Series[];
  height?: number;
}) {
  const gid = useId().replace(/:/g, "");
  const { hidden, toggle } = useHidden();
  const data = useMemo(
    () =>
      points.map((p) => ({
        ...p,
        visibleSum: series.reduce((a, s) => a + (hidden.has(s.id) ? 0 : (p[s.id] ?? 0)), 0),
      })),
    [points, series, hidden],
  );
  if (points.length === 0) return <EmptyChart text="Für diesen Tag liegen keine Messwerte vor." />;
  const multi = series.length > 1;
  return (
    <div>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#855ced" stopOpacity={0.55} />
                <stop offset="70%" stopColor="#ff7049" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#ff7049" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id={`stroke-${gid}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6f45dc" />
                <stop offset="100%" stopColor="#e5532e" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t: number) => timeFmt.format(new Date(t))}
              tick={TICK}
              axisLine={false}
              tickLine={false}
              minTickGap={36}
            />
            <YAxis tickFormatter={(w: number) => powerLabel(w)} tick={TICK} width={66} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 16, border: "1px solid #ece7f6", boxShadow: "0 8px 30px -12px rgba(52,40,84,.3)" }}
              labelFormatter={(t) => `${timeFmt.format(new Date(Number(t)))} Uhr`}
              formatter={(v, name) => [
                powerLabel(Number(v)),
                name === "visibleSum" ? "Summe" : (series.find((s) => s.id === name)?.name ?? String(name)),
              ]}
            />
            <Area
              type="monotone"
              dataKey="visibleSum"
              name="visibleSum"
              stroke={`url(#stroke-${gid})`}
              strokeWidth={2.5}
              fill={`url(#fill-${gid})`}
              isAnimationActive={false}
            />
            {multi &&
              series.map((s, i) =>
                hidden.has(s.id) ? null : (
                  <Area
                    key={s.id}
                    type="monotone"
                    dataKey={s.id}
                    name={s.id}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={1.25}
                    strokeDasharray="4 3"
                    fill="none"
                    isAnimationActive={false}
                  />
                ),
              )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <LegendToggles
        series={series}
        hidden={hidden}
        toggle={toggle}
        extra={
          multi ? (
            <span className="chip text-xs text-grey">
              <span className="h-0.5 w-5 rounded bg-brand-deep" /> Summe (Fläche)
            </span>
          ) : null
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ertragsbalken (Monat/Jahr/Gesamt) mit Vergleich und kWh/€-Umschalter
// ---------------------------------------------------------------------------

export type ChartBar = {
  key: string;
  label: string;
  wh: number;
  compareWh: number | null;
  selfEur: number;
  feedEur: number;
  byInverter: Record<string, number>;
};

export function EnergyChart({
  bars,
  series,
  highlightKey,
  compareLabel,
  drill,
  allowEur,
  height = 280,
}: {
  bars: ChartBar[];
  series: Series[];
  highlightKey?: string;
  compareLabel?: string;
  /** Balken-Key → Link (Drill-down) */
  drill?: Record<string, string>;
  allowEur: boolean;
  height?: number;
}) {
  const router = useRouter();
  const { hidden, toggle } = useHidden();
  const [unit, setUnit] = useState<"kwh" | "eur">("kwh");
  const [showCompare, setShowCompare] = useState(true);
  const visible = series.filter((s) => !hidden.has(s.id));
  const multi = series.length > 1;
  const hasCompare = !!compareLabel && bars.some((b) => (b.compareWh ?? 0) > 0);

  const maxWh = Math.max(1, ...bars.map((b) => Math.max(b.wh, b.compareWh ?? 0)));
  const sc = energyScale(maxWh);
  const data = bars.map((b) => {
    const row: Record<string, number | string> = { key: b.key, label: b.label };
    if (unit === "eur") {
      row.self = Math.round(b.selfEur * 100) / 100;
      row.feed = Math.round(b.feedEur * 100) / 100;
    } else {
      if (multi) for (const s of series) row[s.id] = (b.byInverter[s.id] ?? 0) / sc.div;
      else row.total = b.wh / sc.div;
      row.compare = (b.compareWh ?? 0) / sc.div;
    }
    return row;
  });

  if (bars.every((b) => b.wh === 0) && !hasCompare) return <EmptyChart text="Noch keine Erträge in diesem Zeitraum." />;

  const onClick = (state: unknown) => {
    const key = (state as { activePayload?: { payload?: { key?: string } }[] })?.activePayload?.[0]?.payload?.key;
    if (key && drill?.[key]) router.push(drill[key]);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
        {hasCompare && unit === "kwh" && (
          <label className="chip cursor-pointer text-xs text-grey">
            <input type="checkbox" checked={showCompare} onChange={(e) => setShowCompare(e.target.checked)} className="accent-[#855ced]" />
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COMPARE_COLOR }} /> {compareLabel}
          </label>
        )}
        {allowEur && (
          <div className="inline-flex rounded-full bg-mist p-0.5 text-xs font-semibold" role="group" aria-label="Einheit">
            {(["kwh", "eur"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                aria-pressed={unit === u}
                className={`rounded-full px-3 py-1 transition ${unit === u ? "bg-white text-purple-600 shadow-sm" : "text-ink-soft"}`}
              >
                {u === "kwh" ? "kWh" : "€"}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} onClick={onClick} barGap={2}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={2} />
            <YAxis
              tick={TICK}
              width={52}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => (unit === "eur" ? `${nf1.format(v)} €` : nf1.format(v))}
            />
            <Tooltip
              cursor={{ fill: "#f0ecf8" }}
              contentStyle={{ borderRadius: 16, border: "1px solid #ece7f6", boxShadow: "0 8px 30px -12px rgba(52,40,84,.3)" }}
              formatter={(v, name) => {
                const n = Number(v);
                if (unit === "eur") return [eurFmt.format(n), name === "self" ? "Ersparnis Eigenverbrauch" : "Einspeisevergütung"];
                const label =
                  name === "compare" ? compareLabel : name === "total" ? "Ertrag" : (series.find((s) => s.id === name)?.name ?? String(name));
                return [`${nf2.format(n)} ${sc.unit}`, label];
              }}
            />
            {unit === "kwh" && hasCompare && showCompare && (
              <Bar dataKey="compare" fill={COMPARE_COLOR} radius={[6, 6, 0, 0]} isAnimationActive={false} maxBarSize={22} />
            )}
            {unit === "eur" ? (
              <>
                <Bar dataKey="self" stackId="e" fill="#6f45dc" isAnimationActive={false} maxBarSize={28} />
                <Bar dataKey="feed" stackId="e" fill="#e5532e" radius={[6, 6, 0, 0]} isAnimationActive={false} maxBarSize={28} />
              </>
            ) : multi ? (
              visible.map((s, i) => (
                <Bar
                  key={s.id}
                  dataKey={s.id}
                  stackId="wh"
                  fill={SERIES_COLORS[series.indexOf(s) % SERIES_COLORS.length]}
                  radius={i === visible.length - 1 ? [6, 6, 0, 0] : 0}
                  isAnimationActive={false}
                  maxBarSize={28}
                  cursor={drill ? "pointer" : undefined}
                />
              ))
            ) : (
              <Bar dataKey="total" radius={[6, 6, 0, 0]} isAnimationActive={false} maxBarSize={28} cursor={drill ? "pointer" : undefined}>
                {data.map((d) => (
                  <Cell key={String(d.key)} fill={d.key === highlightKey ? "#e5532e" : "#6f45dc"} />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LegendToggles series={unit === "kwh" ? series : []} hidden={hidden} toggle={toggle} />
        <p className="mt-2 text-[11px] text-grey">
          {unit === "eur" ? (
            <>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-purple-600" />Ersparnis
              <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-sm bg-[#e5532e]" />Einspeisung · Schätzung
            </>
          ) : (
            <>Werte in {sc.unit}{drill ? " · Balken antippen für Details" : ""}</>
          )}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wechselrichter-Detail: PV-Strings, Temperatur
// ---------------------------------------------------------------------------

export function LinesChart({
  points,
  lines,
  unit,
  height = 220,
}: {
  points: Record<string, number | null>[];
  lines: { key: string; name: string; color: string }[];
  unit: "W" | "°C";
  height?: number;
}) {
  if (points.length === 0) return <EmptyChart text="Keine Messwerte an diesem Tag." />;
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) => timeFmt.format(new Date(t))}
            tick={TICK}
            axisLine={false}
            tickLine={false}
            minTickGap={36}
          />
          <YAxis
            tick={TICK}
            width={60}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => (unit === "W" ? powerLabel(v) : `${nf1.format(v)} °C`)}
          />
          <Tooltip
            contentStyle={{ borderRadius: 16, border: "1px solid #ece7f6" }}
            labelFormatter={(t) => `${timeFmt.format(new Date(Number(t)))} Uhr`}
            formatter={(v, name) => [
              unit === "W" ? powerLabel(Number(v)) : `${nf1.format(Number(v))} °C`,
              lines.find((l) => l.key === name)?.name ?? String(name),
            ]}
          />
          {lines.map((l) => (
            <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-3xl border border-dashed border-lilac bg-mist/40 px-4 text-center text-sm text-grey">
      {text}
    </div>
  );
}
