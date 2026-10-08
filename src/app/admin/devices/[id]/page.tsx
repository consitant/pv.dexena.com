import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { devices, inverters } from "@/db/schema";
import { isDeviceOnline, isInverterOnline } from "@/lib/offline";
import { isUuid } from "@/lib/portal-data";
import { requireAdmin } from "@/lib/session";
import { fmtAgo, fmtDateTime } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { OnlineBadge } from "@/components/status-badge";
import { deleteDeviceAction, rotateDeviceTokenAction, updateDeviceAction } from "../../actions";
import { DeviceFields } from "../device-fields";

export const metadata: Metadata = { title: "Gateway" };

export default async function DeviceDetail({ params }: PageProps<"/admin/devices/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = getDb();
  const [d] = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
  if (!d) notFound();
  const invs = await db.select().from(inverters).where(eq(inverters.deviceId, id)).orderBy(asc(inverters.port));
  const now = new Date();
  const hb = d.lastHeartbeat as Record<string, unknown> | null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/devices" className="link text-sm">← Gateways</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{d.name}</h1>
          <OnlineBadge online={isDeviceOnline(d, now)} />
        </div>
        <p className="text-sm text-stone-500">
          zuletzt gesehen {fmtDateTime(d.lastSeenAt)} · Firmware {d.firmwareVersion ?? "–"} · Token {d.tokenPrefix}…
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <section className="card">
            <h2 className="card-title">Einstellungen</h2>
            <ActionForm action={updateDeviceAction} submitLabel="Speichern">
              <input type="hidden" name="id" value={d.id} />
              <DeviceFields d={d} />
            </ActionForm>
          </section>
          <section className="card">
            <h2 className="card-title">Token</h2>
            <p className="mb-3 text-sm text-stone-600">
              Erzeugt ein neues Token. Das bisherige wird sofort ungültig – danach im Gateway eintragen.
            </p>
            <ActionForm
              action={rotateDeviceTokenAction}
              submitLabel="Neues Token erzeugen"
              buttonClassName="btn"
              confirm="Altes Token wird ungültig. Fortfahren?"
            >
              <input type="hidden" name="id" value={d.id} />
            </ActionForm>
          </section>
          <section className="card">
            <h2 className="card-title">Löschen</h2>
            <ActionForm action={deleteDeviceAction} submitLabel="Gateway löschen" buttonClassName="btn btn-danger" confirm="Gateway wirklich löschen?">
              <input type="hidden" name="id" value={d.id} />
              <p className="text-xs text-stone-500">Nur möglich, wenn keine Wechselrichter mehr zugeordnet sind.</p>
            </ActionForm>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="card-title mb-0">Wechselrichter / Ports</h2>
              <Link href={`/admin/inverters/new?device=${d.id}`} className="btn btn-sm">Wechselrichter hinzufügen</Link>
            </div>
            {invs.length === 0 ? (
              <p className="text-sm text-stone-500">Noch keine Ports belegt.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Port</th>
                    <th>Kennung</th>
                    <th>Status</th>
                    <th>Fehler</th>
                  </tr>
                </thead>
                <tbody>
                  {invs.map((i) => (
                    <tr key={i.id} className={i.enabled ? "" : "opacity-50"}>
                      <td className="font-mono">{i.port}</td>
                      <td>
                        <Link href={`/admin/inverters/${i.id}`} className="link">{i.name ?? i.ref}</Link>
                        {!i.enabled && <span className="text-xs text-stone-500"> · deaktiviert</span>}
                      </td>
                      <td>
                        <OnlineBadge online={isInverterOnline(i, now)} labels={["verbunden", "offline"]} />
                        <div className="text-xs text-stone-500">{fmtAgo(i.lastOkAt, now)}</div>
                      </td>
                      <td className="text-xs text-red-700">{i.lastError ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className="card">
            <h2 className="card-title">Letzter Heartbeat</h2>
            {hb ? (
              <pre className="max-h-80 overflow-auto rounded-lg bg-stone-900 p-3 text-xs text-stone-100">
                {JSON.stringify(hb, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-stone-500">Noch kein Kontakt.</p>
            )}
            <p className="mt-3 text-xs text-stone-500">
              Endpunkte: <code>POST /api/ingest</code>, <code>GET /api/gateway/config</code> mit{" "}
              <code>Authorization: Bearer &lt;Token&gt;</code>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
