const nf0 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function fmtPower(w: number | null | undefined): string {
  if (w === null || w === undefined) return "–";
  if (Math.abs(w) >= 1000) return `${nf2.format(w / 1000)} kW`;
  return `${nf0.format(w)} W`;
}

/** Energie mit automatischer Einheit (Wh → kWh → MWh). */
export function fmtEnergyWh(wh: number | null | undefined): string {
  if (wh === null || wh === undefined) return "–";
  if (Math.abs(wh) >= 1_000_000) return `${nf2.format(wh / 1_000_000)} MWh`;
  if (Math.abs(wh) >= 100_000) return `${nf0.format(wh / 1000)} kWh`;
  return `${nf1.format(wh / 1000)} kWh`;
}

export function fmtKwh(kwh: number | null | undefined): string {
  if (kwh === null || kwh === undefined) return "–";
  return fmtEnergyWh(kwh * 1000);
}

export function fmtEur(x: number | null | undefined): string {
  if (x === null || x === undefined) return "–";
  return eur.format(Math.round((x + Number.EPSILON) * 100) / 100);
}

export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return "–";
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

export function fmtPct(p: number | null | undefined): string {
  if (p === null || p === undefined) return "–";
  return `${p > 0 ? "+" : ""}${nf1.format(p)} %`;
}

const dtf = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function fmtDateTime(d: Date | null | undefined): string {
  return d ? dtf.format(d) : "–";
}

const timeOnly = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
export function fmtTime(d: Date | number): string {
  return timeOnly.format(d);
}

export function fmtAgo(d: Date | null | undefined, now: Date = new Date()): string {
  if (!d) return "nie";
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return "gerade eben";
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `vor ${h} h`;
  return `vor ${Math.round(h / 24)} Tagen`;
}

export function fmtDay(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}

const weekdayFmt = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export function fmtDayLong(day: string): string {
  return weekdayFmt.format(new Date(`${day}T12:00:00Z`));
}

const monthFmt = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
export function fmtMonth(month: string): string {
  return monthFmt.format(new Date(`${month.slice(0, 7)}-01T12:00:00Z`));
}
