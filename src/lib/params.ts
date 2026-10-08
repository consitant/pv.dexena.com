import { isUuid } from "./portal-data";

/** Liest einen einzelnen String-Parameter aus searchParams. */
export function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Komma-getrennte UUID-Liste (inv=…); ungültige Einträge → null (404). */
export function uuidList(v: string | string[] | undefined): string[] | null {
  const s = one(v);
  if (!s) return [];
  const list = [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))];
  if (list.length > 50 || !list.every(isUuid)) return null;
  return list;
}

/** Cookie mit der zuletzt gewählten Anlage (nur UI-Komfort; Berechtigung wird serverseitig geprüft). */
export const SITE_COOKIE = "pv_site";
