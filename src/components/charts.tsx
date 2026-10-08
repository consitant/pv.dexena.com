"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#f59e0b", "#0ea5e9", "#10b981", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#6366f1"];

const timeFmt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
const nf = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

function kw(w: number) {
  return w >= 1000 ? `${nf.format(w / 1000)} kW` : `${nf.format(w)} W`;
}
function kwh(wh: number) {
  return `${nf.format(wh / 1000)} kWh`;
}

export type CurveSeries = { id: string; name: string };

export function DayCurveChart({
  points,
  series,
}: {
  points: { t: number; [k: string]: number }[];
  series: CurveSeries[];
}) {
  if (points.length === 0) {
    return <EmptyChart text="Für diesen Tag liegen keine Messwerte vor." />;
  }
  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) => timeFmt.format(new Date(t))}
            tick={{ fontSize: 11, fill: "#78716c" }}
            minTickGap={30}
          />
          <YAxis tickFormatter={(w: number) => kw(w)} tick={{ fontSize: 11, fill: "#78716c" }} width={64} />
          <Tooltip
            labelFormatter={(t) => `${timeFmt.format(new Date(Number(t)))} Uhr`}
            formatter={(v, name) => [kw(Number(v)), series.find((s) => s.id === name)?.name ?? String(name)]}
          />
          {series.map((s, i) => (
            <Area
              key={s.id}
              type="monotone"
              dataKey={s.id}
              name={s.id}
              stackId="p"
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={0.35}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EnergyBarChart({
  bars,
  highlightKey,
}: {
  bars: { label: string; key: string; wh: number }[];
  highlightKey?: string;
}) {
  if (bars.every((b) => b.wh === 0)) return <EmptyChart text="Noch keine Erträge in diesem Zeitraum." />;
  return (
    <div className="h-56 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bars} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#78716c" }} interval="preserveStartEnd" minTickGap={4} />
          <YAxis tickFormatter={(wh: number) => `${nf.format(wh / 1000)}`} tick={{ fontSize: 11, fill: "#78716c" }} width={44} unit="" />
          <Tooltip formatter={(v) => [kwh(Number(v)), "Ertrag"]} cursor={{ fill: "#fef3c7" }} />
          <Bar
            dataKey="wh"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
            shape={(props: { x?: number; y?: number; width?: number; height?: number; payload?: { key: string } }) => (
              <rect
                x={props.x}
                y={props.y}
                width={props.width}
                height={props.height}
                rx={3}
                fill={props.payload?.key === highlightKey ? "#d97706" : "#fbbf24"}
              />
            )}
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-right text-[11px] text-stone-400">Werte in kWh</p>
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-stone-200 text-sm text-stone-400">
      {text}
    </div>
  );
}
