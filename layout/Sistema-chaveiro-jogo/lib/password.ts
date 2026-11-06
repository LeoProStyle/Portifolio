import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { parsePasswordHashFormat } from '@/lib/password-format';

// Node-only module: never import it from auth.config.ts, middleware.ts or a client component.
// Hash format: scrypt:<N>:<r>:<p>:<salt base64url>:<key base64url>
// The ':' separator and base64url alphabet avoid '$', which the .env loader of Next expands as a variable.

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 64;

type ParsedHash = { N: number; r: number; p: number; salt: Buffer; key: Buffer };

function deriveKey(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derived) => (error ? reject(error) : resolve(derived)));
  });
}

function parseHash(encoded: string): ParsedHash | null {
  const parts = parsePasswordHashFormat(encoded);
  if (!parts) return null;
  const salt = Buffer.from(parts.saltText, 'base64url');
  const key = Buffer.from(parts.keyText, 'base64url');
  // Decoded lengths re-checked on the real bytes, not only on the string length.
  if (salt.length < 8 || key.length < 16 || key.length > 128) return null;
  return { N: parts.N, r: parts.r, p: parts.p, salt, key };
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
