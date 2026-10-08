"use client";

import { useRouter } from "next/navigation";

export function SiteSwitcher({
  options,
  current,
  label = "Anlage wählen",
}: {
  options: { value: string; label: string }[];
  current: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <label className="relative block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft">{label}</span>
      <select
        className="input appearance-none rounded-full py-2.5 pl-4 pr-10 font-semibold"
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
      <svg viewBox="0 0 20 20" className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 text-purple-600" aria-hidden>
        <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </label>
  );
}
