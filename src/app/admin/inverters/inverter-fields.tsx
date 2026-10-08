"use client";

import { useState } from "react";
import { CopyText } from "@/components/copy-text";

export type InverterFormOptions = {
  devices: { id: string; name: string; nextPort: number | null }[];
  customers: { id: string; name: string }[];
  sites: { id: string; name: string; customerId: string }[];
  host: string;
};

export type InverterFormValues = {
  ref?: string;
  deviceId?: string | null;
  port?: number | null;
  enabled?: boolean;
  name?: string | null;
  model?: string | null;
  ratedPowerW?: number | null;
  customerId?: string | null;
  siteId?: string | null;
};

export function InverterFields({ options, initial = {} }: { options: InverterFormOptions; initial?: InverterFormValues }) {
  const initialDevice = initial.deviceId ?? options.devices[0]?.id ?? "";
  const [deviceId, setDeviceId] = useState(initialDevice);
  const [port, setPort] = useState<string>(
    String(initial.port ?? options.devices.find((d) => d.id === initialDevice)?.nextPort ?? ""),
  );
  const [customerId, setCustomerId] = useState(initial.customerId ?? "");
  const [siteId, setSiteId] = useState(initial.siteId ?? "");
  const sitesForCustomer = options.sites.filter((s) => s.customerId === customerId);
  const portNum = Number(port);
  const validPort = Number.isInteger(portNum) && portNum >= 18900 && portNum <= 18999;

  return (
    <div className="space-y-4">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Verbindung</legend>
        <div className="sm:col-span-2">
          <label className="label">Kennung (Modul-ID des WLAN-Sticks, ohne **) *</label>
          <input className="input font-mono" name="ref" required defaultValue={initial.ref ?? ""} placeholder="SC2313-123456789" />
        </div>
        <div>
          <label className="label">Gateway *</label>
          <select
            className="input"
            name="deviceId"
            required
            value={deviceId}
            onChange={(e) => {
              const id = e.target.value;
              setDeviceId(id);
              if (id === initial.deviceId && initial.port) setPort(String(initial.port));
              else setPort(String(options.devices.find((d) => d.id === id)?.nextPort ?? ""));
            }}
          >
            {options.devices.length === 0 && <option value="">Erst ein Gateway registrieren</option>}
            {options.devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Port (18900–18999) *</label>
          <input
            className="input font-mono"
            name="port"
            type="number"
            min={18900}
            max={18999}
            required
            value={port}
            onChange={(e) => setPort(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="enabled" defaultChecked={initial.enabled ?? true} className="h-4 w-4 accent-amber-500" />
          Aktiv (Gateway öffnet den Port und fragt ab)
        </label>
        {validPort && (
          <div className="rounded-xl bg-stone-50 p-3 text-sm sm:col-span-2">
            <p className="mb-1 text-xs text-stone-500">AT-Befehl für den WLAN-Stick (danach <code>AT+Z</code> für Neustart):</p>
            <CopyText value={`AT+SOCKB=TCP,${portNum},${options.host}`} />
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Gerät</legend>
        <div>
          <label className="label">Anzeigename</label>
          <input className="input" name="name" defaultValue={initial.name ?? ""} placeholder="z. B. WR Garage" />
        </div>
        <div>
          <label className="label">Modell</label>
          <input className="input" name="model" defaultValue={initial.model ?? ""} placeholder="10SMT" />
        </div>
        <div>
          <label className="label">Nennleistung (W)</label>
          <input className="input" name="ratedPowerW" type="number" min={0} defaultValue={initial.ratedPowerW ?? ""} placeholder="10000" />
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Zuordnung</legend>
        <div>
          <label className="label">Kunde</label>
          <select
            className="input"
            name="customerId"
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setSiteId("");
            }}
          >
            <option value="">– nicht zugeordnet –</option>
            {options.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Anlage</label>
          <select className="input" name="siteId" value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={!customerId}>
            <option value="">– ohne Anlage –</option>
            {sitesForCustomer.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
    </div>
  );
}
