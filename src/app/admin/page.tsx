import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { latestPerInverter, listDevices, listInvertersAdmin, recentAudit } from "@/lib/admin";
import { isDeviceOnline, isInverterOnline } from "@/lib/offline";
import { requireAdmin } from "@/lib/session";
import { fmtAgo, fmtDateTime, fmtEnergyWh, fmtNum, fmtPower } from "@/lib/format";
import { modeLabel, OnlineBadge } from "@/components/status-badge";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverview() {
  await requireAdmin();
  const db = getDb();
  const [devs, invs, latest, audit] = await Promise.all([
    listDevices(db),
    listInvertersAdmin(db),
    latestPerInverter(db),
    recentAudit(db, 10),
  ]);
  const now = new Date();
  const onlineInv = invs.filter((r) => isInverterOnline(r.inverter, now)).length;

  return (
    <div className="space-y-6">
      <AutoRefresh intervalS={60} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Übersicht</h1>
          <p className="text-sm text-stone-500">
            {devs.filter((d) => isDeviceOnline(d, now)).length}/{devs.length} Gateways online · {onlineInv}/{invs.length} Wechselrichter verbunden
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/inverters/new" className="btn btn-primary">Wechselrichter anlegen</Link>
          <Link href="/admin/devices" className="btn">Gateway registrieren</Link>
        </div>
      </div>

      {devs.length === 0 && (
        <div className="card text-sm text-stone-600">
          Noch kein Gateway registriert. <Link href="/admin/devices" className="link">Jetzt registrieren</Link>.
        </div>
      )}

      {devs.map((d) => {
        const rows = invs.filter((r) => r.inverter.deviceId === d.id);
        return (
          <section key={d.id} className="card overflow-hidden p-0 sm:p-0">
            <header className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-4 py-3">
              <Link href={`/admin/devices/${d.id}`} className="font-semibold hover:underline">{d.name}</Link>
              <OnlineBadge online={isDeviceOnline(d, now)} />
              <span className="text-xs text-stone-500">
                {d.kind} · FW {d.firmwareVersion ?? "–"} · zuletzt {fmtAgo(d.lastSeenAt, now)}
              </span>
            </header>
            {rows.length === 0 ? (
              <p className="px-4 py-3 text-sm text-stone-500">Keine Wechselrichter zugeordnet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Port</th>
                      <th>Wechselrichter</th>
                      <th>Kunde / Anlage</th>
                      <th>Status</th>
                      <th className="text-right">Leistung</th>
                      <th className="text-right">Heute</th>
                      <th className="text-right">Temp.</th>
                      <th>Letzte Verbindung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ inverter: i, customerName, siteName }) => {
                      const l = latest.get(i.id);
                      const online = isInverterOnline(i, now);
                      return (
                        <tr key={i.id} className={i.enabled ? "" : "opacity-50"}>
                          <td className="font-mono">{i.port}</td>
                          <td>
                            <Link href={`/admin/inverters/${i.id}`} className="link">{i.name ?? i.ref}</Link>
                            <div className="text-xs text-stone-500">{i.ref}{!i.enabled && " · deaktiviert"}</div>
                          </td>
                          <td className="text-xs">
                            {i.customerId ? (
                              <Link href={`/admin/customers/${i.customerId}`} className="link">{customerName}</Link>
                            ) : (
                              <span className="text-stone-400">nicht zugeordnet</span>
                            )}
                            {siteName && <div className="text-stone-500">{siteName}</div>}
                          </td>
                          <td>
                            <OnlineBadge online={online} labels={["verbunden", "offline"]} />
                            <div className="mt-0.5 text-xs text-stone-500">{online ? modeLabel(l?.mode) : ""}</div>
                            {i.lastError && <div className="mt-0.5 max-w-56 truncate text-xs text-red-700" title={i.lastError}>{i.lastError}</div>}
                          </td>
                          <td className="text-right tabular-nums">{online ? fmtPower(l?.acPowerW) : "–"}</td>
                          <td className="text-right tabular-nums">{fmtEnergyWh(l?.energyTodayWh)}</td>
                          <td className="text-right tabular-nums">{l?.temperatureC != null ? `${fmtNum(l.temperatureC, 0)} °C` : "–"}</td>
                          <td className="text-xs" title={fmtDateTime(i.lastOkAt)}>
                            {fmtAgo(i.lastOkAt, now)}
                            {l && <div className="text-stone-500">Messwert {fmtAgo(l.ts, now)}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {audit.length > 0 && (
        <section className="card">
          <h2 className="card-title">Letzte Admin-Aktionen</h2>
          <ul className="space-y-1 text-sm">
            {audit.map(({ a, email }) => (
              <li key={a.id} className="flex flex-wrap gap-x-3 text-stone-600">
                <span className="text-stone-400">{fmtDateTime(a.createdAt)}</span>
                <span className="font-mono text-xs">{a.action}</span>
                <span className="text-stone-500">{email ?? "–"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
