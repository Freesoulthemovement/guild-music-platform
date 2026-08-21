import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, dummyVerify } from "../password";

describe("password hashing", () => {
  it("stores a self-describing scrypt hash, never the password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    const [scheme, salt, digest] = hash.split("$");
    expect(scheme).toBe("scrypt");
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(digest).toMatch(/^[0-9a-f]{128}$/);
    expect(hash).not.toContain("correct-horse-battery");
  });

  it("salts, so the same password hashes differently each time", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same-password-here"),
      hashPassword("same-password-here"),
    ]);
    expect(a).not.toBe(b);
  });

  it("accepts the correct password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    await expect(verifyPassword("correct-horse-battery", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    await expect(verifyPassword("Correct-horse-battery", hash)).resolves.toBe(false);
    await expect(verifyPassword("", hash)).resolves.toBe(false);
  });

  it("returns false rather than throwing on a malformed hash", async () => {
    for (const bad of ["", "garbage", "scrypt$", "scrypt$zz$zz", "bcrypt$aa$bb", "$$"]) {
      await expect(verifyPassword("anything", bad)).resolves.toBe(false);
    }
  });

  it("dummyVerify costs roughly the same as a real verification", async () => {
    const hash = await hashPassword("some-password-here");

    const t1 = performance.now();
    await verifyPassword("wrong-password-here", hash);
    const real = performance.now() - t1;

    const t2 = performance.now();
    await dummyVerify();
    const dummy = performance.now() - t2;

    // Guards the login path against distinguishing "no such account" from
    // "wrong password" by response time. Loose bound: this is timing on CI.
    expect(dummy).toBeGreaterThan(real * 0.25);
  });
});
