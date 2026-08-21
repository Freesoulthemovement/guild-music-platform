import { describe, it, expect } from "vitest";
import { emailSchema, passwordSchema, usernameSchema, MIN_PASSWORD_LENGTH } from "../schema";
import { api } from "../routes";

describe("email", () => {
  it("normalises case and whitespace so duplicates cannot slip through", () => {
    expect(emailSchema.parse("  Judah@Example.COM  ")).toBe("judah@example.com");
  });

  it("rejects malformed addresses", () => {
    for (const bad of ["", "notanemail", "a@", "@b.com", "a b@c.com"]) {
      expect(emailSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("password", () => {
  it(`requires at least ${MIN_PASSWORD_LENGTH} characters`, () => {
    expect(passwordSchema.safeParse("a".repeat(MIN_PASSWORD_LENGTH - 1)).success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(MIN_PASSWORD_LENGTH)).success).toBe(true);
  });

  it("caps length, so a huge input cannot tie up the hashing work function", () => {
    expect(passwordSchema.safeParse("a".repeat(200)).success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(201)).success).toBe(false);
  });

  it("does not apply the length floor at login", () => {
    // An account whose password predates the current rule must still sign in.
    expect(api.auth.login.input.safeParse({
      email: "a@b.com", password: "short",
    }).success).toBe(true);
  });
});

describe("username", () => {
  it("accepts letters, numbers and underscores", () => {
    for (const ok of ["judah", "jimi_hendrix", "user123", "___"]) {
      expect(usernameSchema.safeParse(ok).success).toBe(true);
    }
  });

  it("rejects anything that could confuse a URL or display", () => {
    for (const bad of ["ab", "a".repeat(31), "has space", "slash/es",
                       "dots.here", "<script>", "emoji😀"]) {
      expect(usernameSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("upload contract", () => {
  it("caps upload size", () => {
    const base = { filename: "a.wav", contentType: "audio/wav", folder: "files" as const };
    expect(api.uploads.presign.input.safeParse({ ...base, sizeBytes: 500 * 1024 * 1024 }).success).toBe(true);
    expect(api.uploads.presign.input.safeParse({ ...base, sizeBytes: 500 * 1024 * 1024 + 1 }).success).toBe(false);
    expect(api.uploads.presign.input.safeParse({ ...base, sizeBytes: 0 }).success).toBe(false);
  });

  it("restricts uploads to known folders", () => {
    const base = { filename: "a.wav", contentType: "audio/wav", sizeBytes: 10 };
    expect(api.uploads.presign.input.safeParse({ ...base, folder: "submissions" }).success).toBe(true);
    expect(api.uploads.presign.input.safeParse({ ...base, folder: "../etc" }).success).toBe(false);
  });

  it("requires a file record to reference either an upload or a URL", () => {
    expect(api.files.create.input.safeParse({ name: "x", type: "stem" }).success).toBe(false);
    expect(api.files.create.input.safeParse({ name: "x", type: "stem", storageKey: "files/1/a" }).success).toBe(true);
    expect(api.files.create.input.safeParse({ name: "x", type: "stem", url: "https://e.com/a" }).success).toBe(true);
  });
});
