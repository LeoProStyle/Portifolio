import { randomInt } from 'crypto';
import { getDb } from '@/lib/mongo';
import type { LoginAttemptStore, ThrottleDecision, ThrottlePolicy } from '@/lib/login-throttle';

// Pairing code: moves a play pass from the phone to a computer.
// - The phone holds a pass cookie (set by /api/nfc/validate) and asks /api/pair/create for a code.
// - The code is 6 digits, single use, valid for PAIR_CODE_SECONDS and never past the pass expiry.
// - The computer sends the code to /api/pair/redeem and receives a pass cookie with the same expiry.
// - Redeem attempts are counted per IP (PAIR_ATTEMPT_POLICY) in the login_attempts collection.
// Document: { _id: "<code>", slug, nfcId, passExp: Date, expiresAt: Date }; a TTL index on expiresAt removes it.

export const PAIR_CODE_LENGTH = 6;
export const PAIR_CODE_SECONDS = 5 * 60;
export const PAIR_CODES_COLLECTION = 'pair_codes';
export const PAIR_ATTEMPT_POLICY: ThrottlePolicy = { maxAttempts: 10, windowSeconds: 900, lockSeconds: 900 };
const MAX_CREATE_TRIES = 5;
const MAX_IP_KEY_LENGTH = 64;

export type PairGrant = { slug: string; nfcId: string; passExp: number };
export type PairCode = { code: string; expiresAt: number };

export interface PairCodeStore {
  /** Stores a new code for this grant. Throws when no free code was found. */
  create(grant: PairGrant, nowSeconds: number): Promise<PairCode>;
  /** Removes the code and returns its grant; null when it does not exist or has expired. */
  redeem(code: string, nowSeconds: number): Promise<PairGrant | null>;
}

export function generatePairCode(): string {
  return String(randomInt(0, 10 ** PAIR_CODE_LENGTH)).padStart(PAIR_CODE_LENGTH, '0');
}

/** Keeps the digits only ("482 913" → "482913"); null unless exactly PAIR_CODE_LENGTH digits remain. */
export function normalizePairCode(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 32) return null;
  const digits = input.replace(/\D/g, '');
  return digits.length === PAIR_CODE_LENGTH ? digits : null;
}

/** The code ends after PAIR_CODE_SECONDS or when the pass ends, whichever comes first. */
export function pairCodeExpiry(passExp: number, nowSeconds: number): number {
  return Math.min(nowSeconds + PAIR_CODE_SECONDS, passExp);
}

export function pairThrottleKey(ip: string): string {
  return `pair:${ip.replace(/\|/g, '').slice(0, MAX_IP_KEY_LENGTH)}`;
}

/** Counts one redeem attempt for this IP; denied once the IP passes PAIR_ATTEMPT_POLICY.maxAttempts. */
export async function registerPairAttempt(store: LoginAttemptStore, ip: string, now: Date): Promise<ThrottleDecision> {
  const record = await store.increment(pairThrottleKey(ip), now, PAIR_ATTEMPT_POLICY);
  if (record.attempts <= PAIR_ATTEMPT_POLICY.maxAttempts) return { allowed: true };
  const lockedUntil = record.lockedUntil ?? new Date(now.getTime() + PAIR_ATTEMPT_POLICY.lockSeconds * 1000);
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000)) };
}

/** In-process store: tests, and nothing else (Vercel instances share no memory). */
export function createMemoryPairStore(nextCode: () => string = generatePairCode): PairCodeStore {
  const records = new Map<string, PairGrant & { expiresAt: number }>();
  return {
    async create(grant, nowSeconds) {
      for (let i = 0; i < MAX_CREATE_TRIES; i += 1) {
        const code = nextCode();
        const existing = records.get(code);
        if (existing && existing.expiresAt > nowSeconds) continue;
        const expiresAt = pairCodeExpiry(grant.passExp, nowSeconds);
        records.set(code, { ...grant, expiresAt });
        return { code, expiresAt };
      }
      throw new Error('No free pairing code');
    },
    async redeem(code, nowSeconds) {
      const record = records.get(code);
      records.delete(code);
      if (!record || record.expiresAt <= nowSeconds) return null;
      return { slug: record.slug, nfcId: record.nfcId, passExp: record.passExp };
    }
  };
}

type PairCodeRecord = { _id: string; slug: string; nfcId: string; passExp: Date; expiresAt: Date };

let indexReady: Promise<unknown> | null = null;

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;
}

export async function getMongoPairStore(): Promise<PairCodeStore> {
  const db = await getDb();
  const collection = db.collection<PairCodeRecord>(PAIR_CODES_COLLECTION);

  if (!indexReady) {
    indexReady = collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((error) => {
      indexReady = null;
      throw error;
    });
  }
  await indexReady;

  return {
    async create(grant, nowSeconds) {
      const expiresAt = pairCodeExpiry(grant.passExp, nowSeconds);
      for (let i = 0; i < MAX_CREATE_TRIES; i += 1) {
        const code = generatePairCode();
        try {
          await collection.insertOne({
            _id: code,
            slug: grant.slug,
            nfcId: grant.nfcId,
            passExp: new Date(grant.passExp * 1000),
            expiresAt: new Date(expiresAt * 1000)
          });
          return { code, expiresAt };
        } catch (error) {
          // The TTL monitor runs about once a minute: an expired code can still hold its _id.
          if (!isDuplicateKey(error)) throw error;
          await collection.deleteOne({ _id: code, expiresAt: { $lte: new Date(nowSeconds * 1000) } });
        }
      }
      throw new Error('No free pairing code');
    },
    async redeem(code, nowSeconds) {
      // One atomic delete makes the code single use, even with two computers sending it at once.
      const record = await collection.findOneAndDelete({ _id: code, expiresAt: { $gt: new Date(nowSeconds * 1000) } });
      if (!record) return null;
      return { slug: record.slug, nfcId: record.nfcId, passExp: Math.floor(record.passExp.getTime() / 1000) };
    }
  };
}
