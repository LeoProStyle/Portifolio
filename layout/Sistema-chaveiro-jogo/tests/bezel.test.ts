import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Session } from 'next-auth';
import { FRAME_STYLES } from '../lib/play-theme';

// 0002F SF04 console-bezels contract tests (plan.md Test Specification T01-T22).
// Rules: the R2 client is a fake injected through getStorage; readSession is injected on every
// admin case; no R2_* variable is set; no route file is imported (next-auth never loads).
// Each module group loads its module with a dynamic import inside its own describe, so a missing
// module fails only that group. The specifiers go through a variable so `next build` typecheck
// does not resolve them before the modules exist; the local types below mirror the exact
// signatures in plan.md "lib exports (exact signatures)".

// ---------------------------------------------------------------------------------------------
// Mirrored contract types (plan.md lib exports)

type BezelConsoleId = Exclude<(typeof FRAME_STYLES)[number], 'neutral'>;

type BezelConsoleModule = {
  BEZEL_CONSOLE_IDS: readonly BezelConsoleId[];
  isBezelConsoleId: (value: unknown) => value is BezelConsoleId;
  bezelObjectKey: (id: BezelConsoleId) => string;
  BEZEL_MAX_BYTES: number;
  BEZEL_MAX_REQUEST_BYTES: number;
  PNG_SIGNATURE: readonly number[];
  hasPngSignature: (bytes: Uint8Array) => boolean;
  BEZEL_ASPECT_TOLERANCE: number;
  isBezelAspectOff: (width: number, height: number) => boolean;
};

type BezelR2Client = { send: (command: unknown) => Promise<unknown> };
type BezelStorage = { client: BezelR2Client; bucket: string };

type BezelReadResult =
  | { kind: 'found'; body: Uint8Array; etag: string | null; contentLength: number }
  | { kind: 'not-modified'; etag: string }
  | { kind: 'missing' }
  | { kind: 'failed' };

type BezelModule = {
  isMissingObjectError: (error: unknown) => boolean;
  etagMatches: (ifNoneMatch: string | null, etag: string | null) => boolean;
  getBezelStorage: () => BezelStorage | null;
  putBezel: (
    storage: BezelStorage,
    id: BezelConsoleId,
    bytes: Uint8Array
  ) => Promise<{ kind: 'saved'; key: string } | { kind: 'failed' }>;
  getBezel: (storage: BezelStorage, id: BezelConsoleId, ifNoneMatch: string | null) => Promise<BezelReadResult>;
  deleteBezel: (
    storage: BezelStorage,
    id: BezelConsoleId
  ) => Promise<{ kind: 'deleted' } | { kind: 'missing' } | { kind: 'failed' }>;
};

type BezelRouteContext = { params: { console: string } };
type SessionReader = () => Promise<Session | null>;
type BezelRouteDeps = { getStorage: () => BezelStorage | null; readSession?: SessionReader };
type Handler = (request: Request, context: BezelRouteContext) => Promise<Response>;

type BezelRoutesModule = {
  createAdminBezelHandlers: (deps?: Partial<BezelRouteDeps>) => { POST: Handler; DELETE: Handler };
  createPublicBezelHandlers: (deps?: Partial<BezelRouteDeps>) => { GET: Handler };
};

async function loadModule<T>(specifier: string): Promise<T> {
  return (await import(specifier)) as T;
}

// ---------------------------------------------------------------------------------------------
// Fixtures

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PUBLIC_BEZELS = path.join(PUBLIC_DIR, 'bezels');
const BUCKET = 'test-bucket';
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_BYTES = 2097152;
const MAX_REQUEST_BYTES = MAX_BYTES + 65536;
const EXPECTED_IDS = FRAME_STYLES.filter((style) => style !== 'neutral') as BezelConsoleId[];

function pngBytes(size: number, fill = 0x11): Uint8Array {
  const bytes = new Uint8Array(size).fill(fill);
  bytes.set(PNG_SIG.slice(0, Math.min(size, PNG_SIG.length)));
  return bytes;
}

function sameBytes(actual: unknown, expected: Uint8Array): boolean {
  if (!(actual instanceof Uint8Array)) return false;
  return Buffer.compare(Buffer.from(actual), Buffer.from(expected)) === 0;
}

function asSession(value: unknown): Session {
  return value as Session;
}

const EXPIRES = '2099-01-01T00:00:00.000Z';
const ADMIN_SESSION = asSession({
  expires: EXPIRES,
  user: { id: 'admin', role: 'admin', name: 'Admin', email: 'admin@retrokey.local' }
});
const USER_SESSION = asSession({
  expires: EXPIRES,
  user: { id: 'u1', role: 'user', name: 'User', email: 'u@retrokey.local' }
});

