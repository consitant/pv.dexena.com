import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { listTariffs } from "@/lib/tariffs";
import { getCustomer, listSitesForCustomer } from "@/lib/portal-data";
import { resolveSiteViewer } from "@/lib/session";
import { berlinDay } from "@/lib/time";
import { fmtDay, fmtNum } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { ContextBar } from "../../../context-bar";
import { deleteTariffAction, saveTariffAction } from "../../../actions";

export const metadata: Metadata = { title: "Anlagen-Einstellungen" };

export default async function SiteSettingsPage({ params }: PageProps<"/dashboard/sites/[id]/settings">) {
  const { id } = await params;
  const { site, customerId, isAdmin } = await resolveSiteViewer(id);
  const db = getDb();
  const [customer, siteList, list] = await Promise.all([getCustomer(db, customerId), listSitesForCustomer(db, customerId), listTariffs(db, site.id)]);
  const q = isAdmin ? `?customer=${customerId}` : "";
  const today = berlinDay(new Date());
  const current = [...list].reverse().find((t) => t.validFrom <= today);

  return (
    <>
      <ContextBar
        isAdmin={isAdmin}
        customerId={customerId}
        customerName={customer?.name ?? ""}
        title="Strompreis & Ersparnis"
        subtitle={site.name}
        sites={siteList.map((s) => ({ id: s.id, name: s.name }))}
        currentSiteId={site.id}
        back={{ href: `/dashboard/sites/${site.id}${q}`, label: "Zurück zur Anlage" }}
      />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card">
          <h2 className="card-title">Tarife</h2>
          {list.length === 0 ? (
            <p className="text-sm text-grey">Noch kein Tarif hinterlegt. Ohne Tarif wird keine Ersparnis berechnet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Gültig ab</th>
                    <th className="text-right">Bezugspreis</th>
                    <th className="text-right">Einspeisung</th>
                    <th className="text-right">Eigenverbr.</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {list.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {fmtDay(t.validFrom)}
                        {current?.id === t.id && <span className="ml-2 rounded-full bg-mist px-2 py-0.5 text-[10px] font-bold text-purple">aktuell</span>}
                      </td>
                      <td className="text-right">{fmtNum(t.priceCtPerKwh, 2)} ct</td>
                      <td className="text-right">{fmtNum(t.feedInCtPerKwh, 2)} ct</td>
                      <td className="text-right">{fmtNum(t.selfConsumptionPct, 0)} %</td>
                      <td className="text-right">
                        <form action={deleteTariffAction}>
                          <input type="hidden" name="siteId" value={site.id} />
                          <input type="hidden" name="tariffId" value={t.id} />
                          <button className="btn btn-danger btn-sm">Löschen</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-xs leading-relaxed text-grey">
            Ersparnis je Tag = Ertrag × (Eigenverbrauchsquote × Bezugspreis + (1 − Quote) × Einspeisevergütung). Für jeden Tag gilt der
            jeweils gültige Tarif. Da kein Verbrauchszähler angeschlossen ist, handelt es sich um eine Schätzung auf Basis der
            angegebenen Eigenverbrauchsquote.
          </p>
        </section>
        <section className="card h-fit">
          <h2 className="card-title">Tarif hinzufügen / ändern</h2>
          <ActionForm action={saveTariffAction} submitLabel="Speichern">
            <input type="hidden" name="siteId" value={site.id} />
            <div>
              <label className="label" htmlFor="validFrom">Gültig ab</label>
              <input className="input" id="validFrom" name="validFrom" type="date" required defaultValue={current ? today : (site.commissionedOn ?? today)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="price">Bezugspreis brutto (ct/kWh)</label>
                <input className="input" id="price" name="priceCtPerKwh" inputMode="decimal" required defaultValue={current?.priceCtPerKwh ?? ""} placeholder="z. B. 32,5" />
              </div>
              <div>
                <label className="label" htmlFor="feed">Einspeisevergütung (ct/kWh)</label>
                <input className="input" id="feed" name="feedInCtPerKwh" inputMode="decimal" required defaultValue={current?.feedInCtPerKwh ?? ""} placeholder="z. B. 8,1" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="ev">Geschätzter Eigenverbrauch (%)</label>
              <input className="input" id="ev" name="selfConsumptionPct" type="number" min={0} max={100} step={1} defaultValue={current?.selfConsumptionPct ?? 30} />
              <p className="mt-1 text-xs text-grey">Typisch ohne Speicher 20–35 %, mit Speicher 50–70 %.</p>
            </div>
            <p className="text-xs text-grey">Gleiches Datum überschreibt den bestehenden Eintrag.</p>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
