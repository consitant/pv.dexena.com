import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { listDevices, listInvertersAdmin } from "@/lib/admin";
import { isDeviceOnline } from "@/lib/offline";
import { requireAdmin } from "@/lib/session";
import { fmtAgo } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { OnlineBadge } from "@/components/status-badge";
import { createDeviceAction } from "../actions";
import { DeviceFields } from "./device-fields";

export const metadata: Metadata = { title: "Gateways" };

export default async function DevicesPage() {
  await requireAdmin();
  const db = getDb();
  const [devs, invs] = await Promise.all([listDevices(db), listInvertersAdmin(db)]);
  const now = new Date();
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2">
        <h1 className="mb-4 text-2xl font-bold tracking-tight">Gateways</h1>
        <div className="panel overflow-x-auto p-0 sm:p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Token</th>
                <th className="text-right">WR</th>
                <th>Firmware</th>
              </tr>
            </thead>
            <tbody>
              {devs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-grey">Noch kein Gateway registriert.</td>
                </tr>
              )}
              {devs.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/admin/devices/${d.id}`} className="link">{d.name}</Link>
                    <div className="text-xs text-grey">{d.kind} · alle {d.pollIntervalS} s</div>
                  </td>
                  <td>
                    <OnlineBadge online={isDeviceOnline(d, now)} />
                    <div className="text-xs text-grey">{fmtAgo(d.lastSeenAt, now)}</div>
                  </td>
                  <td className="font-mono text-xs">{d.tokenPrefix}…</td>
                  <td className="text-right tabular-nums">{invs.filter((i) => i.inverter.deviceId === d.id).length}</td>
                  <td className="text-xs">{d.firmwareVersion ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel h-fit">
        <h2 className="panel-title">Gateway registrieren</h2>
        <ActionForm action={createDeviceAction} submitLabel="Registrieren & Token erzeugen">
          <DeviceFields />
        </ActionForm>
      </section>
    </div>
  );
}
