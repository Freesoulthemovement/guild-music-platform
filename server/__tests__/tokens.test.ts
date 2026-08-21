import { describe, it, expect } from "vitest";
import {
  createToken, hashToken, expiresInMinutes, expiresInHours,
  PASSWORD_RESET_TTL_MINUTES, EMAIL_VERIFICATION_TTL_HOURS,
} from "../tokens";

describe("emailed tokens", () => {
  it("never stores the value that goes in the email", () => {
    const { token, tokenHash } = createToken();
    expect(tokenHash).not.toBe(token);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    // A database leak must not yield a working reset link.
    expect(tokenHash).not.toContain(token);
  });

  it("is unguessable and unique per call", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => createToken().token));
    expect(tokens.size).toBe(200);
    // 32 random bytes, base64url encoded.
    for (const t of tokens) expect(t.length).toBeGreaterThanOrEqual(43);
  });

  it("is URL-safe, so the emailed link cannot be mangled", () => {
    for (let i = 0; i < 50; i++) {
      expect(createToken().token).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("hashes deterministically, so lookup by hash works", () => {
    const { token, tokenHash } = createToken();
    expect(hashToken(token)).toBe(tokenHash);
    expect(hashToken(token + "x")).not.toBe(tokenHash);
  });

  it("expiries are in the future and ordered as intended", () => {
    const now = Date.now();
    const reset = expiresInMinutes(PASSWORD_RESET_TTL_MINUTES).getTime();
    const verify = expiresInHours(EMAIL_VERIFICATION_TTL_HOURS).getTime();
    expect(reset).toBeGreaterThan(now);
    // A reset link grants account access, so it must be shorter-lived than a
    // link that merely confirms an address.
    expect(reset).toBeLessThan(verify);
  });
});
