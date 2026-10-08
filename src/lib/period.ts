/** Zeitraum-Parsing für das Dashboard (alle Tage = Berliner Kalendertage). */
import { addDays, addMonths, daysInMonth, isValidDay } from "./time";

export type View = "day" | "month" | "year" | "total";
export const VIEWS: View[] = ["day", "month", "year", "total"];

export type Period = {
  view: View;
  /** URL-Schlüssel: YYYY-MM-DD | YYYY-MM | YYYY | "total" */
  key: string;
  /** erster Tag (inkl.) */
  start: string;
  /** letzter Tag (exkl.) */
  end: string;
  prevKey: string | null;
  nextKey: string | null;
  /** Vergleichszeitraum (Vortag/Vormonat/Vorjahr) */
  compare: { start: string; end: string; key: string } | null;
  isCurrent: boolean;
};

const MIN_YEAR = 2000;

export function parseView(v: unknown): View {
  return typeof v === "string" && (VIEWS as string[]).includes(v) ? (v as View) : "day";
}

/** Normalisiert view/date aus der URL; Zukunft wird auf den aktuellen Zeitraum geklemmt. */
export function parsePeriod(viewRaw: unknown, dateRaw: unknown, today: string): Period {
  const view = parseView(viewRaw);
  const date = typeof dateRaw === "string" ? dateRaw : "";
  switch (view) {
    case "day": {
      let d = isValidDay(date) ? date : today;
      if (d > today || d < `${MIN_YEAR}-01-01`) d = today;
      return {
        view,
        key: d,
        start: d,
        end: addDays(d, 1),
        prevKey: d > `${MIN_YEAR}-01-01` ? addDays(d, -1) : null,
        nextKey: d < today ? addDays(d, 1) : null,
        compare: { start: addDays(d, -1), end: d, key: addDays(d, -1) },
        isCurrent: d === today,
      };
    }
    case "month": {
      const cur = today.slice(0, 7);
      let m = /^\d{4}-(0[1-9]|1[0-2])$/.test(date) ? date : cur;
      if (m > cur || m < `${MIN_YEAR}-01`) m = cur;
      const start = `${m}-01`;
      const prevStart = addMonths(start, -1);
      return {
        view,
        key: m,
        start,
        end: addMonths(start, 1),
        prevKey: m > `${MIN_YEAR}-01` ? prevStart.slice(0, 7) : null,
        nextKey: m < cur ? addMonths(start, 1).slice(0, 7) : null,
        compare: { start: prevStart, end: start, key: prevStart.slice(0, 7) },
        isCurrent: m === cur,
      };
    }
    case "year": {
      const cur = Number(today.slice(0, 4));
      let y = /^\d{4}$/.test(date) ? Number(date) : cur;
      if (y > cur || y < MIN_YEAR) y = cur;
      return {
        view,
        key: String(y),
        start: `${y}-01-01`,
        end: `${y + 1}-01-01`,
        prevKey: y > MIN_YEAR ? String(y - 1) : null,
        nextKey: y < cur ? String(y + 1) : null,
        compare: { start: `${y - 1}-01-01`, end: `${y}-01-01`, key: String(y - 1) },
        isCurrent: y === cur,
      };
    }
    case "total":
      return {
        view,
        key: "total",
        start: `${MIN_YEAR}-01-01`,
        end: addDays(today, 1),
        prevKey: null,
        nextKey: null,
        compare: null,
        isCurrent: true,
      };
  }
}

/** Schlüssel für die Balken eines Zeitraums. */
export function bucketKeys(p: Period, today: string, firstDay?: string): { key: string; label: string }[] {
  switch (p.view) {
    case "day":
      return [];
    case "month": {
      const n = daysInMonth(p.start);
      return Array.from({ length: n }, (_, i) => ({ key: addDays(p.start, i), label: String(i + 1) }));
    }
    case "year":
      return MONTH_SHORT.map((label, i) => ({ key: `${p.key}-${String(i + 1).padStart(2, "0")}`, label }));
    case "total": {
      const last = Number(today.slice(0, 4));
      const first = firstDay ? Number(firstDay.slice(0, 4)) : last;
      const out = [];
      for (let y = first; y <= last; y++) out.push({ key: String(y), label: String(y) });
      return out;
    }
  }
}

/** Ordnet einen Tag dem Balken-Schlüssel der Ansicht zu. */
export function bucketOf(view: View, day: string): string {
  if (view === "month" || view === "day") return day;
  if (view === "year") return day.slice(0, 7);
  return day.slice(0, 4);
}

export const MONTH_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
