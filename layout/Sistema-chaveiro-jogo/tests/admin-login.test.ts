import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeAdmin, checkCredentialsLock, type AdminLoginDeps } from '../lib/admin-login';
import { createMemoryAttemptStore, registerLoginAttempt, throttleKey, type LoginAttemptStore } from '../lib/login-throttle';
import { hashPassword } from '../lib/password';

// Fixture values only: none of these is a real credential.
const EXPECTED_USER = 'owner-fixture-name';
const PASSWORD = 'fixture-pass-9!';
const IP = '9.9.9.9';
const NOW = new Date('2026-11-06T12:00:00.000Z');
const ADMIN_USER = { id: 'admin', name: 'Admin', email: 'admin@retrokey.local' };

let HASH = '';
test.before(async () => {
  HASH = await hashPassword(PASSWORD);
});

function prodEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const base: Record<string, string | undefined> = {
    NODE_ENV: 'production',
    ADMIN_USERNAME: EXPECTED_USER,
    ADMIN_PASSWORD_HASH: HASH,
    AUTH_SECRET: 'fixture-secret',
    ...overrides
  };
  for (const key of Object.keys(base)) if (base[key] === undefined) delete base[key];
  return base as unknown as NodeJS.ProcessEnv;
}

function devEnv(): NodeJS.ProcessEnv {
  return { NODE_ENV: 'development', ADMIN_USERNAME: EXPECTED_USER, ADMIN_PASSWORD_HASH: HASH } as unknown as NodeJS.ProcessEnv;
}

function deps(env: NodeJS.ProcessEnv, store: LoginAttemptStore | (() => Promise<LoginAttemptStore>), timeoutMs = 200): AdminLoginDeps {
  return {
    env,
    getStore: typeof store === 'function' ? store : async () => store,
    now: () => NOW,
    timeoutMs
  };
}

function callbackRequest(fields: Record<string, string>, path = '/api/auth/callback/credentials', method = 'POST') {
  return new Request(`http://localhost:3001${path}`, {
    method,
    headers: { 'x-forwarded-for': IP, 'content-type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : new URLSearchParams(fields).toString()
  });
}

const failingStore: LoginAttemptStore = {
  increment: async () => {
    throw new Error('store down');
  },
  get: async () => {
    throw new Error('store down');
  },
  clear: async () => {
    throw new Error('store down');
  }
};

const hangingStore: LoginAttemptStore = {
  increment: () => new Promise(() => undefined),
  get: () => new Promise(() => undefined),
  clear: () => new Promise(() => undefined)
};

type Captured = { level: string; args: unknown[] };

async function captureLogs<T>(run: () => Promise<T>): Promise<{ result: T; logs: Captured[] }> {
  const logs: Captured[] = [];
  const original = { info: console.info, warn: console.warn, error: console.error };
  console.info = (...args: unknown[]) => void logs.push({ level: 'info', args });
  console.warn = (...args: unknown[]) => void logs.push({ level: 'warn', args });
  console.error = (...args: unknown[]) => void logs.push({ level: 'error', args });
  try {
    return { result: await run(), logs };
  } finally {
    Object.assign(console, original);
  }
}

test('T15 a valid hashed login returns the admin user and clears the counter', async () => {
  const store = createMemoryAttemptStore();
  const key = throttleKey(EXPECTED_USER, IP);
  await registerLoginAttempt(store, key, NOW);
  const { result } = await captureLogs(() =>
    authorizeAdmin({ username: EXPECTED_USER, password: PASSWORD }, callbackRequest({}), deps(prodEnv(), store))
  );
  assert.deepEqual(result, ADMIN_USER);
  assert.equal(await store.get(key), null);
});

test('T16 production without configuration refuses, logs the reason and leaves the store alone', async () => {
  let storeTouched = false;
  const { result, logs } = await captureLogs(() =>
    authorizeAdmin(
      { username: EXPECTED_USER, password: PASSWORD },
      callbackRequest({}),
      deps(prodEnv({ AUTH_SECRET: undefined }), async () => {
        storeTouched = true;
        return createMemoryAttemptStore();
      })
    )
  );
  assert.equal(result, null);
  assert.equal(storeTouched, false);
  const errors = logs.filter((log) => log.level === 'error');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].args[0], '[auth] login disabled');
  assert.deepEqual(errors[0].args[1], { reason: 'missing-auth-secret' });
});

