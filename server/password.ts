import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type BinaryLike,
  type ScryptOptions,
} from "crypto";

// scrypt is in Node's standard library, so there is no native module to build
// on the host. These are the parameters OWASP lists as acceptable for scrypt.
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCRYPT_PARAMS: ScryptOptions = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

// promisify() resolves to the overload without an options argument, so the
// callback form is wrapped by hand to keep the tuned parameters.
function scryptAsync(
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/** Returns `scrypt$<salt hex>$<hash hex>` — self-describing so the scheme can change later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = (await scryptAsync(
    password,
    salt,
    KEY_LENGTH,
    SCRYPT_PARAMS,
  ));
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Constant-time comparison. Returns false rather than throwing on a malformed hash. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = (await scryptAsync(
    password,
    salt,
    expected.length,
    SCRYPT_PARAMS,
  ));

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * Burns roughly one hash's worth of time.
 *
 * Called on a login attempt for an address with no account, so that a missing
 * email cannot be distinguished from a wrong password by response timing.
 */
export async function dummyVerify(): Promise<void> {
  await scryptAsync("timing-equalizer", randomBytes(SALT_LENGTH), KEY_LENGTH, SCRYPT_PARAMS);
}
