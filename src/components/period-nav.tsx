"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { View } from "@/lib/period";

const LABELS: Record<View, string> = { day: "Tag", month: "Monat", year: "Jahr", total: "Gesamt" };

/** Umschalter Tag | Monat | Jahr | Gesamt, Vor/Zurück, Datumsauswahl und „Heute“. */
export function PeriodNav({
  view,
  periodKey,
  title,
  tabs,
  prevHref,
  nextHref,
  todayHref,
  pickerBase,
  firstYear,
  currentYear,
}: {
  view: View;
  periodKey: string;
  title: string;
  tabs: { view: View; href: string }[];
  prevHref: string | null;
  nextHref: string | null;
  todayHref: string | null;
  /** Basis-URL inkl. Query ohne view/date, z. B. "/dashboard?site=…" */
  pickerBase: string;
  firstYear: number;
  currentYear: number;
}) {
  const router = useRouter();
  const go = (date: string) => {
    if (!date) return;
    const sep = pickerBase.includes("?") ? "&" : "?";
    router.push(`${pickerBase}${sep}view=${view}&date=${encodeURIComponent(date)}`);
  };
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="inline-flex w-full rounded-full bg-mist p-1 sm:w-auto" role="tablist" aria-label="Zeitraum">
        {tabs.map((t) => (
          <Link
            key={t.view}
            href={t.href}
            role="tab"
            aria-selected={t.view === view}
            className={`flex-1 rounded-full px-4 py-2 text-center text-sm font-semibold transition duration-300 sm:flex-none ${
              t.view === view ? "bg-white text-purple-600 shadow-sm" : "text-ink-soft hover:text-ink"
            }`}
          >
            {LABELS[t.view]}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {view !== "total" && (
          <>
            <NavArrow href={prevHref} label="Zurück" dir="prev" />
            <span className="min-w-36 text-center text-sm font-bold">{title}</span>
            <NavArrow href={nextHref} label="Weiter" dir="next" />
            {view === "day" && (
              <input
                type="date"
                className="input w-auto py-1.5"
                aria-label="Datum wählen"
                defaultValue={periodKey}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => go(e.target.value)}
              />
            )}
            {view === "month" && (
              <input
                type="month"
                className="input w-auto py-1.5"
                aria-label="Monat wählen"
                defaultValue={periodKey}
                onChange={(e) => go(e.target.value)}
              />
            )}
            {view === "year" && (
              <select className="input w-auto py-1.5" aria-label="Jahr wählen" defaultValue={periodKey} onChange={(e) => go(e.target.value)}>
                {Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            )}
            {todayHref && (
              <Link href={todayHref} className="btn btn-sm">
                Heute
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NavArrow({ href, label, dir }: { href: string | null; label: string; dir: "prev" | "next" }) {
  const icon = (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <path d={dir === "prev" ? "M12.5 4 6.5 10l6 6" : "M7.5 4l6 6-6 6"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  return href ? (
    <Link href={href} className="btn h-9 w-9 p-0" aria-label={label}>
      {icon}
    </Link>
  ) : (
    <span className="btn h-9 w-9 p-0 opacity-30" aria-disabled>
      {icon}
    </span>
  );
}
