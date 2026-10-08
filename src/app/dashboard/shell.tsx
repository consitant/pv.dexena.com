import Link from "next/link";
import { getDb } from "@/db/client";
import { getSiteNav } from "@/lib/dashboard";
import { fmtPower } from "@/lib/format";
import type { InverterStatus } from "@/lib/portal-data";
import { statusLabel } from "@/components/status-badge";
import { RememberSite } from "./remember-site";
import { SiteSwitcher } from "./site-switcher";

const DOT: Record<InverterStatus, string> = {
  ongrid: "bg-emerald-500",
  standby: "bg-purple-600",
  initial: "bg-purple-600",
  night: "bg-stone-400",
  shutdown: "bg-stone-400",
  unknown: "bg-stone-400",
  error: "bg-red-600",
  offline: "bg-orange",
};

/**
 * Rahmen des Kundenbereichs: „Meine Anlagen“ als Seitenleiste (Desktop) bzw. Umschalter oben (Mobil).
 * Wird nur bei mehr als einer Anlage angezeigt.
 */
export async function DashboardShell({
  customerId,
  isAdmin,
  current,
  children,
}: {
  customerId: string;
  isAdmin: boolean;
  /** Anlagen-ID, "all" oder null (z. B. Wechselrichter ohne Anlage) */
  current: string | null;
  children: React.ReactNode;
}) {
  const nav = await getSiteNav(getDb(), customerId);
  const remember = !isAdmin && current ? <RememberSite value={current} /> : null;
  if (nav.items.length < 2) {
    return (
      <>
        {remember}
        {children}
      </>
    );
  }
  const q = isAdmin ? `customer=${customerId}` : "";
  const siteHref = (id: string) => `/dashboard/sites/${id}${q ? `?${q}` : ""}`;
  const allHref = `/dashboard?${q ? `${q}&` : ""}all=1`;
  const entries = [
    { key: "all", href: allHref, name: "Alle Anlagen", status: nav.all.status, powerW: nav.all.powerW, sub: `${nav.all.inverterCount} Wechselrichter` },
    ...nav.items.map((s) => ({ key: s.id, href: siteHref(s.id), name: s.name, status: s.status, powerW: s.powerW, sub: `${s.inverterCount} WR` })),
  ];
  return (
    <div className="lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-8">
      {remember}
      <aside className="hidden lg:block" aria-label="Meine Anlagen">
        <nav className="sticky top-24">
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-[0.08em] text-ink-soft">Meine Anlagen</p>
          <ul className="space-y-1">
            {entries.map((e) => {
              const active = e.key === current;
              return (
                <li key={e.key}>
                  <Link
                    href={e.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition duration-300 ease-dx ${
                      active ? "bg-ink text-white" : "text-ink hover:bg-mist"
                    } ${e.key === "all" ? "mb-2" : ""}`}
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[e.status]}`} title={statusLabel(e.status)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{e.name}</span>
                      <span className={`block text-xs ${active ? "text-white/85" : "text-grey"}`}>{e.sub}</span>
                    </span>
                    <span className="text-sm font-bold tabular-nums">{fmtPower(e.powerW)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="min-w-0">
        <div className="sticky top-[60px] z-20 -mx-4 mb-5 border-b border-ink/5 bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <SiteSwitcher
            label="Anlage"
            options={entries.map((e) => ({ value: e.href, label: `${e.name} · ${fmtPower(e.powerW)} · ${statusLabel(e.status)}` }))}
            current={entries.find((e) => e.key === current)?.href ?? ""}
          />
        </div>
        {children}
      </div>
    </div>
  );
}
