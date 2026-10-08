/** Zeit-Helfer: alle Kalendertage beziehen sich auf Europe/Berlin. */
export const TZ = "Europe/Berlin";

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Berliner Kalendertag als "YYYY-MM-DD". */
export function berlinDay(d: Date): string {
  return dayFmt.format(d);
}

/** Erster Tag des Monats ("YYYY-MM-01") zu einem Tag "YYYY-MM-DD". */
export function monthOf(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/** Addiert Tage zu "YYYY-MM-DD" (rein kalendarisch, zeitzonenunabhängig). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMonths(month: string, n: number): string {
  const d = new Date(`${month.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

export function daysInMonth(month: string): number {
  const d = new Date(`${month.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.getUTCDate();
}

export function isValidDay(s: string | undefined | null): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
