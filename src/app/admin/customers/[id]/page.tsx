import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { getCustomer, isUuid, listInvertersForCustomer, listSitesForCustomer } from "@/lib/portal-data";
import { isInverterOnline } from "@/lib/offline";
import { fmtAgo } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { OnlineBadge } from "@/components/status-badge";
import {
  createSiteAction,
  createUserAction,
  deleteCustomerAction,
  deleteSiteAction,
  updateCustomerAction,
  updateSiteAction,
} from "../../actions";
import { CustomerFields } from "../customer-fields";

export const metadata: Metadata = { title: "Kunde" };

export default async function CustomerDetail({ params }: PageProps<"/admin/customers/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = getDb();
  const customer = await getCustomer(db, id);
  if (!customer) notFound();
  const [siteList, invs, userList] = await Promise.all([
    listSitesForCustomer(db, id),
    listInvertersForCustomer(db, id),
    db.select().from(users).where(eq(users.customerId, id)).orderBy(users.email),
  ]);
  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/customers" className="link text-sm">← Kunden</Link>
          <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
        </div>
        <Link href={`/dashboard?customer=${id}`} className="btn btn-primary">Dashboard ansehen</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card h-fit">
          <h2 className="card-title">Stammdaten</h2>
          <ActionForm action={updateCustomerAction} submitLabel="Speichern">
            <input type="hidden" name="id" value={id} />
            <CustomerFields c={customer} />
          </ActionForm>
          <form action={deleteCustomerAction} className="mt-6 border-t border-stone-100 pt-4">
            <input type="hidden" name="id" value={id} />
            <p className="mb-2 text-xs text-stone-500">
              Löscht Kunde, Anlagen und Benutzer. Wechselrichter und Messdaten bleiben erhalten (Zuordnung wird entfernt).
            </p>
            <button className="btn btn-danger btn-sm">Kunde löschen</button>
          </form>
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="card-title">Anlagen</h2>
            <ul className="mb-4 divide-y divide-stone-100">
              {siteList.length === 0 && <li className="py-2 text-sm text-stone-500">Noch keine Anlage.</li>}
              {siteList.map((s) => (
                <li key={s.id} className="py-3">
                  <details>
                    <summary className="cursor-pointer text-sm">
                      <span className="font-medium">{s.name}</span>
                      {s.address && <span className="text-stone-500"> · {s.address}</span>}
                      <span className="text-stone-400"> · {invs.filter((i) => i.siteId === s.id).length} WR</span>
                    </summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <ActionForm action={updateSiteAction} submitLabel="Speichern" className="grid gap-2 sm:grid-cols-3">
                        <input type="hidden" name="id" value={s.id} />
                        <input className="input" name="name" defaultValue={s.name} required aria-label="Name" />
                        <input className="input" name="address" defaultValue={s.address ?? ""} placeholder="Adresse" aria-label="Adresse" />
                        <input className="input" name="timezone" defaultValue={s.timezone} aria-label="Zeitzone" />
                      </ActionForm>
                      <form action={deleteSiteAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="customerId" value={id} />
                        <button className="btn btn-danger btn-sm">Löschen</button>
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
            <ActionForm action={createSiteAction} submitLabel="Anlage hinzufügen" className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
              <input type="hidden" name="customerId" value={id} />
              <input type="hidden" name="timezone" value="Europe/Berlin" />
              <input className="input" name="name" placeholder="Name der Anlage, z. B. Dach Süd" required aria-label="Name" />
              <input className="input" name="address" placeholder="Adresse (optional)" aria-label="Adresse" />
            </ActionForm>
          </section>

          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="card-title mb-0">Wechselrichter</h2>
              <Link href={`/admin/inverters/new?customer=${id}`} className="btn btn-sm">Zuordnen / anlegen</Link>
            </div>
            {invs.length === 0 ? (
              <p className="text-sm text-stone-500">Keine Wechselrichter zugeordnet.</p>
            ) : (
              <ul className="divide-y divide-stone-100 text-sm">
                {invs.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <Link href={`/admin/inverters/${i.id}`} className="link">{i.name ?? i.ref}</Link>
                      <span className="text-stone-500"> · {i.siteName ?? "ohne Anlage"}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-stone-500">
                      {fmtAgo(i.lastOkAt, now)}
                      <OnlineBadge online={isInverterOnline(i, now)} labels={["verbunden", "offline"]} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="card-title">Benutzer (Login)</h2>
            <ul className="mb-4 divide-y divide-stone-100 text-sm">
              {userList.length === 0 && <li className="py-2 text-stone-500">Noch kein Login für diesen Kunden.</li>}
              {userList.map((u) => (
                <li key={u.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <Link href={`/admin/users/${u.id}`} className="link">{u.email}</Link>
                  <span className="text-xs text-stone-500">letzter Login: {fmtAgo(u.lastLoginAt, now)}</span>
                </li>
              ))}
            </ul>
            <ActionForm action={createUserAction} submitLabel="Benutzer anlegen" className="grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="role" value="customer" />
              <input type="hidden" name="customerId" value={id} />
              <input className="input" name="email" type="email" placeholder="E-Mail" required aria-label="E-Mail" />
              <input className="input" name="name" placeholder="Name (optional)" aria-label="Name" />
              <input
                className="input sm:col-span-2"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Passwort (leer lassen = generieren)"
                aria-label="Passwort"
              />
            </ActionForm>
          </section>
        </div>
      </div>
    </div>
  );
}
