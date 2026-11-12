import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryAttemptStore } from '../lib/login-throttle';
import {
  PAIR_ATTEMPT_POLICY,
  PAIR_CODE_SECONDS,
  createMemoryPairStore,
  generatePairCode,
  normalizePairCode,
  pairCodeExpiry,
  pairThrottleKey,
  registerPairAttempt
} from '../lib/pair-code';

const NOW = 1_800_000_000;
const grant = { slug: 'super-retro', nfcId: 'demo', passExp: NOW + 6 * 60 * 60 };

test('generatePairCode returns 6 digits, keeping leading zeros', () => {
  for (let i = 0; i < 200; i += 1) {
    assert.match(generatePairCode(), /^\d{6}$/);
  }
});

test('normalizePairCode keeps digits and needs exactly 6', () => {
  assert.equal(normalizePairCode('482 913'), '482913');
  assert.equal(normalizePairCode('012345'), '012345');
  assert.equal(normalizePairCode('12345'), null);
  assert.equal(normalizePairCode('1234567'), null);
  assert.equal(normalizePairCode(482913), null);
  assert.equal(normalizePairCode(undefined), null);
  assert.equal(normalizePairCode('1'.repeat(40)), null);
});

test('pairCodeExpiry never passes the pass expiry', () => {
  assert.equal(pairCodeExpiry(NOW + 3600, NOW), NOW + PAIR_CODE_SECONDS);
  assert.equal(pairCodeExpiry(NOW + 60, NOW), NOW + 60);
});

test('a code redeems once and returns the grant', async () => {
  const store = createMemoryPairStore();
  const { code, expiresAt } = await store.create(grant, NOW);
  assert.equal(expiresAt, NOW + PAIR_CODE_SECONDS);

  assert.deepEqual(await store.redeem(code, NOW + 10), grant);
  assert.equal(await store.redeem(code, NOW + 11), null);
});

test('an expired code does not redeem', async () => {
  const store = createMemoryPairStore();
  const { code } = await store.create(grant, NOW);
  assert.equal(await store.redeem(code, NOW + PAIR_CODE_SECONDS), null);
});

test('an unknown code does not redeem', async () => {
  const store = createMemoryPairStore(() => '111111');
  await store.create(grant, NOW);
  assert.equal(await store.redeem('222222', NOW), null);
});

test('create skips a code still in use and fails when none is free', async () => {
  const codes = ['111111', '111111', '222222'];
  const store = createMemoryPairStore(() => codes.shift() ?? '111111');
  assert.equal((await store.create(grant, NOW)).code, '111111');
  assert.equal((await store.create(grant, NOW)).code, '222222');
  await assert.rejects(store.create(grant, NOW), /No free pairing code/);
});

test('redeem attempts are limited per IP', async () => {
  const store = createMemoryAttemptStore();
  const now = new Date(NOW * 1000);
  for (let i = 0; i < PAIR_ATTEMPT_POLICY.maxAttempts; i += 1) {
    assert.deepEqual(await registerPairAttempt(store, '203.0.113.7', now), { allowed: true });
  }
  const denied = await registerPairAttempt(store, '203.0.113.7', now);
  assert.equal(denied.allowed, false);
  assert.ok(!denied.allowed && denied.retryAfterSeconds > 0);

  // Another IP keeps its own counter.
  assert.deepEqual(await registerPairAttempt(store, '198.51.100.2', now), { allowed: true });
});

test('pairThrottleKey does not collide with the login keys', () => {
  assert.equal(pairThrottleKey('203.0.113.7'), 'pair:203.0.113.7');
  assert.equal(pairThrottleKey('a|b'), 'pair:ab');
});
