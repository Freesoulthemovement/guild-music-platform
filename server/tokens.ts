import { randomBytes, createHash } from "crypto";

/** Minutes a password-reset link stays valid. Short, because it grants account access. */
export const PASSWORD_RESET_TTL_MINUTES = 30;

/** Hours an email-verification link stays valid. Longer — it only confirms an address. */
export const EMAIL_VERIFICATION_TTL_HOURS = 24;

/**
 * A 256-bit URL-safe token plus the hash to store.
 *
 * Only the hash is persisted. Anyone reading the database still cannot produce
 * a working link, because the raw token exists only in the delivered email.
 */
export function createToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function expiresInMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function expiresInHours(hours: number): Date {
  return expiresInMinutes(hours * 60);
}
