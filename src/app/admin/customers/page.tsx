import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { exec } from "@/db/types";
import { requireAdmin } from "@/lib/session";
import { ActionForm } from "@/components/action-form";
import { createCustomerAction } from "../actions";
import { CustomerFields } from "./customer-fields";

export const metadata: Metadata = { title: "Kunden" };

export default async function CustomersPage() {
  await requireAdmin();
  const res = await exec<{ id: string; name: string; email: string | null; sites: number; inverters: number; users: number }>(
    getDb(),
    sql`
      SELECT c.id, c.name, c.email,
        (SELECT count(*)::int FROM sites s WHERE s.customer_id = c.id) AS sites,
        (SELECT count(*)::int FROM inverters i WHERE i.customer_id = c.id) AS inverters,
        (SELECT count(*)::int FROM users u WHERE u.customer_id = c.id) AS users
      FROM customers c ORDER BY c.name
    `,
  );
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Kunden</h1>
        <div className="card overflow-x-auto p-0 sm:p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="text-right">Anlagen</th>
                <th className="text-right">WR</th>
                <th className="text-right">Benutzer</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {res.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-stone-500">Noch keine Kunden.</td>
                </tr>
              )}
              {res.rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/customers/${c.id}`} className="link">{c.name}</Link>
                    {c.email && <div className="text-xs text-stone-500">{c.email}</div>}
                  </td>
                  <td className="text-right tabular-nums">{c.sites}</td>
                  <td className="text-right tabular-nums">{c.inverters}</td>
                  <td className="text-right tabular-nums">{c.users}</td>
                  <td className="text-right">
                    <Link href={`/dashboard?customer=${c.id}`} className="btn btn-sm">Dashboard</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card h-fit">
        <h2 className="card-title">Neuer Kunde</h2>
        <ActionForm action={createCustomerAction} submitLabel="Kunde anlegen">
          <CustomerFields />
        </ActionForm>
      </section>
    </div>
  );
}
