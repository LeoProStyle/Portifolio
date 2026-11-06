import { getDb } from '@/lib/mongo';

// Login throttle per username+IP (SF02 RF03, RN04).
// The counter counts ATTEMPTS and is incremented before the password is checked; a successful
// login clears it. Fixed window of 15 minutes from the first attempt; the 5th attempt starts a
// 15-minute lock; any attempt past the 5th is denied until the lock ends.

export const MAX_ATTEMPTS = 5;
export const WINDOW_SECONDS = 900;
export const LOCK_SECONDS = 900;
export const LOGIN_ATTEMPTS_COLLECTION = 'login_attempts';
const MAX_USERNAME_KEY_LENGTH = 256;

export type AttemptRecord = {
  _id: string;
  attempts: number;
  windowStart: Date;
  lockedUntil: Date | null;
  expiresAt: Date;
};

export type ThrottleDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface LoginAttemptStore {
  increment(key: string, now: Date): Promise<AttemptRecord>;
  get(key: string): Promise<AttemptRecord | null>;
  clear(key: string): Promise<void>;
}

export function throttleKey(username: string, ip: string): string {
  return `${username.trim().slice(0, MAX_USERNAME_KEY_LENGTH)}|${ip}`;
}

function plusSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function retryAfter(lockedUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));
}

function isExpired(record: AttemptRecord, now: Date): boolean {
  if (record.lockedUntil) return record.lockedUntil.getTime() <= now.getTime();
  return plusSeconds(record.windowStart, WINDOW_SECONDS).getTime() <= now.getTime();
}

/** The one place the policy is written; the Mongo pipeline in getMongoAttemptStore mirrors it step for step. */
function applyAttempt(previous: AttemptRecord | null, key: string, now: Date): AttemptRecord {
  const current = previous && !isExpired(previous, now) ? previous : null;
  const attempts = (current?.attempts ?? 0) + 1;
  const windowStart = current?.windowStart ?? now;
  const lockedUntil = attempts === MAX_ATTEMPTS ? plusSeconds(now, LOCK_SECONDS) : current?.lockedUntil ?? null;
  const windowEnd = plusSeconds(windowStart, WINDOW_SECONDS);
  const expiresAt = lockedUntil && lockedUntil > windowEnd ? lockedUntil : windowEnd;
  return { _id: key, attempts, windowStart, lockedUntil, expiresAt };
}

function decide(record: AttemptRecord, now: Date): ThrottleDecision {
  if (record.attempts <= MAX_ATTEMPTS) return { allowed: true };
  // attempts > 5 with no lock cannot happen by construction; if seen, treat it as a fresh lock.
  const lockedUntil = record.lockedUntil ?? plusSeconds(now, LOCK_SECONDS);
  return { allowed: false, retryAfterSeconds: retryAfter(lockedUntil, now) };
}

/** Read-only check used before the NextAuth handler: denied only while a lock is active. */
export async function peekLoginLock(store: LoginAttemptStore, key: string, now: Date): Promise<ThrottleDecision> {
  const record = await store.get(key);
  if (record?.lockedUntil && record.lockedUntil.getTime() > now.getTime()) {
    return { allowed: false, retryAfterSeconds: retryAfter(record.lockedUntil, now) };
  }
  return { allowed: true };
}

/** Counts one attempt atomically and says whether the password may be checked. */
export async function registerLoginAttempt(store: LoginAttemptStore, key: string, now: Date): Promise<ThrottleDecision> {
  return decide(await store.increment(key, now), now);
}

export async function clearLoginAttempts(store: LoginAttemptStore, key: string): Promise<void> {
  await store.clear(key);
}

/** In-process store: tests, and nothing else (Vercel instances share no memory). */
export function createMemoryAttemptStore(): LoginAttemptStore {
  const records = new Map<string, AttemptRecord>();
  return {
    async increment(key, now) {
      const next = applyAttempt(records.get(key) ?? null, key, now);
      records.set(key, next);
      return { ...next };
    },
    async get(key) {
      const record = records.get(key);
      return record ? { ...record } : null;
    },
    async clear(key) {
      records.delete(key);
    }
  };
}

let indexReady: Promise<unknown> | null = null;

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;
}

/** MongoDB store: one document per key, written by a single atomic pipeline update. */
export async function getMongoAttemptStore(): Promise<LoginAttemptStore> {
  const db = await getDb();
  const collection = db.collection<AttemptRecord>(LOGIN_ATTEMPTS_COLLECTION);

  if (!indexReady) {
    indexReady = collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((error) => {
      indexReady = null;
      throw error;
    });
  }
  await indexReady;

  async function incrementOnce(key: string, now: Date): Promise<AttemptRecord | null> {
    const windowMs = WINDOW_SECONDS * 1000;
    const lockEnd = plusSeconds(now, LOCK_SECONDS);
    const lockedUntilOrNull = { $ifNull: ['$lockedUntil', null] };
    return collection.findOneAndUpdate(
      { _id: key },
      [
        // (a) reset an expired lock, or an expired window when there is no lock
        {
          $set: {
            _reset: {
              $cond: [
                { $ne: [lockedUntilOrNull, null] },
                { $lte: ['$lockedUntil', now] },
                { $lte: [{ $add: [{ $ifNull: ['$windowStart', new Date(0)] }, windowMs] }, now] }
              ]
            }
          }
        },
        // (b) count this attempt
        {
          $set: {
            attempts: { $cond: ['$_reset', 1, { $add: [{ $ifNull: ['$attempts', 0] }, 1] }] },
            windowStart: { $cond: ['$_reset', now, '$windowStart'] },
            lockedUntil: { $cond: ['$_reset', null, lockedUntilOrNull] }
          }
        },
        // (c) the 5th attempt starts the lock; later attempts keep it
        { $set: { lockedUntil: { $cond: [{ $eq: ['$attempts', MAX_ATTEMPTS] }, lockEnd, '$lockedUntil'] } } },
        // (d) the TTL index removes the document once both the window and the lock are over
        { $set: { expiresAt: { $max: [{ $add: ['$windowStart', windowMs] }, '$lockedUntil'] } } },
        { $unset: '_reset' }
      ],
      { upsert: true, returnDocument: 'after' }
    );
  }

  return {
    async increment(key, now) {
      let record: AttemptRecord | null;
      try {
        record = await incrementOnce(key, now);
      } catch (error) {
        // Two first attempts racing on the upsert: the loser retries once against the winner's document.
        if (!isDuplicateKey(error)) throw error;
        record = await incrementOnce(key, now);
      }
      if (!record) throw new Error('login_attempts update returned no document');
      return record;
    },
    async get(key) {
      return collection.findOne({ _id: key });
    },
    async clear(key) {
      await collection.deleteOne({ _id: key });
    }
  };
}
