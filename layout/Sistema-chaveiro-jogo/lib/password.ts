import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Node-only module: never import it from auth.config.ts, middleware.ts or a client component.
// Hash format: scrypt:<N>:<r>:<p>:<salt base64url>:<key base64url>
// The ':' separator and base64url alphabet avoid '$', which the .env loader of Next expands as a variable.

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 64;

const BASE64URL = /^[A-Za-z0-9_-]+$/;

type ParsedHash = { N: number; r: number; p: number; salt: Buffer; key: Buffer };

function deriveKey(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derived) => (error ? reject(error) : resolve(derived)));
  });
}

function isPowerOfTwo(value: number): boolean {
  return value > 1 && (value & (value - 1)) === 0;
}

function parseHash(encoded: string): ParsedHash | null {
  const parts = encoded.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [, nText, rText, pText, saltText, keyText] = parts;
  if (![nText, rText, pText].every((text) => /^\d{1,7}$/.test(text))) return null;
  const N = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  // Bounds keep a hostile or mistyped value from allocating unbounded memory.
  if (!isPowerOfTwo(N) || N < 1024 || N > 131072 || r < 1 || r > 32 || p < 1 || p > 16) return null;
  if (!BASE64URL.test(saltText) || !BASE64URL.test(keyText)) return null;
  const salt = Buffer.from(saltText, 'base64url');
  const key = Buffer.from(keyText, 'base64url');
  if (salt.length < 8 || key.length < 16 || key.length > 128) return null;
  return { N, r, p, salt, key };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt, KEY_BYTES, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('base64url'), key.toString('base64url')].join(':');
}

export async function verifyPasswordHash(password: string, encoded: string): Promise<boolean> {
  const parsed = parseHash(encoded);
  if (!parsed) return false;
  try {
    const derived = await deriveKey(password, parsed.salt, parsed.key.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
      maxmem: 256 * parsed.N * parsed.r
    });
    // Same length by construction: derived uses the stored key length.
    return timingSafeEqual(derived, parsed.key);
  } catch {
    return false;
  }
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/** Compares two strings in constant time for their length-independent SHA-256 digests. */
export function verifyPlainPassword(input: string, expected: string): boolean {
  return timingSafeEqual(sha256(input), sha256(expected));
}