const asAdmin: SessionReader = async () => ADMIN_SESSION;

type S3LikeError = Error & { $metadata?: { httpStatusCode?: number } };

function s3Error(name: string, httpStatusCode?: number): S3LikeError {
  const error = new Error(`${name} (fake)`) as S3LikeError;
  error.name = name;
  if (httpStatusCode !== undefined) error.$metadata = { httpStatusCode };
  return error;
}

// Fake BezelR2Client: records { name, input } for every command and answers per script.
// Default behaviour is an in-memory bucket, so a Put followed by a Get returns the stored bytes.
type CommandName = 'PutObjectCommand' | 'GetObjectCommand' | 'HeadObjectCommand' | 'DeleteObjectCommand';
type RecordedCommand = { name: string; input: Record<string, unknown> };
type CommandScript = Partial<Record<CommandName, (input: Record<string, unknown>) => unknown>>;

function createFakeR2(script: CommandScript = {}) {
  const calls: RecordedCommand[] = [];
  const objects = new Map<string, { bytes: Uint8Array; etag: string }>();
  const stats = { bodyReads: 0, bodyDestroys: 0 };
  let version = 0;

  function getResponse(bytes: Uint8Array, etag: string) {
    return {
      ETag: etag,
      ContentLength: bytes.length,
      ContentType: 'image/png',
      Body: {
        transformToByteArray: async () => {
          stats.bodyReads += 1;
          return new Uint8Array(bytes);
        },
        destroy: () => {
          stats.bodyDestroys += 1;
        }
      }
    };
  }

  const client: BezelR2Client = {
    async send(command: unknown) {
      const name = (command as { constructor: { name: string } }).constructor.name;
      const input = { ...((command as { input?: Record<string, unknown> }).input ?? {}) };
      calls.push({ name, input });
      const scripted = script[name as CommandName];
      if (scripted) return scripted(input);

      const key = String(input.Key);
      switch (name) {
        case 'PutObjectCommand': {
          version += 1;
          const body = input.Body;
          const bytes = body instanceof Uint8Array ? new Uint8Array(body) : new Uint8Array(0);
          const etag = `"v${version}"`;
          objects.set(key, { bytes, etag });
          return { ETag: etag };
        }
        case 'GetObjectCommand': {
          const stored = objects.get(key);
          if (!stored) throw s3Error('NoSuchKey', 404);
          return getResponse(stored.bytes, stored.etag);
        }
        case 'HeadObjectCommand': {
          const stored = objects.get(key);
          if (!stored) throw s3Error('NotFound', 404);
          return { ETag: stored.etag, ContentLength: stored.bytes.length };
        }
        case 'DeleteObjectCommand': {
          objects.delete(key);
          return {};
        }
        default:
          throw new Error(`unexpected command ${name}`);
      }
    }
  };

  function seed(key: string, bytes: Uint8Array, etag: string) {
    objects.set(key, { bytes, etag });
  }

  return { client, calls, objects, stats, seed, storage: { client, bucket: BUCKET } as BezelStorage };
}

function ctx(id: string): BezelRouteContext {
  return { params: { console: id } };
}

function uploadRequest(id: string, bytes: Uint8Array, filename = 'bezel.png'): Request {
  const form = new FormData();
  form.append('file', new File([bytes], filename, { type: 'image/png' }));
  return new Request(`http://localhost/api/admin/bezels/${id}`, { method: 'POST', body: form });
}

function deleteRequest(id: string): Request {
  return new Request(`http://localhost/api/admin/bezels/${id}`, { method: 'DELETE' });
}

function getRequest(id: string, ifNoneMatch?: string): Request {
  const headers = ifNoneMatch === undefined ? undefined : { 'if-none-match': ifNoneMatch };
  return new Request(`http://localhost/api/bezel/${id}`, { method: 'GET', headers });
}

async function assertJsonError(response: Response, status: number, error: string) {
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { error });
}

function puts(calls: RecordedCommand[]) {
  return calls.filter((call) => call.name === 'PutObjectCommand');
}

function publicSnapshot(): string[] {
  return existsSync(PUBLIC_DIR) ? readdirSync(PUBLIC_DIR, { recursive: true }).map(String).sort() : [];
}

// Route handlers log [bezel]/[r2]/[auth] lines; keep the test output readable.
function muteLogs() {
  const original = { info: console.info, warn: console.warn, error: console.error };
  before(() => {
    console.info = () => {};
    console.warn = () => {};
    console.error = () => {};
  });
  after(() => {
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
  });
}

