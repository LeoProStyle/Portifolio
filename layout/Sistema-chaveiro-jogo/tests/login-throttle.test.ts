import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearLoginAttempts,
  createMemoryAttemptStore,
  ipThrottleKey,
  peekLoginLock,
  registerIpAttempt,
  registerLoginAttempt,
  throttleKey
} from '../lib/login-throttle';

const T0 = new Date('2026-11-06T12:00:00.000Z');

function at(seconds: number): Date {
  return new Date(T0.getTime() + seconds * 1000);
}

test('T10 the 6th attempt after 5 failures is locked until 15 minutes after the 5th', async () => {
  const store = createMemoryAttemptStore();
  const key = throttleKey('admin', '1.1.1.1');
  for (let i = 0; i < 5; i += 1) {
    assert.deepEqual(await registerLoginAttempt(store, key, at(i * 60)), { allowed: true });
  }
  // 5th attempt at t0+4m starts the lock; the 6th comes at t0+5m.
  assert.deepEqual(await registerLoginAttempt(store, key, at(300)), { allowed: false, retryAfterSeconds: 900 - 60 });
  assert.deepEqual(await peekLoginLock(store, key, at(300)), { allowed: false, retryAfterSeconds: 900 - 60 });
  assert.deepEqual(await peekLoginLock(store, key, at(600)), { allowed: false, retryAfterSeconds: 900 - 360 });
});

test('T11 a successful login clears the counter', async () => {
  const store = createMemoryAttemptStore();
  const key = throttleKey('admin', '1.1.1.1');
  for (let i = 0; i < 4; i += 1) await registerLoginAttempt(store, key, at(i));
  await clearLoginAttempts(store, key);
  for (let i = 0; i < 4; i += 1) {
    assert.deepEqual(await registerLoginAttempt(store, key, at(10 + i)), { allowed: true });
  }
  assert.deepEqual(await peekLoginLock(store, key, at(20)), { allowed: true });
});

test('T12 the window is fixed and starts at the first attempt', async () => {
  const store = createMemoryAttemptStore();
  const key = throttleKey('admin', '1.1.1.1');
  for (let i = 0; i < 4; i += 1) await registerLoginAttempt(store, key, at(i));
  // Window opened at t0 and closed at t0+900s: the next attempt opens a new window.
  assert.deepEqual(await registerLoginAttempt(store, key, at(901)), { allowed: true });
  assert.deepEqual(await registerLoginAttempt(store, key, at(902)), { allowed: true });
  assert.deepEqual(await peekLoginLock(store, key, at(903)), { allowed: true });
});

test('T13 the lock ends after 15 minutes and the counter restarts', async () => {
  const store = createMemoryAttemptStore();
  const key = throttleKey('admin', '1.1.1.1');
  for (let i = 0; i < 5; i += 1) await registerLoginAttempt(store, key, at(i));
  // Lock started at the 5th attempt (t0+4s) and ends at t0+904s.
  assert.equal((await peekLoginLock(store, key, at(903))).allowed, false);
  assert.deepEqual(await peekLoginLock(store, key, at(905)), { allowed: true });
  assert.deepEqual(await registerLoginAttempt(store, key, at(905)), { allowed: true });
  const record = await store.get(key);
  assert.equal(record?.attempts, 1);
});

test('T14 the key isolates user and IP', async () => {
  const store = createMemoryAttemptStore();
  const locked = throttleKey('u', '1.1.1.1');
  for (let i = 0; i < 6; i += 1) await registerLoginAttempt(store, locked, at(i));
  assert.equal((await peekLoginLock(store, locked, at(10))).allowed, false);
  assert.deepEqual(await registerLoginAttempt(store, throttleKey('u', '2.2.2.2'), at(10)), { allowed: true });
  assert.deepEqual(await registerLoginAttempt(store, throttleKey('v', '1.1.1.1'), at(10)), { allowed: true });
  assert.notEqual(throttleKey('u', '1.1.1.1'), throttleKey('u', '2.2.2.2'));
});

test('T26 one IP gets at most 30 attempts in 15 minutes, whatever usernames it rotates', async () => {
  const store = createMemoryAttemptStore();
  for (let i = 0; i < 30; i += 1) {
    assert.deepEqual(await registerIpAttempt(store, '7.7.7.7', at(i)), { allowed: true }, `attempt ${i + 1}`);
  }
  // The 30th attempt (t0+29s) starts a 15-minute lock on the IP key.
  assert.deepEqual(await registerIpAttempt(store, '7.7.7.7', at(30)), { allowed: false, retryAfterSeconds: 900 - 1 });
  assert.deepEqual(await peekLoginLock(store, ipThrottleKey('7.7.7.7'), at(30)), { allowed: false, retryAfterSeconds: 899 });
  assert.deepEqual(await registerIpAttempt(store, '8.8.8.8', at(30)), { allowed: true });
  // The IP key never collides with a username+IP key.
  assert.notEqual(ipThrottleKey('7.7.7.7'), throttleKey('ip', '7.7.7.7'));
  assert.ok(ipThrottleKey('x'.repeat(500)).length <= 67, 'IP key length is capped');
  assert.deepEqual(await registerLoginAttempt(store, throttleKey('admin', '7.7.7.7'), at(31)), { allowed: true });
});
