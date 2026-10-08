import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const DEVICE_TOKEN_PREFIX = "smx_";

export function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Neues Device-Token: `smx_` + 32 Byte Zufall (base64url). Nur der Hash wird gespeichert. */
export function generateDeviceToken(): { token: string; hash: string; prefix: string } {
  const token = DEVICE_TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return { token, hash: sha256Hex(token), prefix: token.slice(0, 10) };
}

/** Zeitkonstanter Vergleich zweier Hex-Strings gleicher Länge. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

/** Extrahiert das Bearer-Token aus dem Authorization-Header. */
export function parseBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (!m) return null;
  const token = m[1];
  if (token.length < 10 || token.length > 200) return null;
  return token;
}

/** Zufälliges, gut lesbares Passwort (ohne verwechselbare Zeichen). */
export function generatePassword(length = 16): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(length * 2);
  let out = "";
  for (let i = 0; i < bytes.length && out.length < length; i++) {
    // Rejection Sampling gegen Modulo-Bias
    if (bytes[i] < 256 - (256 % alphabet.length)) out += alphabet[bytes[i] % alphabet.length];
  }
  return out.length === length ? out : generatePassword(length);
}