// ---------------------------------------------------------------------------------------------
// Group 1: lib/bezel-console.ts (pure)

describe('bezel-console', () => {
  let mod: BezelConsoleModule;
  before(async () => {
    mod = await loadModule<BezelConsoleModule>('../lib/bezel-console');
  });

  test('T01 backend-RF02-key-per-console-id: 12 ids = FRAME_STYLES minus neutral, key bezels/<id>.png', () => {
    assert.deepEqual([...mod.BEZEL_CONSOLE_IDS], EXPECTED_IDS);
    assert.equal(mod.BEZEL_CONSOLE_IDS.length, 12);
    assert.deepEqual(
      mod.BEZEL_CONSOLE_IDS.map((id) => mod.bezelObjectKey(id)),
      EXPECTED_IDS.map((id) => `bezels/${id}.png`)
    );
    for (const id of EXPECTED_IDS) assert.equal(mod.isBezelConsoleId(id), true, id);
  });

  test('T10 backend-RN02-png-at-2mb-accepted-name-ignored: hasPngSignature(signature+data) is true', () => {
    assert.deepEqual([...mod.PNG_SIGNATURE], PNG_SIG);
    assert.equal(mod.hasPngSignature(pngBytes(MAX_BYTES)), true);
    assert.equal(mod.hasPngSignature(Uint8Array.from(PNG_SIG)), true);
  });

  test('T11 backend-RN02-not-png-415: hasPngSignature is false for JPEG, 7 bytes and a changed byte', () => {
    assert.equal(mod.hasPngSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49])), false);
    assert.equal(mod.hasPngSignature(Uint8Array.from(PNG_SIG.slice(0, 7))), false);
    const changed = pngBytes(64);
    changed[3] = 0x00;
    assert.equal(mod.hasPngSignature(changed), false);
    assert.equal(mod.hasPngSignature(new Uint8Array(0)), false);
  });

  test('T12 backend-RN02-over-limit-413: size limits are 2 MB and 2 MB + 64 KB multipart overhead', () => {
    assert.equal(mod.BEZEL_MAX_BYTES, MAX_BYTES);
    assert.equal(mod.BEZEL_MAX_REQUEST_BYTES, MAX_REQUEST_BYTES);
  });

  test('T13 backend-RN02-id-outside-list-404: isBezelConsoleId refuses ids outside the closed list', () => {
    for (const value of ['neutral', 'NES', '../roms/x', '', ' nes', 'nes.png', undefined, null, 1, {}]) {
      assert.equal(mod.isBezelConsoleId(value), false, String(value));
    }
  });

  test('T21 backend-RN06-aspect-within-tolerance: 1920x1080, 1600x900, 1280x722 are not off', () => {
    assert.equal(mod.BEZEL_ASPECT_TOLERANCE, 0.02);
    assert.equal(mod.isBezelAspectOff(1920, 1080), false);
    assert.equal(mod.isBezelAspectOff(1600, 900), false);
    assert.equal(mod.isBezelAspectOff(1280, 722), false);
  });

  test('T22 backend-RN06-aspect-outside-tolerance: 1024x768, 1920x1100, 1080x1920 are off', () => {
    assert.equal(mod.isBezelAspectOff(1024, 768), true);
    assert.equal(mod.isBezelAspectOff(1920, 1100), true);
    assert.equal(mod.isBezelAspectOff(1080, 1920), true);
  });
});

// ---------------------------------------------------------------------------------------------
// Group 2: lib/bezel.ts (storage seam over an injected fake client; never throws)

