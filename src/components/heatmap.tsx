import Link from "next/link";
import { addDays, daysInMonth } from "@/lib/time";
import { MONTH_SHORT } from "@/lib/period";

const nf = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/** Farbstufe Lila (wenig) → Orange (viel). */
function shade(wh: number, max: number): string {
  if (wh <= 0 || max <= 0) return "#f5f3f9";
  const t = Math.min(1, wh / max);
  const from = [222, 210, 252]; // helles Lila
  const mid = [111, 69, 220]; // purple-600
  const to = [229, 83, 46]; // Orange (kräftig)
  const [a, b, u] = t < 0.6 ? [from, mid, t / 0.6] : [mid, to, (t - 0.6) / 0.4];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * u));
  return `rgb(${c.join(",")})`;
}

function weekday(day: string): number {
  // Montag = 0
  return (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/** Ertragskalender eines Monats (Wochenraster). */
export function MonthHeatmap({
  month,
  values,
  today,
  hrefFor,
}: {
  month: string; // YYYY-MM-01
  values: Map<string, number>;
  today: string;
  hrefFor: (day: string) => string;
}) {
  const n = daysInMonth(month);
  const max = Math.max(0, ...values.values());
  const lead = weekday(month);
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => addDays(month, i))];
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-grey">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1 sm:gap-1.5">
        {cells.map((day, i) => {
          if (!day) return <span key={`x${i}`} />;
          const wh = values.get(day) ?? 0;
          const future = day > today;
          return future ? (
            <span key={day} className="aspect-square rounded-xl border border-dashed border-ink/10" />
          ) : (
            <Link
              key={day}
              href={hrefFor(day)}
              title={`${day.slice(8)}.${day.slice(5, 7)}.: ${nf.format(wh / 1000)} kWh`}
              aria-label={`${Number(day.slice(8))}.: ${nf.format(wh / 1000)} kWh`}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl p-0.5 transition hover:ring-2 hover:ring-purple-600 ${day === today ? "ring-2 ring-ink ring-offset-1" : ""}`}
              style={{ background: shade(wh, max) }}
            >
              {/* Text auf heller Pille → Kontrast unabhängig von der Farbstufe */}
              <span className="rounded-full bg-white/90 px-1.5 text-[11px] font-bold leading-4 text-ink">{Number(day.slice(8))}</span>
              {wh > 0 && <span className="hidden rounded-full bg-white/90 px-1 text-[9px] font-semibold leading-3 text-ink sm:block">{nf.format(wh / 1000)}</span>}
            </Link>
          );
        })}
      </div>
      <Legend max={max} />
    </div>
  );
}

/** Ertragskalender eines Jahres (Monate × Tage). */
export function YearHeatmap({
  year,
  values,
  today,
}: {
  year: string;
  values: Map<string, number>;
  today: string;
  /** nicht mehr genutzt: Zellen sind zu klein zum Antippen – Drill-down über die Balken */
  hrefFor?: (day: string) => string;
}) {
  const max = Math.max(0, ...values.values());
  return (
    <div>
      <div className="space-y-[3px] sm:space-y-1">
        {MONTH_SHORT.map((label, m) => {
          const month = `${year}-${String(m + 1).padStart(2, "0")}-01`;
          const n = daysInMonth(month);
          return (
            <div key={label} className="flex items-center gap-1">
              <span className="w-7 shrink-0 text-[10px] font-semibold text-grey sm:w-8 sm:text-[11px]">{label}</span>
              <div className="grid flex-1 gap-[2px] sm:gap-[3px]" style={{ gridTemplateColumns: "repeat(31, minmax(0, 1fr))" }}>
                {Array.from({ length: n }, (_, d) => {
                  const day = addDays(month, d);
                  const wh = values.get(day) ?? 0;
                  return day > today ? (
                    <span key={day} className="h-2.5 rounded-[3px] bg-stone-50 sm:h-3.5 sm:rounded-[4px]" />
                  ) : (
                    <span
                      key={day}
                      title={`${day.slice(8)}.${day.slice(5, 7)}.: ${nf.format(wh / 1000)} kWh`}
                      className="h-2.5 rounded-[3px] sm:h-3.5 sm:rounded-[4px]"
                      style={{ background: shade(wh, max) }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <Legend max={max} />
    </div>
  );
}

function Legend({ max }: { max: number }) {
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-grey">
      <span>0</span>
      {[0.05, 0.3, 0.55, 0.8, 1].map((t) => (
        <span key={t} className="h-2.5 w-5 rounded" style={{ background: shade(t * Math.max(max, 1), Math.max(max, 1)) }} />
      ))}
      <span>{nf.format(max / 1000)} kWh/Tag</span>
    </div>
  );
}
