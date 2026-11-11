import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_COOLDOWN_SECONDS,
  DEMO_SECONDS,
  PASS_SECONDS,
  decidePlayAccess,
  demoCookieName,
  getPlayAccessKey,
  issueDemoToken,
  issuePassToken,
  issueRomTicket,
  passCookieName,
  verifyToken
} from '../lib/play-access';
import { createMemoryDemoStore, demoStartKey } from '../lib/demo-store';
import { isBlockedDevToolsKey } from '../components/useDevToolsGuard';

const key = getPlayAccessKey({ AUTH_SECRET: 'test-secret', NODE_ENV: 'test' })!;
const otherKey = getPlayAccessKey({ AUTH_SECRET: 'other-secret', NODE_ENV: 'test' })!;
const NOW = 1_800_000_000;
const SLUG = 'super-retro';

test('play key: production without AUTH_SECRET has no key; dev falls back', () => {
  assert.equal(getPlayAccessKey({ NODE_ENV: 'production' }), null);
  assert.equal(getPlayAccessKey({ AUTH_SECRET: '  ', NODE_ENV: 'production' }), null);
  assert.ok(getPlayAccessKey({ NODE_ENV: 'development' }));
  assert.ok(getPlayAccessKey({ AUTH_SECRET: 'x', NODE_ENV: 'production' }));
});

test('tokens verify only with the same key, kind, slug and before exp', () => {
  const ticket = issueRomTicket(SLUG, 'demo', NOW + 60, key);
  assert.deepEqual(verifyToken(ticket, 'rom', SLUG, key, NOW), { k: 'rom', s: SLUG, m: 'demo', exp: NOW + 60 });
  assert.equal(verifyToken(ticket, 'rom', SLUG, otherKey, NOW), null, 'other key');
  assert.equal(verifyToken(ticket, 'pass', SLUG, key, NOW), null, 'other kind');
  assert.equal(verifyToken(ticket, 'rom', 'other-game', key, NOW), null, 'other slug');
  assert.equal(verifyToken(ticket, 'rom', SLUG, key, NOW + 60), null, 'expired');
  assert.equal(verifyToken(null, 'rom', SLUG, key, NOW), null);
  assert.equal(verifyToken('garbage', 'rom', SLUG, key, NOW), null);
  assert.equal(verifyToken(`${ticket}.x`, 'rom', SLUG, key, NOW), null);
});

test('a token with an edited payload is refused', () => {
  const [, signature] = issueRomTicket(SLUG, 'demo', NOW + 60, key).split('.');
  const forgedBody = Buffer.from(JSON.stringify({ k: 'rom', s: SLUG, m: 'full', exp: NOW + 99999 })).toString('base64url');
  assert.equal(verifyToken(`${forgedBody}.${signature}`, 'rom', SLUG, key, NOW), null);
});

test('cookie names are per game and cookie-safe', () => {
  assert.notEqual(passCookieName('a'), passCookieName('b'));
  assert.notEqual(passCookieName('a'), demoCookieName('a'));
  assert.match(passCookieName('weird slug/é'), /^rk_pass_[0-9a-f]{16}$/);
});

test('a valid pass gives full access until the pass ends', () => {
  const passCookie = issuePassToken(SLUG, 'NFC-1', key, NOW);
  const decision = decidePlayAccess({ slug: SLUG, key, nowSeconds: NOW + 10, passCookie, ipDemoStartedAt: NOW });
  assert.deepEqual(decision, { mode: 'full', expiresAt: NOW + PASS_SECONDS });
});

test('a pass for another game or an expired pass does not give full access', () => {
  const otherGame = issuePassToken('other-game', 'NFC-1', key, NOW);
  assert.equal(decidePlayAccess({ slug: SLUG, key, nowSeconds: NOW, passCookie: otherGame }).mode, 'demo');
  const expired = issuePassToken(SLUG, 'NFC-1', key, NOW - PASS_SECONDS);
  assert.equal(decidePlayAccess({ slug: SLUG, key, nowSeconds: NOW, passCookie: expired }).mode, 'demo');
});