describe('bezel', () => {
  let mod: BezelModule;
  muteLogs();
  before(async () => {
    mod = await loadModule<BezelModule>('../lib/bezel');
  });

  test('T16 backend-RN03-no-storage-503: getBezelStorage() is null in a shell without R2_* variables', () => {
    const r2Vars = Object.keys(process.env).filter((name) => name.startsWith('R2_'));
    assert.deepEqual(r2Vars, [], 'run this file in a shell without R2_* variables');
    assert.equal(mod.getBezelStorage(), null);
  });

  test('T02 backend-RF02-upload-stores-png-201: putBezel sends one PutObject with key, bucket, image/png and bytes', async () => {
    const fake = createFakeR2();
    const bytes = pngBytes(1024);
    assert.deepEqual(await mod.putBezel(fake.storage, 'nes', bytes), { kind: 'saved', key: 'bezels/nes.png' });
    assert.equal(fake.calls.length, 1);
    const [put] = fake.calls;
    assert.equal(put.name, 'PutObjectCommand');
    assert.equal(put.input.Bucket, BUCKET);
    assert.equal(put.input.Key, 'bezels/nes.png');
    assert.equal(put.input.ContentType, 'image/png');
    assert.ok(sameBytes(put.input.Body, bytes));
  });

  test('T17 backend-RN03-r2-failure-502: putBezel and deleteBezel map SDK errors to failed without throwing', async () => {
    const putFails = createFakeR2({ PutObjectCommand: () => Promise.reject(s3Error('InternalError', 500)) });
    assert.deepEqual(await mod.putBezel(putFails.storage, 'nes', pngBytes(64)), { kind: 'failed' });

    const headFails = createFakeR2({ HeadObjectCommand: () => Promise.reject(s3Error('AccessDenied', 403)) });
    assert.deepEqual(await mod.deleteBezel(headFails.storage, 'gba'), { kind: 'failed' });
    assert.deepEqual(headFails.calls.map((c) => c.name), ['HeadObjectCommand']);

    const deleteFails = createFakeR2({ DeleteObjectCommand: () => Promise.reject(s3Error('InternalError', 500)) });
    deleteFails.seed('bezels/gba.png', pngBytes(64), '"e1"');
    assert.deepEqual(await mod.deleteBezel(deleteFails.storage, 'gba'), { kind: 'failed' });
  });

  test('T05 backend-RF01-delete-existing-204: deleteBezel sends HeadObject then DeleteObject on bezels/gba.png', async () => {
    const fake = createFakeR2();
    fake.seed('bezels/gba.png', pngBytes(64), '"e1"');
    assert.deepEqual(await mod.deleteBezel(fake.storage, 'gba'), { kind: 'deleted' });
    assert.deepEqual(fake.calls.map((c) => [c.name, c.input.Key, c.input.Bucket]), [
      ['HeadObjectCommand', 'bezels/gba.png', BUCKET],
      ['DeleteObjectCommand', 'bezels/gba.png', BUCKET]
    ]);
  });

  test('T06 backend-RF01-delete-missing-404: deleteBezel returns missing when HeadObject says NotFound', async () => {
    const fake = createFakeR2();
    assert.deepEqual(await mod.deleteBezel(fake.storage, 'gba'), { kind: 'missing' });
    assert.deepEqual(fake.calls.map((c) => c.name), ['HeadObjectCommand']);
  });

  test('T18 backend-RN05-etag-match-304: etagMatches handles exact, W/, *, lists and null', () => {
    assert.equal(mod.etagMatches('"abc"', '"abc"'), true);
    assert.equal(mod.etagMatches('W/"abc"', '"abc"'), true);
    assert.equal(mod.etagMatches('"abc"', 'W/"abc"'), true);
    assert.equal(mod.etagMatches('*', '"abc"'), true);
    assert.equal(mod.etagMatches('"x", "abc"', '"abc"'), true);
    assert.equal(mod.etagMatches('"x",W/"abc"', '"abc"'), true);
    assert.equal(mod.etagMatches('"zzz"', '"abc"'), false);
    assert.equal(mod.etagMatches(null, '"abc"'), false);
    assert.equal(mod.etagMatches('"abc"', null), false);
    assert.equal(mod.etagMatches('*', null), false);
  });

  test('T18 backend-RN05-etag-match-304: getBezel returns not-modified without reading the body', async () => {
    const fake = createFakeR2();
    fake.seed('bezels/snes.png', pngBytes(256), '"abc"');
    assert.deepEqual(await mod.getBezel(fake.storage, 'snes', '"abc"'), { kind: 'not-modified', etag: '"abc"' });
    assert.equal(fake.stats.bodyReads, 0);
    assert.deepEqual(fake.calls.map((c) => c.name), ['GetObjectCommand']);

    const found = await mod.getBezel(fake.storage, 'snes', '"zzz"');
    assert.equal(found.kind, 'found');
    if (found.kind !== 'found') return;
    assert.ok(sameBytes(found.body, pngBytes(256)));
    assert.equal(found.etag, '"abc"');
    assert.equal(found.contentLength, 256);
  });

  test('T19 backend-RN05-missing-404-no-store: isMissingObjectError accepts NoSuchKey, NotFound and httpStatusCode 404', async () => {
    assert.equal(mod.isMissingObjectError(s3Error('NoSuchKey')), true);
    assert.equal(mod.isMissingObjectError(s3Error('NotFound')), true);
    assert.equal(mod.isMissingObjectError(s3Error('UnknownError', 404)), true);
    assert.equal(mod.isMissingObjectError({ name: 'NoSuchKey' }), true);
    assert.equal(mod.isMissingObjectError(s3Error('AccessDenied', 403)), false);
    assert.equal(mod.isMissingObjectError(new Error('boom')), false);
    assert.equal(mod.isMissingObjectError(null), false);
    assert.equal(mod.isMissingObjectError(undefined), false);

    for (const error of [s3Error('NoSuchKey'), s3Error('NotFound'), s3Error('UnknownError', 404)]) {
      const fake = createFakeR2({ GetObjectCommand: () => Promise.reject(error) });
      assert.deepEqual(await mod.getBezel(fake.storage, 'nes', null), { kind: 'missing' }, error.name);
    }
  });

  test('T20 backend-RN05-r2-failure-502-no-store: getBezel maps AccessDenied to failed', async () => {
    const fake = createFakeR2({ GetObjectCommand: () => Promise.reject(s3Error('AccessDenied', 403)) });
    assert.deepEqual(await mod.getBezel(fake.storage, 'nes', null), { kind: 'failed' });
  });
});

