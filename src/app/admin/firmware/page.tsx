import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { firmwareReleases } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { fmtDateTime } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { deleteFirmwareAction, setFirmwareReleasedAction, uploadFirmwareAction } from "../actions";

export const metadata: Metadata = { title: "Firmware" };

export default async function FirmwarePage() {
  await requireAdmin();
  const list = await getDb().select().from(firmwareReleases).orderBy(desc(firmwareReleases.createdAt));
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Firmware</h1>
        <p className="mb-4 text-sm text-stone-500">
          Für spätere ESP32-Devices. Abruf über <code>GET /api/firmware/latest?current=&lt;version&gt;</code>; die höchste freigegebene Version wird ausgeliefert.
        </p>
        <div className="card overflow-x-auto p-0 sm:p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Größe / SHA-256</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-stone-500">Noch keine Firmware hochgeladen.</td>
                </tr>
              )}
              {list.map((f) => (
                <tr key={f.id}>
                  <td>
                    <span className="font-mono font-medium">{f.version}</span>
                    <div className="text-xs text-stone-500">{fmtDateTime(f.createdAt)}</div>
                    {f.notes && <div className="text-xs text-stone-600">{f.notes}</div>}
                  </td>
                  <td className="text-xs">
                    {(f.size / 1024).toFixed(0)} KiB
                    <div className="max-w-40 truncate font-mono text-stone-500" title={f.sha256}>{f.sha256}</div>
                  </td>
                  <td>{f.released ? <span className="text-emerald-700">freigegeben</span> : <span className="text-stone-500">Entwurf</span>}</td>
                  <td className="space-y-1 text-right">
                    <form action={setFirmwareReleasedAction}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="released" value={String(!f.released)} />
                      <button className="btn btn-sm">{f.released ? "Zurückziehen" : "Freigeben"}</button>
                    </form>
                    {!f.released && (
                      <form action={deleteFirmwareAction}>
                        <input type="hidden" name="id" value={f.id} />
                        <button className="btn btn-danger btn-sm">Löschen</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card h-fit">
        <h2 className="card-title">Hochladen</h2>
        <ActionForm action={uploadFirmwareAction} submitLabel="Hochladen" pendingLabel="Lade hoch …">
          <div>
            <label className="label">Version *</label>
            <input className="input font-mono" name="version" required placeholder="0.3.0" />
          </div>
          <div>
            <label className="label">Datei (.bin, max. ca. 3,9 MB) *</label>
            <input className="input" name="file" type="file" accept=".bin,application/octet-stream" required />
          </div>
          <div>
            <label className="label">Notizen</label>
            <textarea className="input" name="notes" rows={2} />
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
