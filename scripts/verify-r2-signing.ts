/**
 * Regression test for the SigV4 presigner in server/r2.ts.
 *
 * The expected signatures below were produced by boto3's own presigner
 * (botocore's reference SigV4 implementation) for the same inputs at the same
 * instant, then recorded here so this can run without Python or AWS packages.
 *
 * Run with: npx tsx scripts/verify-r2-signing.ts
 */
process.env.R2_ACCOUNT_ID = "testaccount";
process.env.R2_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
process.env.R2_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
process.env.R2_BUCKET = "guild-media";
delete process.env.R2_ENDPOINT;

const FIXED_ISO = "2026-08-17T12:34:56.000Z";
const RealDate = Date;
// @ts-ignore - freeze the clock so signatures are deterministic
global.Date = class extends RealDate {
  constructor(...args: any[]) {
    // @ts-ignore
    super(...(args.length ? args : [new RealDate(FIXED_ISO).getTime()]));
  }
  static now() { return new RealDate(FIXED_ISO).getTime(); }
} as any;

const { presignUpload, presignDownload } = await import("../server/r2");

const signatureOf = (url: string) =>
  new URL(url).searchParams.get("X-Amz-Signature") ?? "";

const cases: { name: string; actual: string; expected: string }[] = [
  {
    name: "PUT simple key",
    actual: signatureOf(presignUpload("submissions/1/abc-def-beat.wav", 900)),
    expected: "7c8ad5d7b2c02674a605d544d0831a3fc346ffeba50b2870ad4f92907e3a3117",
  },
  {
    name: "PUT key with spaces and parentheses",
    actual: signatureOf(presignUpload("files/42/8f2a-My Stem (final) v2.wav", 900)),
    expected: "3230f6df1f7a83bd988e5d1bed108e11c8b684f54c95b9c18fb563550d0d790c",
  },
  {
    name: "PUT key with + & = characters",
    actual: signatureOf(presignUpload("files/7/weird+name&chars=here.mp3", 900)),
    expected: "9deb497e17c23cc7743e15cc3e5652144eb10691738dd71a20d9a76514807496",
  },
  {
    name: "GET with response header overrides",
    actual: signatureOf(
      presignDownload("submissions/1/abc-def-beat.wav", {
        contentType: "audio/mpeg",
        expiresInSeconds: 3600,
      }),
    ),
    expected: "ba5304c3bdcebd59fbb14d71950bac4ea0e7409d58afebc307a98e4843909c7b",
  },
];

let failed = 0;
for (const c of cases) {
  const ok = c.actual === c.expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}`);
  if (!ok) console.log(`      expected ${c.expected}\n      actual   ${c.actual}`);
}
console.log(failed === 0 ? "\nAll SigV4 signatures match the reference." : `\n${failed} signature(s) changed.`);
process.exit(failed === 0 ? 0 : 1);
