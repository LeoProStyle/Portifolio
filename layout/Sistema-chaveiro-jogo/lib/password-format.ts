// Import-free: the one definition of a valid ADMIN_PASSWORD_HASH, shared by lib/password.ts
// (which derives keys) and lib/auth-config.ts (which must not import node:crypto).
// Format: scrypt:<N>:<r>:<p>:<salt base64url>:<key base64url>

export type PasswordHashParts = { N: number; r: number; p: number; saltText: string; keyText: string };

const BASE64URL = /^[A-Za-z0-9_-]+$/;
const NUMBER = /^\d{1,7}$/;

/** Bytes encoded by an unpadded base64url string. */
function decodedLength(text: string): number {
  return Math.floor((text.length * 3) / 4);
}

function isPowerOfTwo(value: number): boolean {
  return value > 1 && (value & (value - 1)) === 0;
}

/** Parses and bounds-checks the string; null when lib/password.ts would refuse it. */
export function parsePasswordHashFormat(encoded: string): PasswordHashParts | null {
  const parts = encoded.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [, nText, rText, pText, saltText, keyText] = parts;
  if (!NUMBER.test(nText) || !NUMBER.test(rText) || !NUMBER.test(pText)) return null;
  const N = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  // Bounds keep a hostile or mistyped value from allocating unbounded memory.
  if (!isPowerOfTwo(N) || N < 1024 || N > 131072 || r < 1 || r > 32 || p < 1 || p > 16) return null;
  if (!BASE64URL.test(saltText) || !BASE64URL.test(keyText)) return null;
  const keyBytes = decodedLength(keyText);
  if (decodedLength(saltText) < 8 || keyBytes < 16 || keyBytes > 128) return null;
  return { N, r, p, saltText, keyText };
}