// ---------------------------------------------------------------------------------------------
// Group 3: lib/bezel-routes.ts (handler factories; fake storage + injected readSession)

describe('bezel-routes', () => {
  let mod: BezelRoutesModule;
  muteLogs();
  before(async () => {
    mod = await loadModule<BezelRoutesModule>('../lib/bezel-routes');
  });

  function adminHandlers(storage: BezelStorage | null, readSession: SessionReader = asAdmin) {
    return mod.createAdminBezelHandlers({ getStorage: () => storage, readSession });
  }

  function publicHandlers(storage: BezelStorage | null, readSession?: SessionReader) {
    return mod.createPublicBezelHandlers(readSession ? { getStorage: () => storage, readSession } : { getStorage: () => storage });
  }

  test('T02 backend-RF02-upload-stores-png-201: POST nes with a 1 KB PNG stores it and answers 201', async () => {
    const fake = createFakeR2();
    const bytes = pngBytes(1024);
    const response = await adminHandlers(fake.storage).POST(uploadRequest('nes', bytes), ctx('nes'));
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { console: 'nes', key: 'bezels/nes.png' });
    const put = puts(fake.calls);
    assert.equal(put.length, 1);
    assert.equal(fake.calls.length, 1);
    assert.equal(put[0].input.Key, 'bezels/nes.png');
    assert.equal(put[0].input.Bucket, BUCKET);
    assert.equal(put[0].input.ContentType, 'image/png');
    assert.ok(sameBytes(put[0].input.Body, bytes));
  });

  test('T03 backend-RF02-reupload-replaces-same-key: second upload replaces the first under the same key', async () => {
    const fake = createFakeR2();
    const admin = adminHandlers(fake.storage);
    const bytesA = pngBytes(512, 0xaa);
    const bytesB = pngBytes(768, 0xbb);
    assert.equal((await admin.POST(uploadRequest('nes', bytesA), ctx('nes'))).status, 201);
    assert.equal((await admin.POST(uploadRequest('nes', bytesB), ctx('nes'))).status, 201);
    const put = puts(fake.calls);
    assert.equal(put.length, 2);
    assert.equal(put[0].input.Key, 'bezels/nes.png');
    assert.equal(put[1].input.Key, put[0].input.Key);

    const response = await publicHandlers(fake.storage).GET(getRequest('nes'), ctx('nes'));
    assert.equal(response.status, 200);
    assert.ok(sameBytes(new Uint8Array(await response.arrayBuffer()), bytesB));
  });

  test('T04 backend-RF03-public-get-returns-png: GET snes answers 200 PNG with cache and safety headers', async () => {
    const fake = createFakeR2();
    const bytes = pngBytes(2048, 0x42);
    fake.seed('bezels/snes.png', bytes, '"snes-etag"');
    const response = await publicHandlers(fake.storage).GET(getRequest('snes'), ctx('snes'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    assert.equal(response.headers.get('etag'), '"snes-etag"');
    assert.equal(response.headers.get('content-length'), String(bytes.length));
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(sameBytes(new Uint8Array(await response.arrayBuffer()), bytes));
    assert.deepEqual(fake.calls.map((c) => [c.name, c.input.Key, c.input.Bucket]), [
      ['GetObjectCommand', 'bezels/snes.png', BUCKET]
    ]);
  });

  test('T05 backend-RF01-delete-existing-204: DELETE gba with an existing object answers 204 with empty body', async () => {
    const fake = createFakeR2();
    fake.seed('bezels/gba.png', pngBytes(64), '"e1"');
    const response = await adminHandlers(fake.storage).DELETE(deleteRequest('gba'), ctx('gba'));
    assert.equal(response.status, 204);
    assert.equal((await response.arrayBuffer()).byteLength, 0);
    assert.deepEqual(fake.calls.map((c) => [c.name, c.input.Key]), [
      ['HeadObjectCommand', 'bezels/gba.png'],
      ['DeleteObjectCommand', 'bezels/gba.png']
    ]);
  });

  test('T06 backend-RF01-delete-missing-404: DELETE gba when HeadObject throws NotFound answers 404', async () => {
    const fake = createFakeR2({ HeadObjectCommand: () => Promise.reject(s3Error('NotFound', 404)) });
    const response = await adminHandlers(fake.storage).DELETE(deleteRequest('gba'), ctx('gba'));
    await assertJsonError(response, 404, 'No bezel for this console');
    assert.equal(fake.calls.filter((c) => c.name === 'DeleteObjectCommand').length, 0);
  });

  test('T07 backend-RN01-public-read-needs-no-session: GET never calls readSession', async () => {
    const fake = createFakeR2();
    fake.seed('bezels/nes.png', pngBytes(128), '"e1"');
    let sessionReads = 0;
    const throwingReader: SessionReader = async () => {
      sessionReads += 1;
      throw new Error('readSession must not be called on a public read');
    };
    const response = await publicHandlers(fake.storage, throwingReader).GET(getRequest('nes'), ctx('nes'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(sessionReads, 0);
  });

  test('T08 backend-RN01-no-session-401: POST and DELETE without a session answer 401 and send no command', async () => {
    const fake = createFakeR2();
    const admin = adminHandlers(fake.storage, async () => null);
    await assertJsonError(await admin.POST(uploadRequest('nes', pngBytes(64)), ctx('nes')), 401, 'Unauthorized');
    await assertJsonError(await admin.DELETE(deleteRequest('nes'), ctx('nes')), 401, 'Unauthorized');
    assert.equal(fake.calls.length, 0);
  });

  test('T09 backend-RN01-non-admin-403: POST and DELETE with a user session answer 403 and send no command', async () => {
    const fake = createFakeR2();
    const admin = adminHandlers(fake.storage, async () => USER_SESSION);
    await assertJsonError(await admin.POST(uploadRequest('nes', pngBytes(64)), ctx('nes')), 403, 'Forbidden');
    await assertJsonError(await admin.DELETE(deleteRequest('nes'), ctx('nes')), 403, 'Forbidden');
    assert.equal(fake.calls.length, 0);
  });

  test('T10 backend-RN02-png-at-2mb-accepted-name-ignored: exactly 2097152 bytes named ../../evil.jpg goes to bezels/nes.png', async () => {
    const fake = createFakeR2();
    const bytes = pngBytes(MAX_BYTES);
    const response = await adminHandlers(fake.storage).POST(uploadRequest('nes', bytes, '../../evil.jpg'), ctx('nes'));
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { console: 'nes', key: 'bezels/nes.png' });
    const put = puts(fake.calls);
    assert.equal(put.length, 1);
    assert.equal(put[0].input.Key, 'bezels/nes.png');
    assert.ok(!JSON.stringify(put[0].input.Key).includes('evil'));
    assert.ok(sameBytes(put[0].input.Body, bytes));
  });

  test('T11 backend-RN02-not-png-415: JPEG bytes, a 7-byte file and a PNG with byte 3 changed answer 415', async () => {
    const changed = pngBytes(256);
    changed[3] = 0x00;
    const inputs: [string, Uint8Array][] = [
      ['jpeg', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])],
      ['7 bytes', Uint8Array.from(PNG_SIG.slice(0, 7))],
      ['byte 3 changed', changed]
    ];
    for (const [label, bytes] of inputs) {
      const fake = createFakeR2();
      const response = await adminHandlers(fake.storage).POST(uploadRequest('nes', bytes), ctx('nes'));
      assert.equal(response.status, 415, label);
      assert.deepEqual(await response.json(), { error: 'File is not a PNG' }, label);
      assert.equal(puts(fake.calls).length, 0, label);
    }
  });

  test('T12 backend-RN02-over-limit-413: a 2097153-byte file answers 413 and is not stored', async () => {
    const fake = createFakeR2();
    const response = await adminHandlers(fake.storage).POST(uploadRequest('nes', pngBytes(MAX_BYTES + 1)), ctx('nes'));
    await assertJsonError(response, 413, 'File is over 2 MB');
    assert.equal(puts(fake.calls).length, 0);
  });

  test('T12 backend-RN02-over-limit-413: Content-Length over BEZEL_MAX_REQUEST_BYTES answers 413 before reading the body', async () => {
    const fake = createFakeR2();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(16));
        controller.close();
      }
    });
    const request = new Request('http://localhost/api/admin/bezels/nes', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=----bezel-test',
        'content-length': String(MAX_REQUEST_BYTES + 1)
      },
      body,
      duplex: 'half'
    } as RequestInit & { duplex: 'half' });
    const response = await adminHandlers(fake.storage).POST(request, ctx('nes'));
    await assertJsonError(response, 413, 'File is over 2 MB');
    assert.equal(pulls, 0, 'body stream must never be read');
    assert.equal(request.bodyUsed, false);
    assert.equal(fake.calls.length, 0);
  });

  test('T13 backend-RN02-id-outside-list-404: POST and DELETE on neutral, NES, ../roms/x and empty id answer 404', async () => {
    for (const id of ['neutral', 'NES', '../roms/x', '']) {
      const fake = createFakeR2();
      const admin = adminHandlers(fake.storage);
      const post = await admin.POST(uploadRequest(encodeURIComponent(id), pngBytes(64)), ctx(id));
      assert.equal(post.status, 404, `POST ${JSON.stringify(id)}`);
      assert.deepEqual(await post.json(), { error: 'Unknown console' });
      const del = await admin.DELETE(deleteRequest(encodeURIComponent(id)), ctx(id));
      assert.equal(del.status, 404, `DELETE ${JSON.stringify(id)}`);
      assert.deepEqual(await del.json(), { error: 'Unknown console' });
      assert.equal(fake.calls.length, 0, `no command for ${JSON.stringify(id)}`);
    }
  });

  test('T14 backend-RN02-no-file-400: missing field, empty file, JSON body and broken multipart answer 400', async () => {
    const noFileForm = new FormData();
    noFileForm.append('other', 'value');
    const emptyFileForm = new FormData();
    emptyFileForm.append('file', new File([], 'empty.png', { type: 'image/png' }));
    const url = 'http://localhost/api/admin/bezels/nes';
    const requests: [string, Request][] = [
      ['no file field', new Request(url, { method: 'POST', body: noFileForm })],
      ['0-byte file', new Request(url, { method: 'POST', body: emptyFileForm })],
      [
        'JSON content-type',
        new Request(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ file: 'iVBORw0KGgo=' })
        })
      ],
      [
        'broken multipart',
        new Request(url, {
          method: 'POST',
          headers: { 'content-type': 'multipart/form-data; boundary=----bezel-test' },
          body: 'this is not a multipart body'
        })
      ]
    ];
    for (const [label, request] of requests) {
      const fake = createFakeR2();
      const response = await adminHandlers(fake.storage).POST(request, ctx('nes'));
      assert.equal(response.status, 400, label);
      assert.deepEqual(await response.json(), { error: 'No file' }, label);
      assert.equal(puts(fake.calls).length, 0, label);
    }
  });

  test('T15 backend-RN03-write-goes-only-to-r2: upload writes exactly one Put and nothing under public/ or MongoDB', async () => {
    assert.equal(existsSync(PUBLIC_BEZELS), false, 'public/bezels absent before');
    const before = publicSnapshot();
    const fake = createFakeR2();
    const response = await adminHandlers(fake.storage).POST(uploadRequest('nes', pngBytes(1024)), ctx('nes'));
    assert.equal(response.status, 201);
    assert.equal(fake.calls.length, 1);
    assert.equal(puts(fake.calls).length, 1);
    assert.equal(existsSync(PUBLIC_BEZELS), false, 'public/bezels absent after');
    assert.deepEqual(publicSnapshot(), before);
    for (const file of ['lib/bezel-console.ts', 'lib/bezel.ts', 'lib/bezel-routes.ts']) {
      const source = readFileSync(path.join(ROOT, file), 'utf8');
      assert.doesNotMatch(source, /lib\/mongo|from ['"]mongodb['"]/, `${file} must not depend on MongoDB`);
    }
  });

  test('T16 backend-RN03-no-storage-503: POST and DELETE without storage answer 503', async () => {
    assert.equal(existsSync(PUBLIC_BEZELS), false, 'public/bezels absent before');
    const admin = adminHandlers(null);
    await assertJsonError(
      await admin.POST(uploadRequest('nes', pngBytes(1024)), ctx('nes')),
      503,
      'Storage is not configured'
    );
    await assertJsonError(await admin.DELETE(deleteRequest('nes'), ctx('nes')), 503, 'Storage is not configured');
    assert.equal(existsSync(PUBLIC_BEZELS), false, 'public/bezels absent after');
  });

  test('T17 backend-RN03-r2-failure-502: Put, Head and Delete failures answer 502 and write nothing to public/', async () => {
    assert.equal(existsSync(PUBLIC_BEZELS), false, 'public/bezels absent before');
    const before = publicSnapshot();

    const putFails = createFakeR2({ PutObjectCommand: () => Promise.reject(s3Error('InternalError', 500)) });
    await assertJsonError(
      await adminHandlers(putFails.storage).POST(uploadRequest('nes', pngBytes(1024)), ctx('nes')),
      502,
      'Storage failed'
    );

    const headFails = createFakeR2({ HeadObjectCommand: () => Promise.reject(s3Error('AccessDenied', 403)) });
    await assertJsonError(await adminHandlers(headFails.storage).DELETE(deleteRequest('nes'), ctx('nes')), 502, 'Storage failed');
    assert.equal(headFails.calls.filter((c) => c.name === 'DeleteObjectCommand').length, 0);

    const deleteFails = createFakeR2({ DeleteObjectCommand: () => Promise.reject(s3Error('InternalError', 500)) });
    deleteFails.seed('bezels/nes.png', pngBytes(64), '"e1"');
    await assertJsonError(
      await adminHandlers(deleteFails.storage).DELETE(deleteRequest('nes'), ctx('nes')),
      502,
      'Storage failed'
    );

    assert.equal(existsSync(PUBLIC_BEZELS), false, 'public/bezels absent after');
    assert.deepEqual(publicSnapshot(), before);
  });

  test('T18 backend-RN05-etag-match-304: matching If-None-Match answers 304 with ETag and no-cache, mismatch answers 200', async () => {
    const bytes = pngBytes(512, 0x33);
    for (const header of ['"abc123"', 'W/"abc123"', '*', '"other", "abc123"']) {
      const fake = createFakeR2();
      fake.seed('bezels/snes.png', bytes, '"abc123"');
      const response = await publicHandlers(fake.storage).GET(getRequest('snes', header), ctx('snes'));
      assert.equal(response.status, 304, header);
      assert.equal((await response.arrayBuffer()).byteLength, 0, header);
      assert.equal(response.headers.get('etag'), '"abc123"', header);
      assert.equal(response.headers.get('cache-control'), 'no-cache', header);
      assert.equal(fake.stats.bodyReads, 0, `${header}: body not read`);
    }

    const fake = createFakeR2();
    fake.seed('bezels/snes.png', bytes, '"abc123"');
    const response = await publicHandlers(fake.storage).GET(getRequest('snes', '"different"'), ctx('snes'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.headers.get('etag'), '"abc123"');
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    assert.ok(sameBytes(new Uint8Array(await response.arrayBuffer()), bytes));
  });

  test('T19 backend-RN05-missing-404-no-store: NoSuchKey, NotFound, httpStatusCode 404, no storage and neutral give the same 404', async () => {
    const cases: [string, BezelStorage | null, string][] = [
      ['NoSuchKey', createFakeR2({ GetObjectCommand: () => Promise.reject(s3Error('NoSuchKey')) }).storage, 'nes'],
      ['NotFound', createFakeR2({ GetObjectCommand: () => Promise.reject(s3Error('NotFound')) }).storage, 'nes'],
      ['$metadata 404', createFakeR2({ GetObjectCommand: () => Promise.reject(s3Error('UnknownError', 404)) }).storage, 'nes'],
      ['no storage', null, 'nes'],
      ['neutral', createFakeR2().storage, 'neutral']
    ];
    const bodies = new Set<string>();
    for (const [label, storage, id] of cases) {
      const response = await publicHandlers(storage).GET(getRequest(id), ctx(id));
      assert.equal(response.status, 404, label);
      assert.equal(response.headers.get('cache-control'), 'no-store', label);
      const text = await response.text();
      assert.deepEqual(JSON.parse(text), { error: 'Bezel not found' }, label);
      bodies.add(text);
    }
    assert.equal(bodies.size, 1, 'identical body for every missing case');
  });

  test('T20 backend-RN05-r2-failure-502-no-store: GetObject AccessDenied answers 502 no-store, not 404', async () => {
    const fake = createFakeR2({ GetObjectCommand: () => Promise.reject(s3Error('AccessDenied', 403)) });
    const response = await publicHandlers(fake.storage).GET(getRequest('nes'), ctx('nes'));
    assert.notEqual(response.status, 404);
    await assertJsonError(response, 502, 'Storage failed');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});
