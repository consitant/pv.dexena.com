import { fmtEnergyWh } from "@/lib/format";

/** Vereinfachter Energiefluss PV → Haus / Netz auf Basis der geschätzten Eigenverbrauchsquote. */
export function EnergyFlow({
  totalWh,
  selfWh,
  feedWh,
  evPct,
  assumed,
}: {
  totalWh: number;
  selfWh: number;
  feedWh: number;
  evPct: number;
  assumed: boolean;
}) {
  return (
    <div>
      <svg viewBox="0 0 320 170" className="h-auto w-full" role="img" aria-label={`Erzeugung ${fmtEnergyWh(totalWh)}, davon ca. ${evPct} % Eigenverbrauch`}>
        <defs>
          <linearGradient id="flow-a" x1="0" x2="1">
            <stop offset="0" stopColor="#855ced" />
            <stop offset="1" stopColor="#a789f2" />
          </linearGradient>
          <linearGradient id="flow-b" x1="0" x2="1">
            <stop offset="0" stopColor="#855ced" />
            <stop offset="1" stopColor="#ff7049" />
          </linearGradient>
        </defs>
        {/* Linien */}
        <path d="M70 85 C 140 85, 150 40, 236 40" fill="none" stroke="url(#flow-a)" strokeWidth={4 + (evPct / 100) * 10} strokeLinecap="round" opacity="0.85" />
        <path d="M70 85 C 140 85, 150 130, 236 130" fill="none" stroke="url(#flow-b)" strokeWidth={4 + ((100 - evPct) / 100) * 10} strokeLinecap="round" opacity="0.85" />
        {/* PV */}
        <circle cx="48" cy="85" r="34" fill="#342854" />
        <g stroke="#ff977b" strokeWidth="2" strokeLinecap="round">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return <line key={i} x1={48 + Math.cos(a) * 12} y1={70 + Math.sin(a) * 12} x2={48 + Math.cos(a) * 17} y2={70 + Math.sin(a) * 17} />;
          })}
        </g>
        <circle cx="48" cy="70" r="7" fill="#ff7049" />
        <text x="48" y="99" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">PV</text>
        {/* Haus */}
        <circle cx="270" cy="40" r="30" fill="#f0ecf8" />
        <path d="M256 44 L270 30 L284 44 L284 56 L256 56 Z" fill="none" stroke="#855ced" strokeWidth="2.5" strokeLinejoin="round" />
        {/* Netz */}
        <circle cx="270" cy="130" r="30" fill="#fff1ec" />
        <path d="M270 112 L262 148 M270 112 L278 148 M262 124 L278 124 M264 136 L276 136" stroke="#ff7049" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <dt className="text-grey">Erzeugt</dt>
          <dd className="text-sm font-bold">{fmtEnergyWh(totalWh)}</dd>
        </div>
        <div>
          <dt className="text-grey">Eigenverbrauch ca.</dt>
          <dd className="text-sm font-bold text-purple">{fmtEnergyWh(selfWh)}</dd>
        </div>
        <div>
          <dt className="text-grey">Einspeisung ca.</dt>
          <dd className="text-sm font-bold text-orange">{fmtEnergyWh(feedWh)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] leading-snug text-grey">
        Schätzung mit {evPct} % Eigenverbrauch{assumed ? " (Standardannahme – kein Tarif hinterlegt)" : " laut hinterlegtem Tarif"}. Ein
        Verbrauchszähler ist nicht angeschlossen.
      </p>
    </div>
  );
}
