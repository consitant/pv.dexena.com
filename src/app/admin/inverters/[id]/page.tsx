import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { inverters } from "@/db/schema";
import { atCommandFor, latestPerInverter } from "@/lib/admin";
import { deriveStatus, isUuid } from "@/lib/portal-data";
import { requireAdmin } from "@/lib/session";
import { fmtDateTime, fmtPower } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { CopyText } from "@/components/copy-text";
import { modeLabel, StatusBadge } from "@/components/status-badge";
import { approveSetupAction, deleteInverterAction, updateInverterAction } from "../../actions";
import { InverterFields } from "../inverter-fields";
import { loadInverterFormOptions, STICK_HOST } from "../options";

export const metadata: Metadata = { title: "Wechselrichter" };

export default async function InverterDetail({ params }: PageProps<"/admin/inverters/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = getDb();
  const [inv] = await db.select().from(inverters).where(eq(inverters.id, id)).limit(1);
  if (!inv) notFound();
  const [options, latest] = await Promise.all([loadInverterFormOptions(db), latestPerInverter(db)]);
  const l = latest.get(inv.id);
  const now = new Date();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/inverters" className="link text-sm">← Wechselrichter</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{inv.name ?? inv.ref}</h1>
          <StatusBadge status={deriveStatus(inv, l, now)} />
          {!inv.enabled && <span className="text-sm text-grey">deaktiviert</span>}
        </div>
        <p className="text-sm text-grey">
          letzte erfolgreiche Abfrage {fmtDateTime(inv.lastOkAt)}
          {l && ` · ${modeLabel(l.mode)} · ${fmtPower(l.acPowerW)}`}
        </p>
        {inv.lastError && <p className="text-sm text-red-700">Fehler: {inv.lastError}</p>}
      </div>

      {inv.setupPending && (
        <section className="panel flex flex-wrap items-center justify-between gap-3 border-orange/40 bg-orange/10">
          <p className="text-sm">
            <strong>Einrichtung ausstehend:</strong> vom Kunden über den Assistenten angelegt (Port {inv.port}). Zuordnung und Port prüfen, dann freigeben.
          </p>
          <form action={approveSetupAction}>
            <input type="hidden" name="id" value={inv.id} />
            <button className="btn btn-dark">Freigeben</button>
          </form>
        </section>
      )}

      <section className="panel">
        <h2 className="panel-title">Stick-Konfiguration</h2>
        <CopyText value={atCommandFor(inv.port, STICK_HOST)} />
        <p className="mt-2 text-xs text-grey">
          Per UDP 48899 an den Stick senden, anschließend <code>AT+Z</code> (Neustart). Der Stick verbindet sich dann als
          TCP-Client auf Port {inv.port}.
        </p>
        {inv.customerId && (
          <p className="mt-3 text-sm">
            <Link href={`/dashboard?customer=${inv.customerId}`} className="link">Kunden-Dashboard ansehen →</Link>
          </p>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">Bearbeiten / umhängen</h2>
        <ActionForm action={updateInverterAction} submitLabel="Speichern">
          <input type="hidden" name="id" value={inv.id} />
          <InverterFields options={options} initial={inv} />
        </ActionForm>
      </section>

      <section className="panel">
        <h2 className="panel-title">Löschen</h2>
        <ActionForm action={deleteInverterAction} submitLabel="Endgültig löschen" buttonClassName="btn btn-danger">
          <input type="hidden" name="id" value={inv.id} />
          <p className="text-sm text-ink-soft">
            Löscht den Wechselrichter <strong>inklusive aller Messwerte und Erträge</strong>. Zum Umhängen stattdessen Kunde/Anlage ändern.
          </p>
          <input className="input max-w-xs" name="confirm" placeholder="LÖSCHEN eingeben" aria-label="Bestätigung" />
        </ActionForm>
      </section>
    </div>
  );
}
