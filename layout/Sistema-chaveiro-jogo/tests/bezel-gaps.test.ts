import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Session } from 'next-auth';
import { createR2Client } from '../lib/r2';
import { getBezel, putBezel, type BezelStorage } from '../lib/bezel';
import { createAdminBezelHandlers, createPublicBezelHandlers } from '../lib/bezel-routes';

// 0002F SF04 gap tests (test-agent). Covers Acceptance Checklist items that tests/bezel.test.ts
// (T01-T22) does not assert: 304 closes the body without reading it, file.name is never read,
// logs carry no bytes/filenames/credentials/session data, outer-catch 500 answers, createR2Client()
// is null without R2_*, and two GET edge shapes. Fake client and injected readSession only; no
// R2_* variable is set; no route file is imported.

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const BUCKET = 'gap-bucket';
const SECRET = 'SECRET-TOKEN-9f3a';
const FILENAME = 'private-photo-name.png';
const ADMIN = {
  expires: '2099-01-01T00:00:00.000Z',
  user: { id: 'admin', role: 'admin', name: 'Admin Person', email: 'admin-person@retrokey.local' }
} as unknown as Session;

function pngBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size).fill(0x5a);
  bytes.set(PNG_SIG);
  return bytes;
}

type Cmd = { name: string; input: Record<string, unknown> };

function fakeStorage(handlers: Record<string, (input: Record<string, unknown>) => unknown> = {}) {
  const calls: Cmd[] = [];
  const storage: BezelStorage = {
    bucket: BUCKET,
    client: {
      send: (async (command: unknown) => {
        const name = (command as { constructor: { name: string } }).constructor.name;
        const input = { ...((command as { input?: Record<string, unknown> }).input ?? {}) };
        calls.push({ name, input });
        const handler = handlers[name];
        if (!handler) throw new Error(`unexpected ${name}`);
        return handler(input);
      }) as BezelStorage['client']['send']
    }
  };
  return { storage, calls };
}

type Logged = { level: 'info' | 'warn' | 'error'; args: unknown[] };

let logged: Logged[] = [];
let restore: (() => void) | null = null;

beforeEach(() => {
  logged = [];
  const original = { info: console.info, warn: console.warn, error: console.error };
  console.info = (...args: unknown[]) => void logged.push({ level: 'info', args });
  console.warn = (...args: unknown[]) => void logged.push({ level: 'warn', args });
  console.error = (...args: unknown[]) => void logged.push({ level: 'error', args });
  restore = () => Object.assign(console, original);
});

afterEach(() => {
  restore?.();
  restore = null;
});

function logText(): string {
  return JSON.stringify(
    logged.map((entry) => entry.args.map((arg) => (arg instanceof Error ? `${arg.name}: ${arg.message}` : arg)))
  );
}

function uploadRequest(id: string, bytes: Uint8Array, filename: string): Request {
  const form = new FormData();
  form.append('file', new File([bytes], filename, { type: 'image/png' }));
  return new Request(`http://localhost/api/admin/bezels/${id}`, { method: 'POST', body: form });
}

const ctx = (id: string) => ({ params: { console: id } });
const asAdmin = async () => ADMIN;

