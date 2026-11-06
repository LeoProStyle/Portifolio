import { isProductionEnv, logAuthEvent, resolveAdminCredentials } from '@/lib/auth-config';
import {
  clearLoginAttempts,
  getMongoAttemptStore,
  peekLoginLock,
  registerLoginAttempt,
  throttleKey,
  type LoginAttemptStore,
  type ThrottleDecision
} from '@/lib/login-throttle';
import { verifyPasswordHash, verifyPlainPassword } from '@/lib/password';
import { getClientIp } from '@/lib/request-ip';

// Admin login orchestration (SF02): fail-closed configuration, throttle, constant-time comparison.
// Log rule (RN05): never the password, the hash or the configured username. A typed username that
// equals the configured one is logged as { usernameMatched: true }.

export type AdminUser = { id: 'admin'; name: 'Admin'; email: 'admin@retrokey.local' };

export type LoginOutcome = 'success' | 'failure' | 'locked' | 'disabled';

export type AdminLoginDeps = {
  env?: NodeJS.ProcessEnv;
  getStore?: () => Promise<LoginAttemptStore>;
  now?: () => Date;
  timeoutMs?: number;
};

export const THROTTLE_TIMEOUT_MS = 5000;

const ADMIN_USER: AdminUser = { id: 'admin', name: 'Admin', email: 'admin@retrokey.local' };
const CREDENTIALS_CALLBACK_SUFFIX = '/callback/credentials';

type ResolvedDeps = Required<AdminLoginDeps>;

function resolveDeps(deps: AdminLoginDeps = {}): ResolvedDeps {
  return {
    env: deps.env ?? process.env,
    getStore: deps.getStore ?? getMongoAttemptStore,
    now: deps.now ?? (() => new Date()),
    timeoutMs: deps.timeoutMs ?? THROTTLE_TIMEOUT_MS
  };
}

/** Runs one store operation under the timeout; getting the store (Mongo connect) counts too. */
async function withStore<T>(deps: ResolvedDeps, operation: (store: LoginAttemptStore) => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('login throttle store timed out')), deps.timeoutMs);
  });
  try {
    return await Promise.race([deps.getStore().then(operation), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}

function logIdentity(username: string, configuredUsername: string | null, ip: string): Record<string, unknown> {
  if (configuredUsername !== null && verifyPlainPassword(username, configuredUsername)) {
    return { usernameMatched: true, ip };
  }
  return { username, ip };
}

function logOutcome(outcome: Exclude<LoginOutcome, 'disabled'>, details: Record<string, unknown>) {
  logAuthEvent(`admin login ${outcome}`, details);
}

export async function authorizeAdmin(
  credentials: Partial<Record<string, unknown>>,
  request: Request,
  deps?: AdminLoginDeps
): Promise<AdminUser | null> {
  const resolvedDeps = resolveDeps(deps);
  const expected = resolveAdminCredentials(resolvedDeps.env);
  if (!expected.ok) {
    console.error('[auth] login disabled', { reason: expected.reason });
    return null;
  }

  const username = typeof credentials?.username === 'string' ? credentials.username : '';
  const password = typeof credentials?.password === 'string' ? credentials.password : '';
  const ip = getClientIp(request.headers);
  const key = throttleKey(username, ip);
  const identity = logIdentity(username, expected.username, ip);

  let throttleOn = true;
  let decision: ThrottleDecision;
  try {
    decision = await withStore(resolvedDeps, (store) => registerLoginAttempt(store, key, resolvedDeps.now()));
  } catch (error) {
    if (isProductionEnv(resolvedDeps.env)) {
      console.error('[auth] login throttle unavailable', { error: errorName(error) });
      return null;
    }
    console.warn('[auth] login throttle skipped outside production', { error: errorName(error) });
    throttleOn = false;
    decision = { allowed: true };
  }

  if (!decision.allowed) {
    logOutcome('locked', identity);
    return null;
  }

  // Both comparisons always run, so the response time does not reveal which one failed.
  const userMatches = verifyPlainPassword(username, expected.username);
  const passwordMatches =
    expected.secret.kind === 'hash'
      ? await verifyPasswordHash(password, expected.secret.value)
      : verifyPlainPassword(password, expected.secret.value);

  if (userMatches && passwordMatches) {
    if (throttleOn) {
      try {
        await withStore(resolvedDeps, (store) => clearLoginAttempts(store, key));
      } catch (error) {
        console.warn('[auth] login throttle clear failed', { error: errorName(error) });
      }
    }
    logOutcome('success', { id: ADMIN_USER.id, ip });
    return ADMIN_USER;
  }

  logOutcome('failure', identity);
  return null;
}

/**
 * Pre-check for POST /api/auth/callback/credentials, run before the NextAuth handler.
 * Returns a 429 while the username+IP key is locked; null lets the request through.
 */
export async function checkCredentialsLock(request: Request, deps?: AdminLoginDeps): Promise<Response | null> {
  if (request.method !== 'POST') return null;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  if (!url.pathname.endsWith(CREDENTIALS_CALLBACK_SUFFIX)) return null;

  let username = '';
  try {
    const form = await request.clone().formData();
    const value = form.get('username');
    username = typeof value === 'string' ? value : '';
  } catch {
    return null;
  }
  if (!username) return null;

  const resolvedDeps = resolveDeps(deps);
  const ip = getClientIp(request.headers);
  let decision: ThrottleDecision;
  try {
    decision = await withStore(resolvedDeps, (store) => peekLoginLock(store, throttleKey(username, ip), resolvedDeps.now()));
  } catch {
    // authorizeAdmin decides on a store failure (refuse in production, skip outside it).
    return null;
  }
  if (decision.allowed) return null;

  const expected = resolveAdminCredentials(resolvedDeps.env);
  logOutcome('locked', logIdentity(username, expected.ok ? expected.username : null, ip));

  // next-auth/react signIn() parses data.url; error=CredentialsSignin keeps the form message generic.
  const errorUrl = new URL('/api/auth/error', url.origin);
  errorUrl.searchParams.set('error', 'CredentialsSignin');
  return new Response(JSON.stringify({ error: 'TooManyRequests', url: errorUrl.toString() }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(decision.retryAfterSeconds) }
  });
}
