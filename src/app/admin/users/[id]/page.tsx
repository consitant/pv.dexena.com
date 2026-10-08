import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { listCustomers } from "@/lib/admin";
import { isUuid } from "@/lib/portal-data";
import { requireAdmin } from "@/lib/session";
import { fmtDateTime } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { deleteUserAction, resetPasswordAction, setUserDisabledAction, updateUserAction } from "../../actions";
import { UserRoleFields } from "../user-role-fields";

export const metadata: Metadata = { title: "Benutzer" };

export default async function UserDetail({ params }: PageProps<"/admin/users/[id]">) {
  const me = await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = getDb();
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u) notFound();
  const customerList = await listCustomers(db);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/admin/users" className="link text-sm">← Benutzer</Link>
        <h1 className="text-2xl font-bold tracking-tight">{u.email}</h1>
        <p className="text-sm text-grey">
          angelegt {fmtDateTime(u.createdAt)} · letzter Login {fmtDateTime(u.lastLoginAt)}
        </p>
      </div>

      <section className="panel">
        <h2 className="panel-title">Profil & Rolle</h2>
        <ActionForm action={updateUserAction} submitLabel="Speichern">
          <input type="hidden" name="id" value={u.id} />
          <div>
            <label className="label">Name</label>
            <input className="input" name="name" defaultValue={u.name ?? ""} />
          </div>
          <UserRoleFields
            customers={customerList.map((c) => ({ id: c.id, name: c.name }))}
            role={u.role}
            customerId={u.customerId}
          />
        </ActionForm>
      </section>

      <section className="panel">
        <h2 className="panel-title">Passwort zurücksetzen</h2>
        <ActionForm action={resetPasswordAction} submitLabel="Passwort setzen">
          <input type="hidden" name="id" value={u.id} />
          <input
            className="input"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Neues Passwort (leer lassen = generieren)"
            aria-label="Neues Passwort"
          />
        </ActionForm>
      </section>

      {me.id !== u.id && (
        <section className="panel">
          <h2 className="panel-title">Zugang</h2>
          <form action={setUserDisabledAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={u.id} />
            {u.customerId && <input type="hidden" name="customerId" value={u.customerId} />}
            <input type="hidden" name="disabled" value={String(!u.disabled)} />
            <span className={`text-sm font-semibold ${u.disabled ? "text-[#b8432a]" : "text-emerald-700"}`}>{u.disabled ? "Benutzer ist gesperrt" : "Benutzer ist aktiv"}</span>
            <button className="btn btn-sm">{u.disabled ? "Entsperren" : "Sperren"}</button>
          </form>
        </section>
      )}

      {me.id !== u.id && (
        <section className="panel">
          <h2 className="panel-title">Benutzer löschen</h2>
          <ActionForm
            action={deleteUserAction}
            submitLabel="Benutzer löschen"
            buttonClassName="btn btn-danger"
            confirm={`Benutzer ${u.email} wirklich löschen?`}
          >
            <input type="hidden" name="id" value={u.id} />
          </ActionForm>
        </section>
      )}
    </div>
  );
}
