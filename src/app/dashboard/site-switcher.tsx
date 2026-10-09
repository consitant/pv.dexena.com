"use client";

import { useRouter } from "next/navigation";

export function SiteSwitcher({
  options,
  current,
  label = "Anlage wählen",
  compact = false,
}: {
  options: { value: string; label: string }[];
  current: string;
  label?: string;
  /** kompakte Pille ohne sichtbares Label (Seitenkopf) */
  compact?: boolean;
}) {
  const router = useRouter();
  return (
    <label className="relative block">
      <span className={compact ? "sr-only" : "mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft"}>{label}</span>
      <select
        className={`input appearance-none rounded-full pl-4 pr-10 font-semibold ${compact ? "min-h-11 border-purple-600/40 bg-mist py-2 text-purple-600" : "min-h-11 py-2.5"}`}
        value={current}
        onChange={(e) => router.push(e.target.value)}
      >
        {!current && <option value="">Bitte wählen …</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 20 20" className={`pointer-events-none absolute right-3 h-4 w-4 text-purple-600 ${compact ? "top-1/2 -translate-y-1/2" : "bottom-3.5"}`} aria-hidden>
        <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </label>
  );
}
