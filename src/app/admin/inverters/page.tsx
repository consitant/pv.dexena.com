import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { latestPerInverter, listInvertersAdmin } from "@/lib/admin";
import { isInverterOnline } from "@/lib/offline";
import { requireAdmin } from "@/lib/session";
import { fmtAgo, fmtPower } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { deriveStatus } from "@/lib/portal-data";
import { toggleInverterAction } from "../actions";

export const metadata: Metadata = { title: "Wechselrichter" };

export default async function InvertersPage() {
  await requireAdmin();
  const db = getDb();
  const [rows, latest] = await Promise.all([listInvertersAdmin(db), latestPerInverter(db)]);
  const now = new Date();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Wechselrichter</h1>
        <Link href="/admin/inverters/new" className="btn btn-primary">Wechselrichter anlegen</Link>
      </div>
      <div className="panel overflow-x-auto p-0 sm:p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Wechselrichter</th>
              <th>Gateway / Port</th>
              <th>Kunde / Anlage</th>
              <th>Status</th>
              <th className="text-right">Leistung</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-grey">Noch keine Wechselrichter.</td>
              </tr>
            )}
            {rows.map(({ inverter: i, deviceName, customerName, siteName }) => {
              const online = isInverterOnline(i, now);
              return (
                <tr key={i.id} className={i.enabled ? "" : "opacity-60"}>
                  <td>
                    <Link href={`/admin/inverters/${i.id}`} className="link">{i.name ?? i.ref}</Link>
                    <div className="font-mono text-xs text-grey">{i.ref}</div>
                  </td>
                  <td className="text-xs">
                    {deviceName}
                    <div className="font-mono">{i.port}</div>
                  </td>
                  <td className="text-xs">
                    {customerName ?? <span className="text-grey/70">nicht zugeordnet</span>}
                    {siteName && <div className="text-grey">{siteName}</div>}
                  </td>
                  <td>
                    <StatusBadge status={deriveStatus(i, latest.get(i.id), now)} />
                    <div className="text-xs text-grey">{fmtAgo(i.lastOkAt, now)}</div>
                  </td>
                  <td className="text-right tabular-nums">{online ? fmtPower(latest.get(i.id)?.acPowerW) : "–"}</td>
                  <td className="text-right">
                    <form action={toggleInverterAction}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="enabled" value={String(!i.enabled)} />
                      <button className="btn btn-sm">{i.enabled ? "Deaktivieren" : "Aktivieren"}</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
