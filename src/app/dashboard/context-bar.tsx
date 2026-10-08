import Link from "next/link";
import { SiteSwitcher } from "./site-switcher";

/** Seitenkopf: Admin-Hinweis, Titel, Anlagenumschalter. */
export function ContextBar({
  isAdmin,
  customerId,
  customerName,
  title,
  subtitle,
  sites,
  currentSiteId,
  actions,
  back,
}: {
  isAdmin: boolean;
  customerId: string;
  customerName: string;
  title: string;
  subtitle?: string;
  sites: { id: string; name: string }[];
  currentSiteId: string | null;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  const q = isAdmin ? `?customer=${customerId}` : "";
  return (
    <div className="mb-6 space-y-4 sm:mb-8">
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-full bg-ink px-4 py-2 text-xs text-white sm:text-sm">
          <span>
            <strong>Admin-Ansicht</strong> · Sie sehen das Portal von <strong>{customerName}</strong> (Kundensicht)
          </span>
          <Link href={`/admin/customers/${customerId}`} className="font-semibold text-lilac hover:underline">
            Zur Kundenverwaltung →
          </Link>
        </div>
      )}
      {back && (
        <Link href={back.href} className="link text-sm">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="h1 truncate">{title}</h1>
          {subtitle && <p className="mt-1 text-grey">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sites.length > 1 && (
            <SiteSwitcher
              options={[{ value: `/dashboard${q}`, label: "Alle Anlagen" }, ...sites.map((s) => ({ value: `/dashboard/sites/${s.id}${q}`, label: s.name }))]}
              current={currentSiteId ? `/dashboard/sites/${currentSiteId}${q}` : `/dashboard${q}`}
            />
          )}
          {actions}
        </div>
      </div>
    </div>
  );
}
