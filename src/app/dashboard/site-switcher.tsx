"use client";

import { useRouter } from "next/navigation";

export function SiteSwitcher({ options, current }: { options: { value: string; label: string }[]; current: string }) {
  const router = useRouter();
  return (
    <label className="relative">
      <span className="sr-only">Anlage wählen</span>
      <select
        className="input appearance-none rounded-full py-2 pl-4 pr-10 font-semibold"
        value={current}
        onChange={(e) => router.push(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple" aria-hidden>
        <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </label>
  );
}
