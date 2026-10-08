/** Ersparnis-/Ertragsrechnung in € auf Basis der Tarife je Anlage (Schätzung, kein Verbrauchszähler). */

export type TariffRow = {
  siteId: string;
  validFrom: string;
  priceCtPerKwh: number;
  feedInCtPerKwh: number;
  selfConsumptionPct: number;
};

export type Money = {
  /** eingesparte Stromkosten durch Eigenverbrauch */
  selfEur: number;
  /** Einspeisevergütung */
  feedEur: number;
  /** Energie ohne gültigen Tarif (wird nicht bewertet) */
  unpricedWh: number;
  /** geschätzt selbst verbrauchte bzw. eingespeiste Energie */
  selfWh: number;
  feedWh: number;
};

export const DEFAULT_SELF_CONSUMPTION_PCT = 30;

export function emptyMoney(): Money {
  return { selfEur: 0, feedEur: 0, unpricedWh: 0, selfWh: 0, feedWh: 0 };
}

export function addMoney(a: Money, b: Money): Money {
  return {
    selfEur: a.selfEur + b.selfEur,
    feedEur: a.feedEur + b.feedEur,
    unpricedWh: a.unpricedWh + b.unpricedWh,
    selfWh: a.selfWh + b.selfWh,
    feedWh: a.feedWh + b.feedWh,
  };
}

/** Tarife je Anlage, aufsteigend nach valid_from sortiert. */
export function groupTariffs(rows: TariffRow[]): Map<string, TariffRow[]> {
  const m = new Map<string, TariffRow[]>();
  for (const r of rows) {
    const list = m.get(r.siteId) ?? [];
    list.push(r);
    m.set(r.siteId, list);
  }
  for (const list of m.values()) list.sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  return m;
}

/** Am Tag `day` gültiger Tarif (letzter mit valid_from <= day) oder null. */
export function tariffAt(list: TariffRow[] | undefined, day: string): TariffRow | null {
  if (!list) return null;
  let found: TariffRow | null = null;
  for (const t of list) {
    if (t.validFrom <= day) found = t;
    else break;
  }
  return found;
}

/**
 * Ertrag eines Tages bewerten:
 * Ersparnis = kWh × EV% × Bezugspreis, Einspeisung = kWh × (1 − EV%) × Vergütung.
 * Ohne Tarif: nicht bewertet (unpricedWh), Energiefluss mit Standardquote geschätzt.
 */
export function valueDay(wh: number, tariff: TariffRow | null): Money {
  const ev = (tariff?.selfConsumptionPct ?? DEFAULT_SELF_CONSUMPTION_PCT) / 100;
  const selfWh = wh * ev;
  const feedWh = wh - selfWh;
  if (!tariff) return { selfEur: 0, feedEur: 0, unpricedWh: wh, selfWh, feedWh };
  return {
    selfEur: (selfWh / 1000) * (tariff.priceCtPerKwh / 100),
    feedEur: (feedWh / 1000) * (tariff.feedInCtPerKwh / 100),
    unpricedWh: 0,
    selfWh,
    feedWh,
  };
}

/** Kaufmännisch auf Cent runden (erst am Ende, Summen werden ungerundet gebildet). */
export function roundEur(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}
