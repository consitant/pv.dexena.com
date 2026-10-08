"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseStickRef } from "@/lib/stick-ref";
import {
  atCommand,
  isPrivateIpv4,
  serverFields,
  staFields,
  STICK_DEFAULT_AP_IP,
  STICK_FORM_PATH,
  STICK_SERVER_HOST,
  STICK_TCP_TIMEOUT_S,
  wifiModeFields,
  type FormField,
} from "@/lib/stick-forms";
import { registerStickAction, type RegisterState } from "./actions";

type Step = 1 | 2 | 3 | 4;
const STEPS = ["Stick", "WLAN", "Übertragen", "Prüfen"];
const POLL_MS = 5000;
const POLL_MAX_MS = 5 * 60 * 1000;

export function SetupWizard({
  sites,
  initialSiteId,
  dashboardQuery,
}: {
  sites: { id: string; name: string }[];
  initialSiteId: string;
  dashboardQuery: string;
}) {
  const [step, setStep] = useState<Step>(1);
  const [siteId, setSiteId] = useState(initialSiteId);
  const [refInput, setRefInput] = useState("");
  const [reg, setReg] = useState<Extract<RegisterState, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // WLAN-Daten: nur im Browser-State, werden nie an pv.dexena.com gesendet
  const [mode, setMode] = useState<"new" | "home">("new");
  const [ssid, setSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [homeIp, setHomeIp] = useState("");
  const parsedRef = useMemo(() => parseStickRef(refInput), [refInput]);

  const stickIp = mode === "home" ? homeIp.trim() : STICK_DEFAULT_AP_IP;
  const step2Valid =
    mode === "home" ? isPrivateIpv4(homeIp) : ssid.trim().length > 0 && ssid.length <= 32 && wifiPassword.length >= 8 && wifiPassword.length <= 63;

  async function register() {
    if (!siteId || !parsedRef) return;
    setBusy(true);
    setError(null);
    // Nur Anlage und Kennung – keine WLAN-Daten
    const res = await registerStickAction({ siteId, ref: parsedRef });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setReg(res);
    setStep(2);
  }

  return (
    <div className="space-y-5">
      <p className="rounded-2xl border border-orange/40 bg-orange/10 px-4 py-3 text-sm text-ink">
        <strong className="text-orange-700">Beta</strong> – dieser Assistent wird noch an echter Hardware verifiziert. Die angezeigten Werte zum
        Abtippen funktionieren in jedem Fall.
      </p>

      <ol className="grid grid-cols-4 gap-2" aria-label="Fortschritt">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step;
          const done = n < step;
          const active = n === step;
          return (
            <li key={label} className="text-center" aria-current={active ? "step" : undefined}>
              <span
                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                  done ? "bg-emerald-600 text-white" : active ? "bg-brand-deep text-white" : "bg-mist text-ink-soft"
                }`}
              >
                {done ? "✓" : n}
              </span>
              <span className={`mt-1 block text-xs ${active ? "font-bold text-ink" : "text-ink-soft"}`}>{label}</span>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <section className="card space-y-4">
          <h2 className="text-xl font-bold">1. Anlage und Stick</h2>
          <div>
            <label className="label" htmlFor="site">Anlage</label>
            <select id="site" className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">Bitte wählen …</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ref">Kennung des WLAN-Sticks</label>
            <input
              id="ref"
              className="input font-mono"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="z. B. 10SMT_2313-123456789"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1.5 text-xs text-ink-soft">
              Steht auf dem Etikett des Sticks („SC**2313-…“) oder ist der WLAN-Name, den der Stick aufspannt („10SMT_2313-…“).
            </p>
            {refInput && (
              <p className={`mt-2 text-sm font-semibold ${parsedRef ? "text-emerald-700" : "text-orange-700"}`} role="status">
                {parsedRef ? `Erkannt: ${parsedRef}` : "Kennung nicht erkannt – bitte prüfen."}
              </p>
            )}
          </div>
          {error && <p className="rounded-2xl bg-orange/10 px-4 py-2.5 text-sm text-orange-700" role="alert">{error}</p>}
          <button className="btn btn-primary w-full py-3" disabled={!siteId || !parsedRef || busy} onClick={register}>
            {busy ? "Wird angelegt …" : "Weiter"}
          </button>
        </section>
      )}

      {step === 2 && reg && (
        <section className="card space-y-4">
          <h2 className="text-xl font-bold">2. WLAN</h2>
          <p className="text-sm text-ink-soft">
            Stick <strong className="text-ink">{reg.ref}</strong> ist angelegt und bekommt den Port <strong className="text-ink">{reg.port}</strong>.
          </p>
          <fieldset className="grid gap-2">
            <legend className="label">Wie ist der Stick angeschlossen?</legend>
            <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 ${mode === "new" ? "border-purple-600 bg-mist" : "border-ink/10"}`}>
              <input type="radio" name="mode" checked={mode === "new"} onChange={() => setMode("new")} className="mt-1 accent-[#6f45dc]" />
              <span>
                <span className="block font-semibold">Neu / Auslieferungszustand</span>
                <span className="text-sm text-ink-soft">Der Stick hat ein eigenes WLAN „10SMT_…“ und soll in Ihr Heim-WLAN.</span>
              </span>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 ${mode === "home" ? "border-purple-600 bg-mist" : "border-ink/10"}`}>
              <input type="radio" name="mode" checked={mode === "home"} onChange={() => setMode("home")} className="mt-1 accent-[#6f45dc]" />
              <span>
                <span className="block font-semibold">Stick ist schon im Heim-WLAN</span>
                <span className="text-sm text-ink-soft">Nur die Server-Verbindung muss eingestellt werden.</span>
              </span>
            </label>
          </fieldset>

          {mode === "new" ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-mist px-4 py-3 text-sm">
                🔒 Name und Passwort Ihres WLANs bleiben <strong>nur in diesem Browser</strong>. Sie werden nicht an pv.dexena.com gesendet,
                sondern im nächsten Schritt direkt an den Stick übertragen.
              </div>
              <div>
                <label className="label" htmlFor="ssid">Name Ihres Heim-WLANs (SSID)</label>
                <input id="ssid" className="input" value={ssid} onChange={(e) => setSsid(e.target.value)} maxLength={32} autoComplete="off" spellCheck={false} />
              </div>
              <div>
                <label className="label" htmlFor="wpw">WLAN-Passwort</label>
                <div className="flex gap-2">
                  <input
                    id="wpw"
                    className="input"
                    type={showPw ? "text" : "password"}
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    maxLength={63}
                    autoComplete="off"
                  />
                  <button type="button" className="btn shrink-0" onClick={() => setShowPw((v) => !v)} aria-pressed={showPw}>
                    {showPw ? "Verbergen" : "Anzeigen"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-ink-soft">WPA2, 8–63 Zeichen. Der Stick unterstützt nur 2,4-GHz-WLAN.</p>
              </div>
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="ip">IP-Adresse des Sticks im Heimnetz</label>
              <input id="ip" className="input font-mono" value={homeIp} onChange={(e) => setHomeIp(e.target.value)} placeholder="192.168.1.50" inputMode="decimal" />
              <p className="mt-1 text-xs text-ink-soft">Zu finden in der Geräteübersicht Ihres Routers (Gerätename oft „HF-…“ oder „10SMT…“).</p>
              {homeIp && !isPrivateIpv4(homeIp) && <p className="mt-1 text-sm text-orange-700">Bitte eine Adresse aus dem Heimnetz angeben (z. B. 192.168.x.x).</p>}
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn" onClick={() => setStep(1)}>Zurück</button>
            <button className="btn btn-primary flex-1 py-3" disabled={!step2Valid} onClick={() => setStep(3)}>
              Weiter
            </button>
          </div>
        </section>
      )}

      {step === 3 && reg && (
        <Transfer
          reg={reg}
          mode={mode}
          ip={stickIp}
          ssid={ssid}
          wifiPassword={wifiPassword}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}

      {step === 4 && reg && <Verify reg={reg} siteHref={`/dashboard/sites/${siteId}${dashboardQuery}`} onBack={() => setStep(3)} />}
    </div>
  );
}

function StickForm({ ip, fields, label, onSent, sent }: { ip: string; fields: FormField[]; label: string; onSent: () => void; sent: boolean }) {
  // Top-Level-Form-Submit in neuem Tab – fetch/XHR an den Stick ist von HTTPS aus nicht möglich
  return (
    <form method="post" action={`http://${ip}${STICK_FORM_PATH}`} target="_blank" onSubmit={onSent}>
      {fields.map((f) => (
        <input key={f.name} type="hidden" name={f.name} value={f.value} />
      ))}
      <button className={`btn w-full justify-between py-3 ${sent ? "" : "btn-primary"}`}>
        <span>{label}</span>
        <span aria-hidden>{sent ? "✓ gesendet" : "→"}</span>
      </button>
    </form>
  );
}

