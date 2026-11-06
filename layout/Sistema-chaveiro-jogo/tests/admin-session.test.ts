import test from 'node:test';
import assert from 'node:assert/strict';
import type { JWT } from '@auth/core/jwt';
import { authConfig } from '../auth.config';
import { ADMIN_SESSION_MAX_AGE_SECONDS, isAdminSessionExpired } from '../lib/admin-session';

type JwtParams = Parameters<NonNullable<typeof authConfig.callbacks.jwt>>[0];

function runJwt(token: JWT, user?: { id: string }) {
  return authConfig.callbacks.jwt({ token, user } as unknown as JwtParams);
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

test('T21 the admin session ends 8 hours after login', async () => {
  assert.equal(ADMIN_SESSION_MAX_AGE_SECONDS, 28800);
  assert.equal((authConfig.session as { maxAge?: number }).maxAge, 28800);

  const signedIn = await runJwt({ sub: 'admin' }, { id: 'admin' });
  assert.ok(signedIn, 'sign-in keeps the token');
  assert.equal(signedIn.role, 'admin');
  assert.equal(typeof signedIn.loginAt, 'number');
  assert.ok(Math.abs((signedIn.loginAt as number) - nowSeconds()) <= 2);

  const within = await runJwt({ sub: 'admin', role: 'admin', loginAt: nowSeconds() - (8 * 3600 - 60) });
  assert.ok(within, 'token kept at 7h59m');

  const after = await runJwt({ sub: 'admin', role: 'admin', loginAt: nowSeconds() - (8 * 3600 + 60) });
  assert.equal(after, null);

  const withoutLoginAt = await runJwt({ sub: 'admin', role: 'admin' });
  assert.equal(withoutLoginAt, null);

  assert.equal(isAdminSessionExpired(undefined, 1000), true);
  assert.equal(isAdminSessionExpired(1000, 1000 + 28799), false);
  assert.equal(isAdminSessionExpired(1000, 1000 + 28800), true);
});