test('no previous demo starts a new demo', () => {
  assert.deepEqual(decidePlayAccess({ slug: SLUG, key, nowSeconds: NOW }), {
    mode: 'demo',
    startedAt: NOW,
    endsAt: NOW + DEMO_SECONDS,
    isNewDemo: true
  });
});

test('a reload during the demo keeps the original end time', () => {
  const demoCookie = issueDemoToken(SLUG, NOW, key);
  assert.deepEqual(decidePlayAccess({ slug: SLUG, key, nowSeconds: NOW + 100, demoCookie }), {
    mode: 'demo',
    startedAt: NOW,
    endsAt: NOW + DEMO_SECONDS,
    isNewDemo: false
  });
});

test('after the demo ends it is locked until the cooldown ends, then a new demo starts', () => {
  const demoCookie = issueDemoToken(SLUG, NOW, key);
  assert.deepEqual(decidePlayAccess({ slug: SLUG, key, nowSeconds: NOW + DEMO_SECONDS, demoCookie }), {
    mode: 'locked',
    retryAt: NOW + DEMO_COOLDOWN_SECONDS
  });
  // The demo cookie expires with the cooldown; the IP record is ignored once it is outside the window.
  const later = NOW + DEMO_COOLDOWN_SECONDS;
  const decision = decidePlayAccess({ slug: SLUG, key, nowSeconds: later, demoCookie, ipDemoStartedAt: NOW });
  assert.equal(decision.mode, 'demo');
  assert.equal(decision.mode === 'demo' && decision.isNewDemo, true);
});

test('clearing cookies does not reset the demo: the IP record still locks', () => {
  const decision = decidePlayAccess({ slug: SLUG, key, nowSeconds: NOW + DEMO_SECONDS + 5, ipDemoStartedAt: NOW });
  assert.deepEqual(decision, { mode: 'locked', retryAt: NOW + DEMO_COOLDOWN_SECONDS });
});

test('a forged demo cookie is ignored', () => {
  const forged = issueDemoToken(SLUG, NOW, otherKey);
  const decision = decidePlayAccess({ slug: SLUG, key, nowSeconds: NOW + DEMO_SECONDS + 5, demoCookie: forged });
  assert.equal(decision.mode === 'demo' && decision.isNewDemo, true);
});

test('memory demo store keeps one start per ip and game', async () => {
  const store = createMemoryDemoStore();
  assert.equal(await store.get('1.2.3.4', SLUG), null);
  await store.record('1.2.3.4', SLUG, NOW);
  assert.equal(await store.get('1.2.3.4', SLUG), NOW);
  assert.equal(await store.get('1.2.3.4', 'other-game'), null);
  assert.equal(await store.get('5.6.7.8', SLUG), null);
  assert.equal(demoStartKey('a|b', SLUG), `ab|${SLUG}`);
});

test('devtools guard blocks the devtools shortcuts and leaves game keys alone', () => {
  const k = (key: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey', boolean>> = {}) => ({
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...mods
  });
  assert.equal(isBlockedDevToolsKey(k('F12')), true);
  assert.equal(isBlockedDevToolsKey(k('I', { ctrlKey: true, shiftKey: true })), true);
  assert.equal(isBlockedDevToolsKey(k('j', { metaKey: true, altKey: true })), true);
  assert.equal(isBlockedDevToolsKey(k('u', { ctrlKey: true })), true);
  for (const key of ['z', 'x', 'a', 's', 'c', 'Enter', 'ArrowUp', ' ']) {
    assert.equal(isBlockedDevToolsKey(k(key)), false, key);
  }
  assert.equal(isBlockedDevToolsKey(k('c', { ctrlKey: true })), false, 'plain copy stays allowed');
});
