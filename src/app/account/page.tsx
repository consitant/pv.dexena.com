import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { ADMIN_NAV } from "@/components/admin-nav";
import { SiteFooter } from "@/components/brand";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords";
import { changeOwnPasswordAction, updateProfileAction } from "./actions";

export const metadata: Metadata = { title: "Mein Konto" };

export default async function AccountPage() {
  const user = await requireUser();
  const [u] = await getDb().select().from(users).where(eq(users.id, user.id)).limit(1);
  return (
    <>
      <AppHeader user={user} nav={user.role === "admin" ? ADMIN_NAV : [{ href: "/dashboard", label: "Dashboard" }]} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="h1">Mein Konto</h1>
          <p className="mt-1 text-grey">{u.email}</p>
        </div>
        <section className="card">
          <h2 className="card-title">Profil</h2>
          <ActionForm action={updateProfileAction} submitLabel="Speichern" buttonClassName="btn btn-dark">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="name">Name</label>
                <input className="input" id="name" name="name" defaultValue={u.name ?? ""} maxLength={200} />
              </div>
              <div>
                <label className="label" htmlFor="phone">Telefon</label>
                <input className="input" id="phone" name="phone" defaultValue={u.phone ?? ""} maxLength={50} />
              </div>
            </div>
          </ActionForm>
        </section>
        <section className="card">
          <h2 className="card-title">Passwort ändern</h2>
          <ActionForm action={changeOwnPasswordAction} submitLabel="Passwort ändern" buttonClassName="btn btn-dark">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="cur">Aktuelles Passwort</label>
                <input className="input" id="cur" name="currentPassword" type="password" autoComplete="current-password" required />
              </div>
              <div>
                <label className="label" htmlFor="new">Neues Passwort</label>
                <input className="input" id="new" name="newPassword" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
              </div>
              <div>
                <label className="label" htmlFor="rep">Wiederholen</label>
                <input className="input" id="rep" name="confirmPassword" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
              </div>
            </div>
            <p className="text-xs text-grey">Mindestens {MIN_PASSWORD_LENGTH} Zeichen.</p>
          </ActionForm>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
