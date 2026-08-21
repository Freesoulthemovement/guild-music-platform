import { createHash, createHmac, randomUUID } from "crypto";

/**
 * Cloudflare R2 access via S3-compatible SigV4 query presigning.
 *
 * Presigned URLs are generated here and handed to the browser, which uploads
 * to and downloads from R2 directly. The bytes never pass through this server,
 * so large stems do not consume request memory or hit a host's body limits.
 *
 * Signing is implemented directly rather than through @aws-sdk/* to avoid
 * pulling roughly fifty transitive packages into the bundle. The output is
 * byte-compared against boto3's presigner; those signatures are pinned in
 * server/__tests__/r2.test.ts.
 */

const ALGORITHM = "AWS4-HMAC-SHA256";
// R2 ignores region but SigV4 requires one, and Cloudflare documents "auto".
const REGION = "auto";
const SERVICE = "s3";
// Presigned PUTs do not commit to a body hash; R2 accepts the standard marker.
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function isStorageConfigured(): boolean {
  return getR2Config() !== null;
}

function requireR2(): R2Config {
  const config = getR2Config();
  if (!config) {
    throw new Error(
      "Object storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, " +
        "R2_SECRET_ACCESS_KEY and R2_BUCKET. See .env.example.",
    );
  }
  return config;
}

/** Endpoint override exists so tests can point at a local S3-compatible server. */
function endpointHost(config: R2Config): string {
  const override = process.env.R2_ENDPOINT;
  if (override) return new URL(override).host;
  return `${config.accountId}.r2.cloudflarestorage.com`;
}

function endpointProtocol(): string {
  const override = process.env.R2_ENDPOINT;
  if (override) return new URL(override).protocol;
  return "https:";
}

const sha256Hex = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const hmac = (key: Buffer | string, value: string) =>
  createHmac("sha256", key).update(value, "utf8").digest();

/** RFC 3986 encoding. encodeURIComponent leaves !'()* alone, which SigV4 does not. */
function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/** Each path segment is encoded, but the separators are not. */
function encodeKeyPath(key: string): string {
  return key.split("/").map(uriEncode).join("/");
}

function signingKey(secret: string, dateStamp: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
}

function presign(
  method: "PUT" | "GET",
  key: string,
  expiresInSeconds: number,
  extraQuery: Record<string, string> = {},
  now: Date = new Date(),
): string {
  const config = requireR2();
  const host = endpointHost(config);

  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;

  const query: Record<string, string> = {
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${config.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
    ...extraQuery,
  };

  // SigV4 requires the query string sorted by encoded key.
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(query[k])}`)
    .join("&");

  const canonicalUri = `/${config.bucket}/${encodeKeyPath(key)}`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    UNSIGNED_PAYLOAD,
  ].join("\n");

  const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretAccessKey, dateStamp))
    .update(stringToSign, "utf8")
    .digest("hex");

  return `${endpointProtocol()}//${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** URL the browser PUTs the file to. Short-lived: it is used immediately. */
export function presignUpload(key: string, expiresInSeconds = 15 * 60): string {
  return presign("PUT", key, expiresInSeconds);
}

/**
 * URL for playback or download.
 *
 * The response content-type is pinned rather than trusted from the stored
 * object, so a member cannot get HTML served from the storage origin. Anything
 * that is not audio or an image is forced to download instead of rendering.
 */
export function presignDownload(
  key: string,
  opts: { contentType?: string; filename?: string; expiresInSeconds?: number } = {},
): string {
  const contentType = safeContentType(opts.contentType);
  const extra: Record<string, string> = { "response-content-type": contentType };

  const inline =
    contentType.startsWith("audio/") ||
    contentType.startsWith("video/") ||
    contentType.startsWith("image/");
  const disposition = inline ? "inline" : "attachment";
  extra["response-content-disposition"] = opts.filename
    ? `${disposition}; filename="${opts.filename.replace(/["\\]/g, "")}"`
    : disposition;

  return presign("GET", key, opts.expiresInSeconds ?? 60 * 60, extra);
}

/**
 * Only these render in the browser; everything else downloads as bytes.
 *
 * Deliberately an allowlist of concrete media types rather than a prefix match:
 * a wildcard on video/ or image/ would let through formats that some browsers
 * treat as scriptable documents.
 */
const INLINE_SAFE = new Set([
  // Audio
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/aiff",
  "audio/x-aiff", "audio/flac", "audio/ogg", "audio/mp4", "audio/aac", "audio/webm",
  // Video — performance-video and acting-reel submissions depend on these.
  // quicktime covers .mov, which is what most phones record.
  "video/mp4", "video/webm", "video/ogg", "video/quicktime",
  // Images
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif",
]);

/** True for types the app renders in a <video> element rather than <audio>. */
export function isVideoType(contentType?: string | null): boolean {
  return !!contentType && safeContentType(contentType).startsWith("video/");
}

export function safeContentType(contentType?: string | null): string {
  if (!contentType) return "application/octet-stream";
  const base = contentType.split(";")[0].trim().toLowerCase();
  return INLINE_SAFE.has(base) ? base : "application/octet-stream";
}

/**
 * Builds the object key.
 *
 * The random prefix means the key cannot be guessed from the filename, and the
 * original name is sanitised so it cannot escape the intended prefix.
 */
export function buildObjectKey(userId: number, folder: string, filename: string): string {
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "misc";
  const cleaned = filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(-80);
  const name = cleaned.replace(/^[._]+/, "") || "file";
  return `${safeFolder}/${userId}/${randomUUID()}-${name}`;
}
