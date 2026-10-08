import type { InverterStatus } from "@/lib/portal-data";

const MAP: Record<InverterStatus, { label: string; cls: string }> = {
  ongrid: { label: "Einspeisung", cls: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  standby: { label: "Standby", cls: "bg-sky-100 text-sky-800 ring-sky-200" },
  initial: { label: "Startet", cls: "bg-sky-100 text-sky-800 ring-sky-200" },
  shutdown: { label: "Abgeschaltet", cls: "bg-stone-200 text-stone-700 ring-stone-300" },
  error: { label: "Fehler", cls: "bg-red-100 text-red-800 ring-red-200" },
  offline: { label: "Offline", cls: "bg-stone-200 text-stone-600 ring-stone-300" },
  unknown: { label: "Unbekannt", cls: "bg-stone-100 text-stone-600 ring-stone-200" },
};

export function StatusBadge({ status }: { status: InverterStatus }) {
  const s = MAP[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {s.label}
    </span>
  );
}

export function OnlineBadge({ online, labels = ["Online", "Offline"] }: { online: boolean; labels?: [string, string] }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        online ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-stone-200 text-stone-600 ring-stone-300"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {online ? labels[0] : labels[1]}
    </span>
  );
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
