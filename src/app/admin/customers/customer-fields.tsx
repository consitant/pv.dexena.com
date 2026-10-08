"use client";

import { useState } from "react";

type C = {
  customerNo?: string | null;
  kind?: "private" | "business";
  salutation?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  notes?: string | null;
  tags?: string[];
  active?: boolean;
  contractStart?: string | null;
  maintenanceContract?: boolean;
  nextMaintenanceOn?: string | null;
  name?: string;
};

export function CustomerFields({ c = {}, compact = false }: { c?: C; compact?: boolean }) {
  const [kind, setKind] = useState<"private" | "business">(c.kind ?? "private");
  const [maint, setMaint] = useState(c.maintenanceContract ?? false);
  // Altbestand: nur Name gepflegt → als Nachname vorbelegen
  const lastName = c.lastName ?? (c.companyName || c.firstName ? "" : (c.name ?? ""));
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Kundennummer</label>
          <input className="input font-mono" name="customerNo" defaultValue={c.customerNo ?? ""} placeholder="automatisch (K-00001)" />
        </div>
        <div>
          <label className="label">Kundenart</label>
          <div className="inline-flex w-full rounded-full bg-mist p-1" role="radiogroup">
            {(["private", "business"] as const).map((k) => (
              <label key={k} className={`flex-1 cursor-pointer rounded-full px-3 py-1.5 text-center text-sm font-semibold ${kind === k ? "bg-white text-purple-600 shadow-sm" : "text-ink-soft"}`}>
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                {k === "private" ? "Privat" : "Firma"}
              </label>
            ))}
          </div>
        </div>
      </div>
      {kind === "business" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Firmenname *</label>
            <input className="input" name="companyName" required defaultValue={c.companyName ?? ""} />
          </div>
          <div>
            <label className="label">Ansprechpartner</label>
            <input className="input" name="contactPerson" defaultValue={c.contactPerson ?? ""} />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[110px_1fr_1fr]">
          <div>
            <label className="label">Anrede</label>
            <select className="input" name="salutation" defaultValue={c.salutation ?? ""}>
              <option value="">–</option>
              <option>Frau</option>
              <option>Herr</option>
              <option>Divers</option>
            </select>
          </div>
          <div>
            <label className="label">Vorname</label>
            <input className="input" name="firstName" defaultValue={c.firstName ?? ""} />
          </div>
          <div>
            <label className="label">Nachname *</label>
            <input className="input" name="lastName" required defaultValue={lastName} />
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">E-Mail</label>
          <input className="input" name="email" type="email" defaultValue={c.email ?? ""} />
        </div>
        <div>
          <label className="label">Telefon</label>
          <input className="input" name="phone" defaultValue={c.phone ?? ""} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <div>
          <label className="label">Rechnungsadresse</label>
          <textarea className="input" name="address" rows={2} defaultValue={c.address ?? ""} />
        </div>
        <div>
          <label className="label">Ort</label>
          <input className="input" name="city" defaultValue={c.city ?? ""} />
        </div>
      </div>
      {!compact && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Vertragsbeginn</label>
              <input className="input" name="contractStart" type="date" defaultValue={c.contractStart ?? ""} />
            </div>
            <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
              <input type="checkbox" name="maintenanceContract" checked={maint} onChange={(e) => setMaint(e.target.checked)} className="h-4 w-4 accent-[#855ced]" />
              Wartungsvertrag
            </label>
            <div>
              <label className="label">Nächster Wartungstermin</label>
              <input className="input" name="nextMaintenanceOn" type="date" defaultValue={c.nextMaintenanceOn ?? ""} disabled={!maint} />
            </div>
          </div>
          <div>
            <label className="label">Tags (kommagetrennt)</label>
            <input className="input" name="tags" defaultValue={(c.tags ?? []).join(", ")} placeholder="z. B. Gewerbe, Speicher geplant" />
          </div>
          <div>
            <label className="label">Interne Notizen</label>
            <textarea className="input" name="notes" rows={3} defaultValue={c.notes ?? ""} />
          </div>
        </>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={c.active ?? true} className="h-4 w-4 accent-[#855ced]" />
        Kunde aktiv (inaktiv sperrt den Login aller Benutzer)
      </label>
    </div>
  );
}
