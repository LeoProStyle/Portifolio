import { getDb } from '@/lib/mongo';

// Login throttle (SF02 RF03, RN04), two keys:
// - username+IP (USER_POLICY): 5 attempts; a successful login clears it.
// - IP alone (IP_POLICY): 30 attempts, never cleared by a success; it caps how much scrypt and
//   Mongo work one IP can cause by rotating usernames (final review FR-8).
// Each counter counts ATTEMPTS and is incremented before the password is checked. Fixed window of
// 15 minutes from the first attempt; the last allowed attempt starts a 15-minute lock; any attempt
// past it is denied until the lock ends.

export type ThrottlePolicy = { maxAttempts: number; windowSeconds: number; lockSeconds: number };

export const MAX_ATTEMPTS = 5;
export const WINDOW_SECONDS = 900;
export const LOCK_SECONDS = 900;
export const IP_MAX_ATTEMPTS = 30;
export const USER_POLICY: ThrottlePolicy = { maxAttempts: MAX_ATTEMPTS, windowSeconds: WINDOW_SECONDS, lockSeconds: LOCK_SECONDS };
export const IP_POLICY: ThrottlePolicy = { maxAttempts: IP_MAX_ATTEMPTS, windowSeconds: WINDOW_SECONDS, lockSeconds: LOCK_SECONDS };
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
  increment(key: string, now: Date, policy?: ThrottlePolicy): Promise<AttemptRecord>;
  get(key: string): Promise<AttemptRecord | null>;
  clear(key: string): Promise<void>;
}

export function throttleKey(username: string, ip: string): string {
  return `${username.trim().slice(0, MAX_USERNAME_KEY_LENGTH)}|${ip}`;
}

/** IP-only key. It has no '|', so it never equals a username+IP key. */
export function ipThrottleKey(ip: string): string {
  return `ip:${ip.replace(/\|/g, '')}`;
}

function plusSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function retryAfter(lockedUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));
}

function isExpired(record: AttemptRecord, now: Date, policy: ThrottlePolicy): boolean {
  if (record.lockedUntil) return record.lockedUntil.getTime() <= now.getTime();
  return plusSeconds(record.windowStart, policy.windowSeconds).getTime() <= now.getTime();
}

/** The one place the policy is written; the Mongo pipeline in getMongoAttemptStore mirrors it step for step. */
function applyAttempt(previous: AttemptRecord | null, key: string, now: Date, policy: ThrottlePolicy): AttemptRecord {
  const current = previous && !isExpired(previous, now, policy) ? previous : null;
  const attempts = (current?.attempts ?? 0) + 1;
  const windowStart = current?.windowStart ?? now;
  const lockedUntil = attempts === policy.maxAttempts ? plusSeconds(now, policy.lockSeconds) : current?.lockedUntil ?? null;
  const windowEnd = plusSeconds(windowStart, policy.windowSeconds);
  const expiresAt = lockedUntil && lockedUntil > windowEnd ? lockedUntil : windowEnd;
  return { _id: key, attempts, windowStart, lockedUntil, expiresAt };
}

function decide(record: AttemptRecord, now: Date, policy: ThrottlePolicy): ThrottleDecision {
  if (record.attempts <= policy.maxAttempts) return { allowed: true };
  // attempts past the limit with no lock cannot happen by construction; if seen, treat it as a fresh lock.
  const lockedUntil = record.lockedUntil ?? plusSeconds(now, policy.lockSeconds);
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
  return decide(await store.increment(key, now, USER_POLICY), now, USER_POLICY);
}

/** Counts one attempt on the IP-only key (IP_POLICY). Never cleared by a successful login. */
export async function registerIpAttempt(store: LoginAttemptStore, ip: string, now: Date): Promise<ThrottleDecision> {
  return decide(await store.increment(ipThrottleKey(ip), now, IP_POLICY), now, IP_POLICY);
}

export async function clearLoginAttempts(store: LoginAttemptStore, key: string): Promise<void> {
  await store.clear(key);
}

/** In-process store: tests, and nothing else (Vercel instances share no memory). */
export function createMemoryAttemptStore(): LoginAttemptStore {
  const records = new Map<string, AttemptRecord>();
  return {
    async increment(key, now, policy = USER_POLICY) {
      const next = applyAttempt(records.get(key) ?? null, key, now, policy);
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

  async function incrementOnce(key: string, now: Date, policy: ThrottlePolicy): Promise<AttemptRecord | null> {
    const windowMs = policy.windowSeconds * 1000;
    const lockEnd = plusSeconds(now, policy.lockSeconds);
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
        { $set: { lockedUntil: { $cond: [{ $eq: ['$attempts', policy.maxAttempts] }, lockEnd, '$lockedUntil'] } } },
        // (d) the TTL index removes the document once both the window and the lock are over
        { $set: { expiresAt: { $max: [{ $add: ['$windowStart', windowMs] }, '$lockedUntil'] } } },
        { $unset: '_reset' }
      ],
      { upsert: true, returnDocument: 'after' }
    );
  }

  return {
    async increment(key, now, policy = USER_POLICY) {
      let record: AttemptRecord | null;
      try {
        record = await incrementOnce(key, now, policy);
      } catch (error) {
        // Two first attempts racing on the upsert: the loser retries once against the winner's document.
        if (!isDuplicateKey(error)) throw error;
        record = await incrementOnce(key, now, policy);
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
