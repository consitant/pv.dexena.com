import bcrypt from "bcryptjs";

export const BCRYPT_COST = 12;
export const MIN_PASSWORD_LENGTH = 10;

export function hashPassword(password: string, cost = BCRYPT_COST): Promise<string> {
  return bcrypt.hash(password, cost);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

let dummyHash: Promise<string> | undefined;
/** Hash zum Vergleichen, wenn der Benutzer nicht existiert (gleiche Laufzeit, kein User-Enumeration-Leak). */
export function getDummyHash(): Promise<string> {
  dummyHash ??= bcrypt.hash("dummy-password-not-used", BCRYPT_COST);
  return dummyHash;
}
