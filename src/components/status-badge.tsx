import type { InverterStatus } from "@/lib/portal-data";

const MAP: Record<InverterStatus, { label: string; cls: string; dot: string }> = {
  ongrid: { label: "Einspeisung", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  standby: { label: "Standby", cls: "bg-mist text-ink ring-lilac", dot: "bg-purple" },
  initial: { label: "Startet", cls: "bg-mist text-ink ring-lilac", dot: "bg-purple" },
  night: { label: "Nachtruhe", cls: "bg-stone-100 text-stone-600 ring-stone-200", dot: "bg-stone-400" },
  shutdown: { label: "Abgeschaltet", cls: "bg-stone-100 text-stone-600 ring-stone-200", dot: "bg-stone-400" },
  error: { label: "Fehler", cls: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
  offline: { label: "Offline", cls: "bg-orange/10 text-[#b8432a] ring-orange/30", dot: "bg-orange" },
  unknown: { label: "Unbekannt", cls: "bg-stone-100 text-stone-600 ring-stone-200", dot: "bg-stone-400" },
};

export function StatusBadge({ status, className = "" }: { status: InverterStatus; className?: string }) {
  const s = MAP[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.cls} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}

export function statusLabel(s: InverterStatus) {
  return MAP[s].label;
}

export function OnlineBadge({ online, labels = ["Online", "Offline"] }: { online: boolean; labels?: [string, string] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        online ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-orange/10 text-[#b8432a] ring-orange/30"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-orange"}`} aria-hidden />
      {online ? labels[0] : labels[1]}
    </span>
  );
}

const AMPEL: Record<string, { cls: string; label: string }> = {
  green: { cls: "bg-emerald-500", label: "alles in Ordnung" },
  yellow: { cls: "bg-amber-400", label: "Status unklar" },
  red: { cls: "bg-orange", label: "Störung/offline" },
  grey: { cls: "bg-stone-300", label: "keine Wechselrichter" },
};

export function Ampel({ value }: { value: "green" | "yellow" | "red" | "grey" }) {
  const a = AMPEL[value];
  return <span className={`inline-block h-3 w-3 rounded-full ${a.cls}`} title={a.label} aria-label={a.label} role="img" />;
}

export function modeLabel(mode: number | null | undefined): string {
  switch (mode) {
    case 0:
      return "Initial";
    case 1:
      return "Standby";
    case 3:
      return "OnGrid";
    case 5:
      return "Fehler";
    case 9:
      return "Shutdown";
    default:
      return mode === null || mode === undefined ? "–" : `Modus ${mode}`;
  }
}
