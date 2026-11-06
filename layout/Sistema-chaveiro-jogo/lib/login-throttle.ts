// Stub: implemented in tasks.md T10.
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

function notImplemented(name: string): never {
  throw new Error(`${name} not implemented (tasks.md T10)`);
}

export function throttleKey(_username: string, _ip: string): string {
  return notImplemented('throttleKey');
}

export async function peekLoginLock(_store: LoginAttemptStore, _key: string, _now: Date): Promise<ThrottleDecision> {
  return notImplemented('peekLoginLock');
}

export async function registerLoginAttempt(_store: LoginAttemptStore, _key: string, _now: Date): Promise<ThrottleDecision> {
  return notImplemented('registerLoginAttempt');
}

export async function clearLoginAttempts(_store: LoginAttemptStore, _key: string): Promise<void> {
  return notImplemented('clearLoginAttempts');
}

export function createMemoryAttemptStore(): LoginAttemptStore {
  return notImplemented('createMemoryAttemptStore');
}

export async function getMongoAttemptStore(): Promise<LoginAttemptStore> {
  return notImplemented('getMongoAttemptStore');
}
