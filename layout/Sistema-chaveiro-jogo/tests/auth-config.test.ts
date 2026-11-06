import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdminLoginHint, isProductionEnv, resolveAdminCredentials } from '../lib/auth-config';

// Fixture values only: none of these is a real credential.
const WELL_FORMED_HASH = 'scrypt:16384:8:1:c2FsdHNhbHRzYWx0c2FsdA:aGFzaGhhc2hoYXNoaGFzaA';
const DEV_HINT = 'Modo desenvolvimento: use admin / admin123';

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as unknown as NodeJS.ProcessEnv;
}

const prodComplete = {
  NODE_ENV: 'production',
  ADMIN_USERNAME: 'owner',
  ADMIN_PASSWORD_HASH: WELL_FORMED_HASH,
  AUTH_SECRET: 'fixture-secret'
};

test('T05 production uses the hash and ignores plain ADMIN_PASSWORD', () => {
  const result = resolveAdminCredentials(env({ ...prodComplete, ADMIN_PASSWORD: 'ignored-plain' }));
  assert.deepEqual(result, {
    ok: true,
    username: 'owner',
    secret: { kind: 'hash', value: WELL_FORMED_HASH },
    usingDefaults: false
  });

  const plainOnly = resolveAdminCredentials(
    env({ NODE_ENV: 'production', ADMIN_USERNAME: 'owner', ADMIN_PASSWORD: 'plain', AUTH_SECRET: 'fixture-secret' })
  );
  assert.deepEqual(plainOnly, { ok: false, reason: 'missing-credentials' });
});

test('T06 production refuses when a required variable is missing or the hash is malformed', () => {
  const { ADMIN_USERNAME: _u, ...noUser } = prodComplete;
  const { ADMIN_PASSWORD_HASH: _h, ...noHash } = prodComplete;
  const { AUTH_SECRET: _s, ...noSecret } = prodComplete;

  assert.deepEqual(resolveAdminCredentials(env(noUser)), { ok: false, reason: 'missing-credentials' });
  assert.deepEqual(resolveAdminCredentials(env(noHash)), { ok: false, reason: 'missing-credentials' });
  assert.deepEqual(resolveAdminCredentials(env(noSecret)), { ok: false, reason: 'missing-auth-secret' });
  assert.deepEqual(
    resolveAdminCredentials(env({ ...prodComplete, ADMIN_PASSWORD_HASH: 'not-a-hash' })),
    { ok: false, reason: 'missing-credentials' }
  );
  // Right shape, parameters outside the bounds lib/password.ts accepts: every login would fail silently.
  for (const outOfBounds of [
    'scrypt:3:8:1:c2FsdHNhbHRzYWx0c2FsdA:aGFzaGhhc2hoYXNoaGFzaA',
    'scrypt:16384:64:1:c2FsdHNhbHRzYWx0c2FsdA:aGFzaGhhc2hoYXNoaGFzaA',
    'scrypt:16384:8:1:c2FsdA:aGFzaGhhc2hoYXNoaGFzaA'
  ]) {
    assert.deepEqual(
      resolveAdminCredentials(env({ ...prodComplete, ADMIN_PASSWORD_HASH: outOfBounds })),
      { ok: false, reason: 'missing-credentials' },
      outOfBounds
    );
  }
});

test('T07 outside production the order is hash, then plain, then the defaults', () => {
  assert.deepEqual(
    resolveAdminCredentials(env({ NODE_ENV: 'development', ADMIN_USERNAME: 'dev', ADMIN_PASSWORD_HASH: WELL_FORMED_HASH, ADMIN_PASSWORD: 'plain' })),
    { ok: true, username: 'dev', secret: { kind: 'hash', value: WELL_FORMED_HASH }, usingDefaults: false }
  );
  assert.deepEqual(
    resolveAdminCredentials(env({ NODE_ENV: 'development', ADMIN_USERNAME: 'dev', ADMIN_PASSWORD: 'plain' })),
    { ok: true, username: 'dev', secret: { kind: 'plain', value: 'plain' }, usingDefaults: false }
  );
  assert.deepEqual(resolveAdminCredentials(env({ NODE_ENV: 'development' })), {
    ok: true,
    username: 'admin',
    secret: { kind: 'plain', value: 'admin123' },
    usingDefaults: true
  });
  assert.deepEqual(resolveAdminCredentials(env({})), {
    ok: true,
    username: 'admin',
    secret: { kind: 'plain', value: 'admin123' },
    usingDefaults: true
  });
});

test('T08 the hint shows only for development defaults', () => {
  assert.equal(getAdminLoginHint(env({ NODE_ENV: 'development' })), DEV_HINT);
  assert.equal(getAdminLoginHint(env({ NODE_ENV: 'development', ADMIN_USERNAME: 'dev', ADMIN_PASSWORD: 'plain' })), null);
  assert.equal(getAdminLoginHint(env({ NODE_ENV: 'production' })), null);
  assert.equal(getAdminLoginHint(env(prodComplete)), null);
  assert.equal(isProductionEnv(env({ NODE_ENV: 'production' })), true);
  assert.equal(isProductionEnv(env({ NODE_ENV: 'development' })), false);
});
