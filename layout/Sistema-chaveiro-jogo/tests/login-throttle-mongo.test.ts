import test from 'node:test';
import assert from 'node:assert/strict';
import { getMongoClient } from '../lib/mongo';
import {
  getMongoAttemptStore,
  peekLoginLock,
  registerIpAttempt,
  registerLoginAttempt,
  throttleKey,
  type LoginAttemptStore
} from '../lib/login-throttle';

// Runs the throttle policy against the real MongoDB store (final review FR-1): it checks that the
// aggregation pipeline in getMongoAttemptStore behaves like the in-memory store of
// tests/login-throttle.test.ts. Skipped when MONGODB_URI is unset or the server does not answer.
// Run it with the dev database: node --env-file=.env.local --import tsx --test tests/login-throttle-mongo.test.ts
// Keys use the e2e-sf02- prefix and are deleted at the end.

const T0 = new Date('2026-11-06T12:00:00.000Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const RUN = `e2e-sf02-${Date.now().toString(36)}`;
const usedKeys: string[] = [];

async function connect(): Promise<LoginAttemptStore | null> {
  if (!process.env.MONGODB_URI) return null;
  try {
    return await Promise.race([
      getMongoAttemptStore(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000).unref())
    ]);
  } catch {
    return null;
  }
}

function key(name: string) {
  const value = throttleKey(`${RUN}-${name}`, '203.0.113.7');
  usedKeys.push(value);
  return value;
}

test('Mongo store mirrors the throttle policy', async (t) => {
  const store = await connect();
  if (!store) {
    t.skip('MongoDB not reachable: set MONGODB_URI to a dev database to run this test');
    return;
  }
  try {
    await t.test('T10 the 6th attempt is locked until 15 minutes after the 5th', async () => {
      const k = key('t10');
      for (let i = 0; i < 5; i += 1) assert.deepEqual(await registerLoginAttempt(store, k, at(i * 60)), { allowed: true });
      assert.deepEqual(await registerLoginAttempt(store, k, at(300)), { allowed: false, retryAfterSeconds: 840 });
      assert.deepEqual(await peekLoginLock(store, k, at(600)), { allowed: false, retryAfterSeconds: 540 });
      const record = await store.get(k);
      assert.equal(record?.attempts, 6);
      assert.ok(record?.expiresAt instanceof Date);
    });

    await t.test('T11 clear removes the record', async () => {
      const k = key('t11');
      for (let i = 0; i < 4; i += 1) await registerLoginAttempt(store, k, at(i));
      await store.clear(k);
      assert.equal(await store.get(k), null);
    });

    await t.test('T12/T13 the window and the lock expire and the counter restarts', async () => {
      const windowKey = key('t12');
      for (let i = 0; i < 4; i += 1) await registerLoginAttempt(store, windowKey, at(i));
      assert.deepEqual(await registerLoginAttempt(store, windowKey, at(901)), { allowed: true });
      assert.equal((await store.get(windowKey))?.attempts, 1);

      const lockKey = key('t13');
      for (let i = 0; i < 5; i += 1) await registerLoginAttempt(store, lockKey, at(i));
      assert.deepEqual(await registerLoginAttempt(store, lockKey, at(905)), { allowed: true });
      assert.equal((await store.get(lockKey))?.attempts, 1);
    });

    await t.test('burst: 10 parallel attempts on a fresh key never allow more than 5', async () => {
      const k = key('burst');
      const decisions = await Promise.all(Array.from({ length: 10 }, () => registerLoginAttempt(store, k, at(0))));
      assert.equal(decisions.filter((d) => d.allowed).length, 5);
      const record = await store.get(k);
      assert.equal(record?.attempts, 10);
      assert.ok(record?.lockedUntil instanceof Date);
    });

    await t.test('T26 the IP key locks after 30 attempts', async () => {
      const ip = `198.51.100.${Math.floor(Math.random() * 200)}-${RUN}`;
      usedKeys.push(`ip:${ip}`);
      for (let i = 0; i < 30; i += 1) assert.equal((await registerIpAttempt(store, ip, at(i))).allowed, true);
      assert.equal((await registerIpAttempt(store, ip, at(30))).allowed, false);
    });
  } finally {
    for (const k of usedKeys) await store.clear(k).catch(() => undefined);
    await (await getMongoClient()).close();
  }
});