describe('bezel gaps (test-agent)', () => {
  test('GAP getBezel on an ETag match calls Body.destroy once and never transformToByteArray', async () => {
    let destroys = 0;
    let reads = 0;
    const { storage } = fakeStorage({
      GetObjectCommand: () => ({
        ETag: '"abc"',
        ContentLength: 10,
        Body: {
          destroy: () => void (destroys += 1),
          transformToByteArray: async () => {
            reads += 1;
            return new Uint8Array(10);
          }
        }
      })
    });
    assert.deepEqual(await getBezel(storage, 'nes', '"abc"'), { kind: 'not-modified', etag: '"abc"' });
    assert.equal(destroys, 1);
    assert.equal(reads, 0);
  });

  test('GAP getBezel still answers not-modified when Body.destroy throws', async () => {
    const { storage } = fakeStorage({
      GetObjectCommand: () => ({
        ETag: '"abc"',
        Body: {
          destroy: () => {
            throw new Error('close failed');
          },
          transformToByteArray: async () => new Uint8Array(1)
        }
      })
    });
    assert.deepEqual(await getBezel(storage, 'nes', '*'), { kind: 'not-modified', etag: '"abc"' });
  });

  test('GAP getBezel returns failed when the object has no readable body', async () => {
    const { storage } = fakeStorage({ GetObjectCommand: () => ({ ETag: '"abc"' }) });
    assert.deepEqual(await getBezel(storage, 'nes', null), { kind: 'failed' });
  });

  test('GAP GET without an ETag from R2 answers 200 with no ETag header; with no body answers 502 no-store', async () => {
    const bytes = pngBytes(32);
    const noEtag = fakeStorage({
      GetObjectCommand: () => ({ Body: { transformToByteArray: async () => new Uint8Array(bytes) } })
    });
    const ok = await createPublicBezelHandlers({ getStorage: () => noEtag.storage }).GET(
      new Request('http://localhost/api/bezel/nes', { headers: { 'if-none-match': '*' } }),
      ctx('nes')
    );
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('etag'), null);
    assert.equal(ok.headers.get('content-length'), '32');

    const noBody = fakeStorage({ GetObjectCommand: () => ({ ETag: '"e"' }) });
    const bad = await createPublicBezelHandlers({ getStorage: () => noBody.storage }).GET(
      new Request('http://localhost/api/bezel/nes'),
      ctx('nes')
    );
    assert.equal(bad.status, 502);
    assert.deepEqual(await bad.json(), { error: 'Storage failed' });
    assert.equal(bad.headers.get('cache-control'), 'no-store');
  });

  test('GAP POST never reads file.name', async () => {
    const reads: string[] = [];
    class SpyFile extends File {
      get name(): string {
        reads.push('name');
        throw new Error('file.name must not be read');
      }
    }
    const bytes = pngBytes(64);
    const file = new SpyFile([bytes], 'ignored.png', { type: 'image/png' });
    const request = {
      headers: new Headers({ 'content-type': 'multipart/form-data; boundary=x' }),
      formData: async () => ({ get: (field: string) => (field === 'file' ? file : null) })
    } as unknown as Request;

    const { storage, calls } = fakeStorage({ PutObjectCommand: () => ({ ETag: '"1"' }) });
    const response = await createAdminBezelHandlers({ getStorage: () => storage, readSession: asAdmin }).POST(
      request,
      ctx('snes')
    );
    assert.equal(response.status, 201);
    assert.deepEqual(reads, []);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].input.Key, 'bezels/snes.png');
  });

  test('GAP logs never carry bytes, file names, error messages, credentials or session data', async () => {
    const failing = fakeStorage({
      PutObjectCommand: () => Promise.reject(Object.assign(new Error(`denied ${SECRET}`), { name: 'AccessDenied' })),
      GetObjectCommand: () => Promise.reject(Object.assign(new Error(`denied ${SECRET}`), { name: 'AccessDenied' })),
      HeadObjectCommand: () => Promise.reject(Object.assign(new Error(`denied ${SECRET}`), { name: 'AccessDenied' }))
    });
    const admin = createAdminBezelHandlers({ getStorage: () => failing.storage, readSession: asAdmin });
    const pub = createPublicBezelHandlers({ getStorage: () => failing.storage });

    assert.equal((await admin.POST(uploadRequest('nes', pngBytes(64), FILENAME), ctx('nes'))).status, 502);
    assert.equal((await admin.POST(uploadRequest('nes', Uint8Array.from([1, 2, 3, 4]), FILENAME), ctx('nes'))).status, 415);
    assert.equal((await admin.DELETE(new Request('http://localhost/x', { method: 'DELETE' }), ctx('nes'))).status, 502);
    assert.equal((await pub.GET(new Request('http://localhost/api/bezel/nes'), ctx('nes'))).status, 502);

    const okStore = fakeStorage({ PutObjectCommand: () => ({ ETag: '"1"' }) });
    const okAdmin = createAdminBezelHandlers({ getStorage: () => okStore.storage, readSession: asAdmin });
    assert.equal((await okAdmin.POST(uploadRequest('nes', pngBytes(64), FILENAME), ctx('nes'))).status, 201);

    assert.ok(logged.length > 0, 'handlers must log');
    const text = logText();
    for (const forbidden of [SECRET, FILENAME, 'admin-person@retrokey.local', 'Admin Person', 'password', '137,80,78,71']) {
      assert.equal(text.includes(forbidden), false, `log must not contain ${forbidden}`);
    }
    for (const entry of logged) {
      for (const arg of entry.args) {
        assert.equal(arg instanceof Uint8Array, false, 'no byte array in a log');
        assert.equal(arg instanceof Error, false, 'no Error object in a log');
      }
    }
    const tags = new Set(logged.map((entry) => String(entry.args[0]).split(' ')[0]));
    for (const tag of tags) assert.ok(tag === '[bezel]' || tag === '[r2]', `unexpected log tag ${tag}`);
  });

  test('GAP putBezel failure logs the key and error.name only', async () => {
    const { storage } = fakeStorage({
      PutObjectCommand: () => Promise.reject(Object.assign(new Error(`leak ${SECRET}`), { name: 'SlowDown' }))
    });
    assert.deepEqual(await putBezel(storage, 'gba', pngBytes(16)), { kind: 'failed' });
    assert.equal(logged.length, 1);
    const text = logText();
    assert.ok(text.includes('bezels/gba.png'));
    assert.ok(text.includes('SlowDown'));
    assert.equal(text.includes(SECRET), false);
  });

  test('GAP outer catch answers 500 with the route-specific text and logs only the error name', async () => {
    const boom = () => {
      throw Object.assign(new Error(`storage lookup exploded ${SECRET}`), { name: 'ExplodeError' });
    };
    const admin = createAdminBezelHandlers({ getStorage: boom, readSession: asAdmin });
    const pub = createPublicBezelHandlers({ getStorage: boom });

    const post = await admin.POST(uploadRequest('nes', pngBytes(64), FILENAME), ctx('nes'));
    assert.equal(post.status, 500);
    assert.deepEqual(await post.json(), { error: 'Failed to save bezel' });

    const del = await admin.DELETE(new Request('http://localhost/x', { method: 'DELETE' }), ctx('nes'));
    assert.equal(del.status, 500);
    assert.deepEqual(await del.json(), { error: 'Failed to remove bezel' });

    const get = await pub.GET(new Request('http://localhost/api/bezel/nes'), ctx('nes'));
    assert.equal(get.status, 500);
    assert.deepEqual(await get.json(), { error: 'Failed to read bezel' });
    assert.equal(get.headers.get('cache-control'), 'no-store');

    const text = logText();
    assert.ok(text.includes('ExplodeError'));
    assert.equal(text.includes(SECRET), false);
    assert.equal(text.includes(FILENAME), false);
    assert.equal(logged.filter((entry) => entry.level === 'error').length, 3);
  });

  test('GAP createR2Client() is null without R2_* variables', () => {
    const r2Vars = Object.keys(process.env).filter((name) => name.startsWith('R2_'));
    assert.deepEqual(r2Vars, [], 'run this file in a shell without R2_* variables');
    assert.equal(createR2Client(), null);
  });
});
