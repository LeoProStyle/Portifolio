import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdminLoginHint, isUsingDefaultAdminCredentials, resolveAdminCredentials } from '../lib/auth-config';

test('uses fallback admin credentials when env vars are not set', () => {
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;

  assert.deepEqual(resolveAdminCredentials(), {
    username: 'admin',
    password: 'admin123'
  });
  assert.equal(isUsingDefaultAdminCredentials(), true);
  assert.equal(getAdminLoginHint(), 'Modo desenvolvimento: use admin / admin123');
});

test('uses explicit env values when provided', () => {
  process.env.ADMIN_USERNAME = 'root';
  process.env.ADMIN_PASSWORD = 'supersecret';

  assert.deepEqual(resolveAdminCredentials(), {
    username: 'root',
    password: 'supersecret'
  });
  assert.equal(isUsingDefaultAdminCredentials(), false);
  assert.equal(getAdminLoginHint(), 'Use as credenciais configuradas em .env.local.');
});
