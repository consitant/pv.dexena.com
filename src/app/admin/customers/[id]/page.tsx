import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { devices, inverters, users } from "@/db/schema";
import { atCommandFor, latestPerInverter, listCustomerHistory } from "@/lib/admin";
import { getPeriodData, getPortfolio, resolveScope } from "@/lib/dashboard";
import { fmtAgo, fmtDateTime, fmtDay, fmtEnergyWh, fmtNum, fmtPct, fmtPower } from "@/lib/format";
import { one } from "@/lib/params";
import { parsePeriod } from "@/lib/period";
import { deriveStatus, getCustomer, isUuid, listSitesForCustomer } from "@/lib/portal-data";
import { requireAdmin } from "@/lib/session";
import { berlinDay } from "@/lib/time";
import { ActionForm } from "@/components/action-form";
import { EnergyChart } from "@/components/charts";
import { CopyText } from "@/components/copy-text";
import { Sparkline } from "@/components/sparkline";
import { StatusBadge } from "@/components/status-badge";
import {
  addCustomerNoteAction,
  createSiteAction,
  createUserAction,
  deleteCustomerAction,
  deleteSiteAction,
  resetPasswordAction,
  setCustomerActiveAction,
  setUserDisabledAction,
  updateCustomerAction,
  updateSiteAction,
} from "../../actions";
import { CustomerFields } from "../customer-fields";
import { STICK_HOST } from "../../inverters/options";

export const metadata: Metadata = { title: "Kunde" };