test('T17 a store failure refuses in production and skips the throttle in development', async () => {
  const credentials = { username: EXPECTED_USER, password: PASSWORD };
  const prodDown = await captureLogs(() => authorizeAdmin(credentials, callbackRequest({}), deps(prodEnv(), failingStore)));
  assert.equal(prodDown.result, null);
  const prodSlow = await captureLogs(() => authorizeAdmin(credentials, callbackRequest({}), deps(prodEnv(), hangingStore, 20)));
  assert.equal(prodSlow.result, null);
  const prodNoStore = await captureLogs(() =>
    authorizeAdmin(credentials, callbackRequest({}), deps(prodEnv(), async () => {
      throw new Error('MONGODB_URI is not configured');
    }))
  );
  assert.equal(prodNoStore.result, null);

  const devDown = await captureLogs(() => authorizeAdmin(credentials, callbackRequest({}), deps(devEnv(), failingStore)));
  assert.deepEqual(devDown.result, ADMIN_USER);
  const devSlow = await captureLogs(() => authorizeAdmin(credentials, callbackRequest({}), deps(devEnv(), hangingStore, 20)));
  assert.deepEqual(devSlow.result, ADMIN_USER);
  const devWrong = await captureLogs(() =>
    authorizeAdmin({ username: EXPECTED_USER, password: 'wrong' }, callbackRequest({}), deps(devEnv(), failingStore))
  );
  assert.equal(devWrong.result, null);
});

test('T18 auth logs never carry the password, the hash or the expected username', async () => {
  const store = createMemoryAttemptStore();
  const { logs } = await captureLogs(async () => {
    for (let i = 0; i < 6; i += 1) {
      await authorizeAdmin({ username: 'intruder', password: 'guess' + i }, callbackRequest({}), deps(prodEnv(), store));
    }
    await checkCredentialsLock(callbackRequest({ username: 'intruder', password: 'guess9' }), deps(prodEnv(), store));
    await authorizeAdmin({ username: EXPECTED_USER, password: PASSWORD }, callbackRequest({}), deps(prodEnv(), store));
    // A wrong password typed with the configured username must not put that username in the log.
    await authorizeAdmin({ username: EXPECTED_USER, password: 'guess-real-user' }, callbackRequest({}), deps(prodEnv(), store));
    await authorizeAdmin({ username: EXPECTED_USER, password: PASSWORD }, callbackRequest({}), deps(prodEnv({ ADMIN_PASSWORD_HASH: undefined }), store));
    await authorizeAdmin({ username: 'intruder', password: 'guess' }, callbackRequest({}), deps(prodEnv(), failingStore));
  });
  assert.ok(logs.length >= 9, `expected logs for every outcome, got ${logs.length}`);
  const text = logs.map((log) => JSON.stringify(log.args)).join('\n');
  assert.equal(text.includes(PASSWORD), false, 'password leaked');
  assert.equal(text.includes(HASH), false, 'hash leaked');
  assert.equal(text.includes(EXPECTED_USER), false, 'expected username leaked');
  assert.equal(/guess\d?/.test(text), false, 'attempted password leaked');
  assert.equal(text.includes('expectedUsername'), false);
});

