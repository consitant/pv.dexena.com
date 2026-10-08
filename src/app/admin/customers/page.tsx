import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { customerQuerySchema, searchCustomers, type CustomerQuery } from "@/lib/customer-search";
import { fmtAgo, fmtEnergyWh, fmtNum } from "@/lib/format";
import { one } from "@/lib/params";
import { requireAdmin } from "@/lib/session";
import { ActionForm } from "@/components/action-form";
import { Ampel } from "@/components/status-badge";
import { createCustomerAction } from "../actions";
import { CustomerFields } from "./customer-fields";

export const metadata: Metadata = { title: "Kunden" };

const COLS: { key: CustomerQuery["sort"] | null; label: string; right?: boolean }[] = [
  { key: "status", label: "" },
  { key: "customerNo", label: "Nr." },
  { key: "name", label: "Name" },
  { key: "city", label: "Ort" },
  { key: null, label: "Anl.", right: true },
  { key: null, label: "WR", right: true },
  { key: "kwp", label: "kWp", right: true },
  { key: "monthWh", label: "Ertrag Monat", right: true },
  { key: "lastData", label: "Letzte Daten" },
];

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireAdmin();
  const sp = await searchParams;
  const raw = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, one(v)]));
  const result = await searchCustomers(getDb(), customerQuerySchema.parse(raw));
  const q = result.query;
  const now = new Date();
  const href = (o: Partial<CustomerQuery>) => {
    const p = new URLSearchParams();
    const m = { ...q, ...o };
    if (m.q) p.set("q", m.q);
    if (m.status !== "all") p.set("status", m.status);
    if (m.health !== "all") p.set("health", m.health);
    if (m.sort !== "customerNo") p.set("sort", m.sort);
    if (m.dir !== "asc") p.set("dir", m.dir);
    if (m.page > 1) p.set("page", String(m.page));
    const s = p.toString();
    return `/admin/customers${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kunden</h1>
          <p className="text-sm text-grey">{result.total} Treffer</p>
        </div>
        <details className="group relative">
          <summary className="btn btn-primary cursor-pointer list-none">+ Neuer Kunde</summary>
          <div className="panel absolute right-0 z-20 mt-2 w-[min(92vw,640px)] shadow-xl">
            <ActionForm action={createCustomerAction} submitLabel="Kunde anlegen">
              <CustomerFields compact />
            </ActionForm>
          </div>
        </details>
      </div>

      <form className="panel flex flex-wrap items-end gap-3" action="/admin/customers">
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="q">Suche</label>
          <input className="input" id="q" name="q" defaultValue={q.q} placeholder="Name, Kundennr., E-Mail, Ort, Tag" />
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select className="input" id="status" name="status" defaultValue={q.status}>
            <option value="all">alle</option>
            <option value="active">aktiv</option>
            <option value="inactive">inaktiv</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="health">Anlagenzustand</label>
          <select className="input" id="health" name="health" defaultValue={q.health}>
            <option value="all">alle</option>
            <option value="fault">mit Störung</option>
            <option value="stale">ohne Daten &gt; 24 h</option>
          </select>
        </div>
        <input type="hidden" name="sort" value={q.sort} />
        <input type="hidden" name="dir" value={q.dir} />
        <button className="btn btn-dark">Filtern</button>
        {(q.q || q.status !== "all" || q.health !== "all") && (
          <Link href="/admin/customers" className="btn">Zurücksetzen</Link>
        )}
      </form>

      <div className="panel overflow-x-auto p-0 sm:p-0">
        <table className="table">
          <thead>
            <tr>
              {COLS.map((c, i) => (
                <th key={i} className={c.right ? "text-right" : ""}>
                  {c.key ? (
                    <Link
                      href={href({ sort: c.key, dir: q.sort === c.key && q.dir === "asc" ? "desc" : "asc", page: 1 })}
                      className={`hover:text-purple ${q.sort === c.key ? "text-purple" : ""}`}
                      aria-label={c.label || "Status"}
                    >
                      {c.label || "●"}
                      {q.sort === c.key ? (q.dir === "asc" ? " ↑" : " ↓") : ""}
                    </Link>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-grey">Keine Kunden gefunden.</td>
              </tr>
            )}
            {result.rows.map((c) => (
              <tr key={c.id} className={c.active ? "" : "opacity-55"}>
                <td><Ampel value={c.ampel} /></td>
                <td className="whitespace-nowrap font-mono text-xs">{c.customerNo}</td>
                <td>
                  <Link href={`/admin/customers/${c.id}`} className="link">{c.name}</Link>
                  {!c.active && <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold">inaktiv</span>}
                  {c.email && <div className="text-xs text-grey">{c.email}</div>}
                  {c.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <span key={t} className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-semibold text-purple">{t}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td>{c.city ?? "–"}</td>
                <td className="text-right tabular-nums">{c.sites}</td>
                <td className="text-right tabular-nums">{c.inverters}</td>
                <td className="text-right tabular-nums">{c.kwp !== null ? fmtNum(c.kwp, 1) : "–"}</td>
                <td className="text-right tabular-nums">{fmtEnergyWh(c.monthWh)}</td>
                <td className="whitespace-nowrap text-xs text-grey">{c.inverters ? fmtAgo(c.lastData, now) : "–"}</td>
                <td className="text-right">
                  <Link href={`/dashboard?customer=${c.id}`} className="btn btn-sm">Ansehen</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.pages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Seiten">
          {q.page > 1 && <Link href={href({ page: q.page - 1 })} className="btn btn-sm">← Zurück</Link>}
          <span className="text-sm text-grey">Seite {q.page} von {result.pages}</span>
          {q.page < result.pages && <Link href={href({ page: q.page + 1 })} className="btn btn-sm">Weiter →</Link>}
        </nav>
      )}
    </div>
  );
}
