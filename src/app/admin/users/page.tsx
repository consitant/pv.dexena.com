import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { listCustomers, listUsers } from "@/lib/admin";
import { requireAdmin } from "@/lib/session";
import { fmtAgo } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { createUserAction } from "../actions";
import { UserRoleFields } from "./user-role-fields";

export const metadata: Metadata = { title: "Benutzer" };

export default async function UsersPage() {
  await requireAdmin();
  const db = getDb();
  const [list, customerList] = await Promise.all([listUsers(db), listCustomers(db)]);
  const now = new Date();
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Benutzer</h1>
        <div className="card overflow-x-auto p-0 sm:p-0">
          <table className="table">
            <thead>
              <tr>
                <th>E-Mail</th>
                <th>Rolle</th>
                <th>Kunde</th>
                <th>Letzter Login</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/admin/users/${u.id}`} className="link">{u.email}</Link>
                    {u.name && <div className="text-xs text-stone-500">{u.name}</div>}
                  </td>
                  <td>{u.role === "admin" ? "Admin" : "Kunde"}</td>
                  <td>
                    {u.customerId ? <Link href={`/admin/customers/${u.customerId}`} className="link">{u.customerName}</Link> : "–"}
                  </td>
                  <td className="text-xs text-stone-500">{fmtAgo(u.lastLoginAt, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card h-fit">
        <h2 className="card-title">Neuer Benutzer</h2>
        <ActionForm action={createUserAction} submitLabel="Benutzer anlegen">
          <div>
            <label className="label">E-Mail *</label>
            <input className="input" name="email" type="email" required />
          </div>
          <div>
            <label className="label">Name</label>
            <input className="input" name="name" />
          </div>
          <UserRoleFields customers={customerList.map((c) => ({ id: c.id, name: c.name }))} />
          <div>
            <label className="label">Passwort</label>
            <input className="input" name="password" type="password" autoComplete="new-password" placeholder="leer lassen = generieren" />
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