test('T19 a locked key answers the credentials callback with 429, Retry-After and one locked log', async () => {
  const store = createMemoryAttemptStore();
  const key = throttleKey('intruder', IP);
  for (let i = 0; i < 6; i += 1) await registerLoginAttempt(store, key, NOW);
  const { result, logs } = await captureLogs(() =>
    checkCredentialsLock(callbackRequest({ username: 'intruder', password: 'secret-guess', csrfToken: 'x' }), deps(prodEnv(), store))
  );
  assert.ok(result, 'expected a response');
  assert.equal(result.status, 429);
  assert.equal(result.headers.get('Retry-After'), '900');
  const body = await result.json();
  assert.equal(body.error, 'TooManyRequests');
  assert.equal(new URL(body.url).searchParams.get('error'), 'CredentialsSignin');
  assert.equal(new URL(body.url).pathname, '/api/auth/error');
  const locked = logs.filter((log) => String(log.args[0]).includes('locked'));
  assert.equal(locked.length, 1);
  assert.deepEqual(locked[0].args[1], { username: 'intruder', ip: IP });
  assert.equal(JSON.stringify(logs).includes('secret-guess'), false);
});

test('T20 the pre-check passes every other request through', async () => {
  const store = createMemoryAttemptStore();
  const fields = { username: 'intruder', password: 'x' };
  assert.equal(await checkCredentialsLock(callbackRequest(fields), deps(prodEnv(), store)), null);
  assert.equal(await checkCredentialsLock(callbackRequest(fields, '/api/auth/signout'), deps(prodEnv(), store)), null);
  assert.equal(await checkCredentialsLock(callbackRequest({}, '/api/auth/callback/credentials', 'GET'), deps(prodEnv(), store)), null);
  assert.equal(await checkCredentialsLock(callbackRequest({ password: 'x' }), deps(prodEnv(), store)), null);
  const { result } = await captureLogs(() => checkCredentialsLock(callbackRequest(fields), deps(prodEnv(), failingStore)));
  assert.equal(result, null);
});

test('T27 one IP is capped at 30 attempts across usernames, and oversized input is refused before any work', async () => {
  const store = createMemoryAttemptStore();
  const { logs } = await captureLogs(async () => {
    for (let i = 0; i < 30; i += 1) {
      assert.equal(await authorizeAdmin({ username: `rot-${i}`, password: 'x' }, callbackRequest({}), deps(prodEnv(), store)), null);
    }
    // 31st attempt, fresh username: denied by the IP key before its own key is even created.
    assert.equal(await authorizeAdmin({ username: 'rot-new', password: 'x' }, callbackRequest({}), deps(prodEnv(), store)), null);
  });
  assert.equal(await store.get(throttleKey('rot-new', IP)), null);
  const ipLocked = logs.filter((log) => String(log.args[0]).includes('locked'));
  assert.equal(ipLocked.length, 1);
  assert.deepEqual(ipLocked[0].args[1], { scope: 'ip', ip: IP });
  const precheck = await checkCredentialsLock(callbackRequest({ username: 'rot-other', password: 'x' }), deps(prodEnv(), store));
  assert.equal(precheck?.status, 429);

  let touched = false;
  const spyStore = async () => {
    touched = true;
    return createMemoryAttemptStore();
  };
  const { logs: longLogs } = await captureLogs(async () => {
    assert.equal(await authorizeAdmin({ username: 'u'.repeat(257), password: 'x' }, callbackRequest({}), deps(prodEnv(), spyStore)), null);
    assert.equal(await authorizeAdmin({ username: 'u', password: 'p'.repeat(1025) }, callbackRequest({}), deps(prodEnv(), spyStore)), null);
  });
  assert.equal(touched, false);
  // Logged usernames are capped at 64 characters with control characters removed.
  const failure = longLogs.find((log) => String(log.args[0]).includes('failure'));
  assert.ok(failure);
  const logged = (failure.args[1] as { username?: string }).username ?? '';
  assert.ok(logged.length <= 64, `logged username length ${logged.length}`);
});

test('T27 logged usernames drop control characters', async () => {
  const { logs } = await captureLogs(() =>
    authorizeAdmin({ username: 'evil\nname\u0007', password: 'x' }, callbackRequest({}), deps(prodEnv(), createMemoryAttemptStore()))
  );
  const failure = logs.find((log) => String(log.args[0]).includes('failure'));
  assert.deepEqual(failure?.args[1], { username: 'evilname', ip: IP });
});
