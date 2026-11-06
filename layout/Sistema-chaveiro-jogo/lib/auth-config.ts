import { parsePasswordHashFormat } from '@/lib/password-format';

// Credential resolution for the single admin login.
// No Node-only imports here (no node:crypto, no mongodb): the hash is checked for shape and bounds only.

export type AdminSecret = { kind: 'hash' | 'plain'; value: string };

export type AdminCredentialsResult =
  | { ok: true; username: string; secret: AdminSecret; usingDefaults: boolean }
  | { ok: false; reason: 'missing-credentials' | 'missing-auth-secret' };

const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'admin123';
const DEV_HINT = 'Modo desenvolvimento: use admin / admin123';

function read(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Fail closed: only NODE_ENV=development or test counts as a development environment. Any other
 * value, or none, gets the production rules (final review FR-10).
 */
export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test';
}

/**
 * Production (any NODE_ENV other than development or test): ADMIN_USERNAME, a well-formed ADMIN_PASSWORD_HASH and AUTH_SECRET are all required;
 * plain ADMIN_PASSWORD is ignored. Outside production: hash, then plain, then admin/admin123.
 */
export function resolveAdminCredentials(env: NodeJS.ProcessEnv = process.env): AdminCredentialsResult {
  const username = read(env, 'ADMIN_USERNAME');
  const hash = read(env, 'ADMIN_PASSWORD_HASH');

  if (isProductionEnv(env)) {
    if (!username || !hash || !parsePasswordHashFormat(hash)) {
      return { ok: false, reason: 'missing-credentials' };
    }
    if (!read(env, 'AUTH_SECRET')) {
      return { ok: false, reason: 'missing-auth-secret' };
    }
    return { ok: true, username, secret: { kind: 'hash', value: hash }, usingDefaults: false };
  }

  const resolvedUsername = username || DEFAULT_USERNAME;
  if (hash) {
    return { ok: true, username: resolvedUsername, secret: { kind: 'hash', value: hash }, usingDefaults: false };
  }
  const plain = read(env, 'ADMIN_PASSWORD');
  if (plain) {
    return { ok: true, username: resolvedUsername, secret: { kind: 'plain', value: plain }, usingDefaults: false };
  }
  return {
    ok: true,
    username: resolvedUsername,
    secret: { kind: 'plain', value: DEFAULT_PASSWORD },
    usingDefaults: !username
  };
}

/** The dev hint, only while the admin/admin123 defaults are in use outside production; otherwise null. */
export function getAdminLoginHint(env: NodeJS.ProcessEnv = process.env): string | null {
  const resolved = resolveAdminCredentials(env);
  return resolved.ok && resolved.usingDefaults ? DEV_HINT : null;
}

export function logAuthEvent(message: string, details?: Record<string, unknown>) {
  console.info(`[auth] ${message}`, details ?? {});
}
