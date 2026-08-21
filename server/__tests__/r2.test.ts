import { describe, it, expect, beforeAll } from "vitest";

// Fixed credentials and clock so signatures are deterministic. The expected
// values were produced by boto3's presigner (botocore's reference SigV4
// implementation) for identical inputs.
const FIXED_ISO = "2026-08-17T12:34:56.000Z";

beforeAll(() => {
  process.env.R2_ACCOUNT_ID = "testaccount";
  process.env.R2_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
  process.env.R2_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
  process.env.R2_BUCKET = "guild-media";
  delete process.env.R2_ENDPOINT;

  const RealDate = Date;
  // @ts-ignore
  globalThis.Date = class extends RealDate {
    constructor(...args: any[]) {
      // @ts-ignore
      super(...(args.length ? args : [new RealDate(FIXED_ISO).getTime()]));
    }
    static now() { return new RealDate(FIXED_ISO).getTime(); }
  } as any;
});

const load = () => import("../r2");
const sigOf = (url: string) => new URL(url).searchParams.get("X-Amz-Signature");

describe("SigV4 presigning", () => {
  it("matches the boto3 reference for a simple key", async () => {
    const { presignUpload } = await load();
    expect(sigOf(presignUpload("submissions/1/abc-def-beat.wav", 900)))
      .toBe("7c8ad5d7b2c02674a605d544d0831a3fc346ffeba50b2870ad4f92907e3a3117");
  });

  it("matches for keys with spaces and parentheses", async () => {
    const { presignUpload } = await load();
    expect(sigOf(presignUpload("files/42/8f2a-My Stem (final) v2.wav", 900)))
      .toBe("3230f6df1f7a83bd988e5d1bed108e11c8b684f54c95b9c18fb563550d0d790c");
  });

  it("matches for keys with + & = characters", async () => {
    const { presignUpload } = await load();
    expect(sigOf(presignUpload("files/7/weird+name&chars=here.mp3", 900)))
      .toBe("9deb497e17c23cc7743e15cc3e5652144eb10691738dd71a20d9a76514807496");
  });

  it("matches for a download with response header overrides", async () => {
    const { presignDownload } = await load();
    expect(sigOf(presignDownload("submissions/1/abc-def-beat.wav", {
      contentType: "audio/mpeg", expiresInSeconds: 3600,
    }))).toBe("ba5304c3bdcebd59fbb14d71950bac4ea0e7409d58afebc307a98e4843909c7b");
  });
});

describe("content type handling", () => {
  it("lets real media render in place", async () => {
    const { safeContentType } = await load();
    for (const t of ["audio/mpeg", "audio/wav", "video/mp4", "video/quicktime",
                     "video/webm", "image/png", "image/jpeg"]) {
      expect(safeContentType(t)).toBe(t);
    }
  });

  it("neutralises anything a browser might execute", async () => {
    const { safeContentType } = await load();
    for (const t of ["text/html", "image/svg+xml", "application/javascript",
                     "application/x-msdownload", "text/xml", undefined, null, ""]) {
      expect(safeContentType(t as any)).toBe("application/octet-stream");
    }
  });

  it("ignores charset parameters and casing", async () => {
    const { safeContentType } = await load();
    expect(safeContentType("AUDIO/MPEG")).toBe("audio/mpeg");
    expect(safeContentType("video/mp4; codecs=avc1")).toBe("video/mp4");
  });

  it("identifies video, which renders differently from audio", async () => {
    const { isVideoType } = await load();
    expect(isVideoType("video/mp4")).toBe(true);
    expect(isVideoType("audio/mpeg")).toBe(false);
    expect(isVideoType("text/html")).toBe(false);
  });
});

describe("object keys", () => {
  it("cannot escape its folder, however the filename is crafted", async () => {
    const { buildObjectKey } = await load();
    for (const name of ["../../../etc/passwd", "..\\..\\windows\\system32",
                        "/absolute/path.wav", "....//....//x.wav"]) {
      const key = buildObjectKey(7, "files", name);
      expect(key.startsWith("files/7/")).toBe(true);
      expect(key).not.toContain("..");
      expect(key.split("/").length).toBe(3);
    }
  });

  it("is unguessable even for an identical filename", async () => {
    const { buildObjectKey } = await load();
    const a = buildObjectKey(1, "submissions", "beat.wav");
    const b = buildObjectKey(1, "submissions", "beat.wav");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^submissions\/1\/[0-9a-f-]{36}-beat\.wav$/);
  });

  it("falls back to a safe folder and name", async () => {
    const { buildObjectKey } = await load();
    expect(buildObjectKey(1, "../evil", "x.wav").startsWith("evil/1/")).toBe(true);
    expect(buildObjectKey(1, "files", "...").startsWith("files/1/")).toBe(true);
  });
});