function Transfer({
  reg,
  mode,
  ip,
  ssid,
  wifiPassword,
  onBack,
  onNext,
}: {
  reg: Extract<RegisterState, { ok: true }>;
  mode: "new" | "home";
  ip: string;
  ssid: string;
  wifiPassword: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const mark = (k: string) => () => setSent((s) => ({ ...s, [k]: true }));
  const nr = reg.ref.replace(/^SC/, "");
  return (
    <section className="card space-y-5">
      <h2 className="text-xl font-bold">3. Einstellungen übertragen</h2>
      {mode === "new" ? (
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            Öffnen Sie die <strong>WLAN-Einstellungen</strong> Ihres Handys und verbinden Sie sich mit dem WLAN des Sticks
            <strong> „10SMT_{nr}“</strong> (der Name kann je nach Modell leicht abweichen, endet aber auf {nr}).
          </li>
          <li>Kommen Sie danach zu <strong>dieser Seite</strong> zurück – sie bleibt geöffnet.</li>
          <li>Tippen Sie die Schaltflächen der Reihe nach an. Jede öffnet einen neuen Tab mit der Antwort des Sticks.</li>
        </ol>
      ) : (
        <p className="text-sm">Ihr Handy muss im selben Heim-WLAN wie der Stick ({ip}) sein.</p>
      )}

      <details className="rounded-2xl bg-mist px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold">Was der Browser dabei fragen kann</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
          <li><strong className="text-ink">Anmeldung am Stick:</strong> Benutzername und Passwort vom Etikett bzw. die Werkseinstellung aus der Anleitung.</li>
          <li><strong className="text-ink">„Formular ist nicht sicher“:</strong> Der Stick kann nur unverschlüsseltes HTTP im lokalen Netz. Mit „Trotzdem senden“ bestätigen.</li>
          <li><strong className="text-ink">„Geräte im lokalen Netzwerk“:</strong> Zugriff erlauben, damit der Browser den Stick erreicht.</li>
          <li>Funktioniert eine Schaltfläche nicht, geben Sie die Werte unten von Hand in der Weboberfläche des Sticks ein (http://{ip}).</li>
        </ul>
      </details>

      <div className="space-y-2">
        {mode === "new" && (
          <>
            <StickForm ip={ip} fields={wifiModeFields()} label="① Betriebsart AP+STA setzen" sent={!!sent.mode} onSent={mark("mode")} />
            <StickForm ip={ip} fields={staFields(ssid, wifiPassword)} label="② WLAN-Daten übertragen" sent={!!sent.sta} onSent={mark("sta")} />
          </>
        )}
        <StickForm
          ip={ip}
          fields={serverFields(reg.port)}
          label={`${mode === "new" ? "③" : "①"} Server-Verbindung übertragen`}
          sent={!!sent.net}
          onSent={mark("net")}
        />
      </div>

      <div className="rounded-2xl border border-ink/10 px-4 py-3 text-sm">
        <p className="font-semibold">{mode === "new" ? "④" : "②"} Stick neu starten</p>
        <p className="text-ink-soft">
          In der Weboberfläche des Sticks „Restart“ wählen – oder den Stick ca. 10 Sekunden stromlos machen (abziehen/Wechselrichter-Sicherung).
          Nach dem Neustart verbindet er sich mit Ihrem WLAN und dem Server.
        </p>
      </div>

      <ManualValues mode={mode} ssid={ssid} port={reg.port} />

      <div className="flex gap-2">
        <button className="btn" onClick={onBack}>Zurück</button>
        <button className="btn btn-primary flex-1 py-3" onClick={onNext}>
          Fertig – Verbindung prüfen
        </button>
      </div>
    </section>
  );
}

function ManualValues({ mode, ssid, port }: { mode: "new" | "home"; ssid: string; port: number }) {
  const groups: { title: string; hint: string; rows: [string, string][] }[] = [];
  if (mode === "new") {
    groups.push({ title: "Mode Selection", hint: "Menü „Mode Selection“", rows: [["Mode", "AP+STA mode"]] });
    groups.push({
      title: "STA Setting",
      hint: "Menü „STA Setting“ → Speichern („Save“)",
      rows: [
        ["Network Name (SSID)", ssid],
        ["Encryption Method", "WPA2PSK"],
        ["Encryption Algorithm", "AES"],
        ["Password", "Ihr WLAN-Passwort"],
        ["Obtain an IP address automatically", "Enable"],
      ],
    });
  }
  groups.push({
    title: "Other Setting → Network",
    hint: "Menü „Other Setting“, Bereich Netzwerk → Speichern („Save“)",
    rows: [
      ["Protocol", "TCP-Client"],
      ["Port ID", String(port)],
      ["Server Address", STICK_SERVER_HOST],
      ["TCP Time Out Setting", String(STICK_TCP_TIMEOUT_S)],
    ],
  });
  return (
    <details className="rounded-2xl border border-ink/10 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold">Werte zum Abtippen (manuell)</summary>
      <div className="mt-3 space-y-4">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="text-sm font-bold">{g.title}</p>
            <p className="mb-2 text-xs text-ink-soft">{g.hint}</p>
            <dl className="divide-y divide-ink/5 rounded-2xl bg-mist/60">
              {g.rows.map(([k, v]) => (
                <div key={k} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="flex items-center gap-2 font-mono font-semibold">
                    {v}
                    {v !== "Ihr WLAN-Passwort" && v && <Copy value={v} />}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <p className="text-xs text-ink-soft">
          Alternativ per AT-Befehl (für Fachleute): <code className="rounded bg-mist px-1">{atCommand(port)}</code>
        </p>
      </div>
    </details>
  );
}

function Copy({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm font-sans"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      aria-label={`${value} kopieren`}
    >
      {ok ? "Kopiert" : "Kopieren"}
    </button>
  );
}

function Verify({ reg, siteHref, onBack }: { reg: Extract<RegisterState, { ok: true }>; siteHref: string; onBack: () => void }) {
  const [state, setState] = useState<"polling" | "ok" | "timeout">("polling");
  const [elapsed, setElapsed] = useState(0);
  const [run, setRun] = useState(0);
  const started = useRef(0);

  useEffect(() => {
    started.current = Date.now();
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const ms = Date.now() - started.current;
      setElapsed(ms);
      try {
        const r = await fetch(`/api/setup/status?inverter=${reg.inverterId}`, { cache: "no-store" });
        if (r.ok) {
          const s = (await r.json()) as { connected: boolean; lastOkAt: string | null };
          const fresh = s.lastOkAt && Date.parse(s.lastOkAt) > started.current - 10 * 60_000;
          if (s.connected || fresh) {
            setState("ok");
            return;
          }
        }
      } catch {
        // Netz kurz weg (Handy wechselt gerade das WLAN) – weiter versuchen
      }
      if (ms >= POLL_MAX_MS) return setState("timeout");
      setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [reg.inverterId, run]);

  return (
    <section className="card space-y-4">
      <h2 className="text-xl font-bold">4. Verbindung prüfen</h2>
      <p className="text-sm">
        Verbinden Sie Ihr Handy wieder mit Ihrem <strong>Heim-WLAN</strong> (oder mobilen Daten). Wir prüfen alle 5 Sekunden, ob sich der Stick meldet.
      </p>
      {state === "polling" && (
        <div className="flex items-center gap-3 rounded-2xl bg-mist px-4 py-4" role="status" aria-live="polite">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" aria-hidden />
          <span className="text-sm">
            Warte auf Verbindung … {Math.floor(elapsed / 1000)} s von max. 5 min
          </span>
        </div>
      )}
      {state === "ok" && (
        <div className="space-y-3 rounded-2xl bg-emerald-50 px-4 py-4 text-emerald-900" role="status">
          <p className="text-lg font-bold">Verbunden ✓</p>
          <p className="text-sm">Erste Messwerte kommen in Kürze (das Gateway fragt alle paar Minuten ab).</p>
          <Link href={siteHref} className="btn btn-primary">Zur Anlage</Link>
        </div>
      )}
      {state === "timeout" && (
        <div className="space-y-3 rounded-2xl bg-orange/10 px-4 py-4" role="alert">
          <p className="font-bold text-orange-700">Noch keine Verbindung</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Stick neu starten (ca. 10 s stromlos) und eine Minute warten.</li>
            <li>WLAN-Name und Passwort prüfen – der Stick kann nur 2,4 GHz.</li>
            <li>WLAN-Empfang am Wechselrichter prüfen (Repeater näher stellen).</li>
            <li>Der Wechselrichter muss <strong>tagsüber in Betrieb</strong> sein – nachts antwortet er nicht.</li>
            <li>Port und Server-Adresse kontrollieren: Port {reg.port}, {STICK_SERVER_HOST}.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-primary"
              onClick={() => {
                setState("polling");
                setRun((r) => r + 1);
              }}
            >
              Erneut prüfen
            </button>
            <button className="btn" onClick={onBack}>Zurück zu Schritt 3</button>
          </div>
        </div>
      )}
    </section>
  );
}