const TABS = [
  { key: "overview", label: "Übersicht" },
  { key: "sites", label: "Anlagen" },
  { key: "inverters", label: "Wechselrichter" },
  { key: "users", label: "Benutzer" },
  { key: "history", label: "Notizen & Verlauf" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const ACTION_LABELS: Record<string, string> = {
  "customer.create": "Kunde angelegt",
  "customer.update": "Stammdaten geändert",
  "customer.activate": "Kunde aktiviert",
  "customer.deactivate": "Kunde deaktiviert",
  "site.create": "Anlage angelegt",
  "site.update": "Anlage geändert",
  "site.delete": "Anlage gelöscht",
  "user.create": "Benutzer angelegt",
  "user.reset_password": "Passwort zurückgesetzt",
  "user.disable": "Benutzer gesperrt",
  "user.enable": "Benutzer entsperrt",
  "inverter.create": "Wechselrichter angelegt",
  "inverter.update": "Wechselrichter geändert/umgehängt",
  "tariff.save": "Tarif gespeichert",
  "tariff.delete": "Tarif gelöscht",
};

export default async function CustomerDetail({ params, searchParams }: PageProps<"/admin/customers/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const db = getDb();
  const customer = await getCustomer(db, id);
  if (!customer) notFound();
  const tabRaw = one(sp.tab);
  const tab: Tab = TABS.some((t) => t.key === tabRaw) ? (tabRaw as Tab) : "overview";
  const now = new Date();

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/customers" className="link text-sm">← Kunden</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{customer.name}</h1>
            <p className="text-sm text-grey">
              <span className="font-mono">{customer.customerNo}</span> · {customer.kind === "business" ? "Firma" : "Privat"}
              {customer.city ? ` · ${customer.city}` : ""}
              {!customer.active && <span className="ml-2 rounded-full bg-orange/15 px-2 py-0.5 text-xs font-bold text-[#b8432a]">inaktiv – Login gesperrt</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={setCustomerActiveAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="active" value={String(!customer.active)} />
              <button className={customer.active ? "btn btn-danger" : "btn"}>{customer.active ? "Deaktivieren" : "Aktivieren"}</button>
            </form>
            <Link href={`/dashboard?customer=${id}`} className="btn btn-primary">Als Kunde ansehen</Link>
          </div>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-ink/10" aria-label="Bereiche">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/customers/${id}${t.key === "overview" ? "" : `?tab=${t.key}`}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition ${
              tab === t.key ? "border-purple-600 text-purple-600" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <Overview id={id} customer={customer} now={now} />}
      {tab === "sites" && <SitesTab id={id} />}
      {tab === "inverters" && <InvertersTab id={id} now={now} />}
      {tab === "users" && <UsersTab id={id} now={now} />}
      {tab === "history" && <HistoryTab id={id} />}
    </div>
  );
}

async function Overview({ id, customer, now }: { id: string; customer: NonNullable<Awaited<ReturnType<typeof getCustomer>>>; now: Date }) {
  const db = getDb();
  const scope = (await resolveScope(db, id))!;
  const [portfolio, year] = await Promise.all([
    getPortfolio(db, id, now),
    getPeriodData(db, scope, parsePeriod("year", null, berlinDay(now)), now),
  ]);
  const k = year.kpis;
  const series = scope.selected.map((i) => ({ id: i.id, name: i.name ?? i.ref }));
  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Leistung jetzt" value={fmtPower(k.powerW)} />
          <Tile label="Heute" value={fmtEnergyWh(k.todayWh)} />
          <Tile label="Monat" value={fmtEnergyWh(k.monthWh)} />
          <Tile
            label={`Jahr ${year.period.key}`}
            value={fmtEnergyWh(k.yearWh)}
            sub={year.delta?.pct != null ? `${fmtPct(year.delta.pct)} ggü. Vorjahreszeitraum` : undefined}
          />
        </div>
        <section className="panel">
          <h2 className="panel-title">Anlagen</h2>
          {portfolio.sites.length === 0 ? (
            <p className="text-sm text-grey">Keine Anlagen/Wechselrichter.</p>
          ) : (
            <ul className="divide-y divide-ink/5">
              {portfolio.sites.map((s) => (
                <li key={s.id ?? "none"} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-grey">
                      {s.inverterCount} WR{s.peakPowerKwp ? ` · ${fmtNum(s.peakPowerKwp, 1)} kWp` : ""} · heute {fmtEnergyWh(s.todayWh)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Sparkline values={s.spark} width={96} height={30} />
                    <span className="w-20 text-right text-sm font-semibold tabular-nums">{fmtPower(s.powerW)}</span>
                    <StatusBadge status={s.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel">
          <h2 className="panel-title">Ertrag {year.period.key} vs. Vorjahr</h2>
          <EnergyChart bars={year.bars} series={series} compareLabel="Vorjahr" allowEur={false} height={220} />
        </section>
        <section className="panel border-red-200">
          <h2 className="panel-title text-red-700">Kunde löschen</h2>
          <ActionForm action={deleteCustomerAction} submitLabel="Endgültig löschen" buttonClassName="btn btn-danger" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={id} />
            <div className="min-w-60 flex-1">
              <label className="label" htmlFor="confirmName">Zur Bestätigung „{customer.name}“ eintippen</label>
              <input className="input" id="confirmName" name="confirmName" autoComplete="off" required />
              <p className="mt-1 text-xs text-grey">Löscht Kunde, Anlagen, Tarife und Benutzer. Wechselrichter und Messdaten bleiben erhalten (Zuordnung entfällt).</p>
            </div>
          </ActionForm>
        </section>
      </div>
      <section className="panel h-fit">
        <h2 className="panel-title">Stammdaten</h2>
        <ActionForm action={updateCustomerAction} submitLabel="Speichern">
          <input type="hidden" name="id" value={id} />
          <CustomerFields c={customer} />
        </ActionForm>
      </section>
    </div>
  );
}

async function SitesTab({ id }: { id: string }) {
  const db = getDb();
  const siteList = await listSitesForCustomer(db, id);
  return (
    <div className="space-y-5">
      <section className="panel">
        <h2 className="panel-title">Anlagen</h2>
        {siteList.length === 0 && <p className="text-sm text-grey">Noch keine Anlage.</p>}
        <ul className="divide-y divide-ink/5">
          {siteList.map((s) => (
            <li key={s.id} className="py-3">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-sm text-grey">
                      {s.address ? ` · ${s.address}` : ""}
                      {s.peakPowerKwp ? ` · ${fmtNum(s.peakPowerKwp, 1)} kWp` : ""}
                      {s.commissionedOn ? ` · seit ${fmtDay(s.commissionedOn)}` : ""}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <Link href={`/dashboard/sites/${s.id}/settings?customer=${id}`} className="btn btn-sm">Tarif</Link>
                    <Link href={`/dashboard/sites/${s.id}?customer=${id}`} className="btn btn-sm">Dashboard</Link>
                  </span>
                </summary>
                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
                  <ActionForm action={updateSiteAction} submitLabel="Speichern" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="timezone" value={s.timezone} />
                    <SiteInputs s={s} />
                  </ActionForm>
                  <form action={deleteSiteAction} className="self-end">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="customerId" value={id} />
                    <button className="btn btn-danger btn-sm">Anlage löschen</button>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel">
        <h2 className="panel-title">Anlage hinzufügen</h2>
        <ActionForm action={createSiteAction} submitLabel="Anlage anlegen" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="customerId" value={id} />
          <input type="hidden" name="timezone" value="Europe/Berlin" />
          <SiteInputs />
        </ActionForm>
      </section>
    </div>
  );
}

function SiteInputs({ s }: { s?: { name: string; address: string | null; peakPowerKwp: number | null; commissionedOn: string | null } }) {
  return (
    <>
      <div>
        <label className="label">Name *</label>
        <input className="input" name="name" defaultValue={s?.name ?? ""} required placeholder="z. B. Dach Süd" />
      </div>
      <div>
        <label className="label">Anlagenadresse</label>
        <input className="input" name="address" defaultValue={s?.address ?? ""} />
      </div>
      <div>
        <label className="label">Leistung (kWp)</label>
        <input className="input" name="peakPowerKwp" inputMode="decimal" defaultValue={s?.peakPowerKwp ?? ""} placeholder="9,9" />
      </div>
      <div>
        <label className="label">Inbetriebnahme</label>
        <input className="input" name="commissionedOn" type="date" defaultValue={s?.commissionedOn ?? ""} />
      </div>
    </>
  );
}

async function InvertersTab({ id, now }: { id: string; now: Date }) {
  const db = getDb();
  const [rows, latest] = await Promise.all([
    db
      .select({ i: inverters, deviceName: devices.name })
      .from(inverters)
      .innerJoin(devices, eq(devices.id, inverters.deviceId))
      .where(eq(inverters.customerId, id))
      .orderBy(asc(inverters.port)),
    latestPerInverter(db),
  ]);
  const siteList = await listSitesForCustomer(db, id);
  const siteName = new Map(siteList.map((s) => [s.id, s.name]));
  return (
    <section className="panel overflow-x-auto">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="panel-title mb-0">Wechselrichter</h2>
        <Link href={`/admin/inverters/new?customer=${id}`} className="btn btn-sm btn-primary">+ Zuordnen / anlegen</Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-grey">Keine Wechselrichter zugeordnet. Bestehende umhängen: Wechselrichter öffnen → Kunde/Anlage ändern.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Wechselrichter</th>
              <th>Anlage</th>
              <th>Gateway / Port</th>
              <th>AT-Befehl</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ i, deviceName }) => (
              <tr key={i.id} className={i.enabled ? "" : "bg-stone-50 [&_td]:text-grey"}>
                <td>
                  <Link href={`/admin/inverters/${i.id}`} className="link">{i.name ?? i.ref}</Link>
                  <div className="font-mono text-xs text-grey">{i.ref}</div>
                </td>
                <td>{i.siteId ? siteName.get(i.siteId) : <span className="text-grey">–</span>}</td>
                <td className="whitespace-nowrap text-xs">
                  {deviceName}
                  <div className="font-mono">{i.port}</div>
                </td>
                <td><CopyText value={atCommandFor(i.port, STICK_HOST)} /></td>
                <td>
                  <StatusBadge status={deriveStatus(i, latest.get(i.id), now)} />
                  <div className="text-xs text-grey">{fmtAgo(i.lastOkAt, now)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

async function UsersTab({ id, now }: { id: string; now: Date }) {
  const db = getDb();
  const list = await db.select().from(users).where(and(eq(users.customerId, id))).orderBy(asc(users.email));
  return (
    <div className="space-y-5">
      <section className="panel overflow-x-auto">
        <h2 className="panel-title">Benutzer (Login)</h2>
        {list.length === 0 ? (
          <p className="text-sm text-grey">Noch kein Login für diesen Kunden.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>E-Mail</th>
                <th>Letzte Anmeldung</th>
                <th>Status</th>
                <th>Passwort</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/admin/users/${u.id}`} className="link">{u.email}</Link>
                    {u.name && <div className="text-xs text-grey">{u.name}</div>}
                  </td>
                  <td className="text-xs" title={fmtDateTime(u.lastLoginAt)}>{fmtAgo(u.lastLoginAt, now)}</td>
                  <td>
                    <form action={setUserDisabledAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="customerId" value={id} />
                      <input type="hidden" name="disabled" value={String(!u.disabled)} />
                      <span className={`text-xs font-semibold ${u.disabled ? "text-[#b8432a]" : "text-emerald-700"}`}>{u.disabled ? "gesperrt" : "aktiv"}</span>
                      <button className="btn btn-sm">{u.disabled ? "Entsperren" : "Sperren"}</button>
                    </form>
                  </td>
                  <td>
                    <ActionForm action={resetPasswordAction} submitLabel="Neues Passwort" buttonClassName="btn btn-sm" confirm={`Passwort für ${u.email} neu erzeugen?`}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="customerId" value={id} />
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="panel">
        <h2 className="panel-title">Benutzer anlegen</h2>
        <ActionForm action={createUserAction} submitLabel="Benutzer anlegen" className="grid gap-2 sm:grid-cols-3 sm:items-end">
          <input type="hidden" name="role" value="customer" />
          <input type="hidden" name="customerId" value={id} />
          <input className="input" name="email" type="email" placeholder="E-Mail" required aria-label="E-Mail" />
          <input className="input" name="name" placeholder="Name (optional)" aria-label="Name" />
          <input className="input" name="password" type="password" autoComplete="new-password" placeholder="Passwort (leer = generieren)" aria-label="Passwort" />
        </ActionForm>
        <p className="mt-2 text-xs text-grey">Ein E-Mail-Versand (Einladung/Passwort vergessen) folgt mit einem Mail-Provider. Bis dahin das einmalig angezeigte Passwort persönlich übermitteln.</p>
      </section>
    </div>
  );
}

async function HistoryTab({ id }: { id: string }) {
  const { notes, events } = await listCustomerHistory(getDb(), id, 100);
  const merged = [
    ...notes.map((n) => ({ kind: "note" as const, at: n.n.createdAt, by: n.email, text: n.n.body, key: `n${n.n.id}` })),
    ...events.map((e) => ({
      kind: "event" as const,
      at: e.a.createdAt,
      by: e.email,
      text: ACTION_LABELS[e.a.action] ?? e.a.action,
      key: `e${e.a.id}`,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
      <section className="panel h-fit">
        <h2 className="panel-title">Notiz hinzufügen</h2>
        <ActionForm action={addCustomerNoteAction} submitLabel="Notiz speichern">
          <input type="hidden" name="id" value={id} />
          <textarea className="input" name="body" rows={4} required maxLength={5000} placeholder="z. B. Telefonat: Wartung im Frühjahr gewünscht" />
        </ActionForm>
      </section>
      <section className="panel">
        <h2 className="panel-title">Verlauf</h2>
        {merged.length === 0 ? (
          <p className="text-sm text-grey">Noch keine Einträge.</p>
        ) : (
          <ol className="space-y-3">
            {merged.map((m) => (
              <li key={m.key} className="flex gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${m.kind === "note" ? "bg-orange" : "bg-lilac"}`} />
                <div className="min-w-0">
                  <p className="text-xs text-grey">
                    {fmtDateTime(m.at)} · {m.by ?? "System"} · {m.kind === "note" ? "Notiz" : "Aktion"}
                  </p>
                  <p className={`whitespace-pre-wrap break-words text-sm ${m.kind === "note" ? "" : "text-ink-soft"}`}>{m.text}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-grey">{sub}</p>}
    </div>
  );
}
