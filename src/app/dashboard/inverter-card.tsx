import type { DashboardData } from "@/lib/portal-data";
import { fmtAgo, fmtDateTime, fmtEnergyWh, fmtKwh, fmtNum, fmtPower } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

export function InverterCard({ inv }: { inv: DashboardData["inverters"][number] }) {
  const l = inv.latest;
  const pv = (l?.pv ?? []).filter((s, i) => i < 2 || s.u > 0 || s.p > 0);
  return (
    <article className="card">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{inv.name ?? inv.ref}</h3>
          <p className="truncate text-xs text-stone-500">
            {[inv.model, inv.siteName, inv.name ? inv.ref : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <StatusBadge status={inv.status} />
      </header>

      <dl className="grid grid-cols-3 gap-2 text-sm">
        <Stat label="Leistung" value={fmtPower(inv.powerW)} />
        <Stat label="Heute" value={fmtEnergyWh(inv.todayWh)} />
        <Stat label="Gesamt" value={fmtKwh(inv.totalKwh)} />
        <Stat label="Temperatur" value={l?.temperatureC != null ? `${fmtNum(l.temperatureC, 0)} °C` : "–"} />
        <Stat label="Max. heute" value={inv.todayWh > 0 ? fmtPower(l?.maxPowerTodayW) : "–"} />
        <Stat label="Nennleistung" value={inv.ratedPowerW ? fmtPower(inv.ratedPowerW) : "–"} />
      </dl>

      {pv.length > 0 && inv.status !== "offline" && (
        <div className="mt-4 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>PV-String</th>
                <th className="text-right">Spannung</th>
                <th className="text-right">Strom</th>
                <th className="text-right">Leistung</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {pv.map((s, i) => (
                <tr key={i}>
                  <td>String {i + 1}</td>
                  <td className="text-right">{fmtNum(s.u, 1)} V</td>
                  <td className="text-right">{fmtNum(s.i, 2)} A</td>
                  <td className="text-right">{fmtPower(s.p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-stone-500">
        <span title={fmtDateTime(l?.ts)}>Letzter Messwert: {fmtAgo(l?.ts)}</span>
        {inv.status === "error" && <span className="text-red-700">Wechselrichter meldet Fehler</span>}
        {inv.status === "offline" && inv.lastError && <span className="text-stone-600">Verbindung: {inv.lastError}</span>}
      </footer>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-2.5 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
