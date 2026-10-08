/**
 * Stick-Kennung parsen. Akzeptiert u. a.:
 *  - WLAN-Name des Sticks: "10SMT_2313-123456789"
 *  - Modul-ID vom Etikett: "SC**2313-123456789" oder "SC2313-123456789"
 *  - nur die Nummer: "2313-123456789"
 * Ergebnis: "SC2313-123456789" (Format des Portals, ohne "**").
 */
export function parseStickRef(input: string): string | null {
  const s = input.trim().toUpperCase().replace(/\s+/g, "");
  const m = /^(?:\d{1,3}S[A-Z]{1,4}_|SC\*{0,2})?(\d{4})-(\d{6,12})$/.exec(s);
  if (!m) return null;
  return `SC${m[1]}-${m[2]}`;
}

/** WLAN-Name, den der Stick im Auslieferungszustand aufspannt (Modell-Präfix unbekannt → Muster). */
export function stickSsidHint(ref: string): string {
  return `…_${ref.replace(/^SC/, "")}`;
}
