import { expect, request as pwRequest, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { deflateSync } from 'node:zlib';

// SF01 admin-api-guard contract spec (RED-first: guard/middleware/panel land in tasks.md T06-T12).
// Credentials come from ADMIN_USERNAME / ADMIN_PASSWORD (loaded from .env.local by playwright.config.ts).

const PREFIX = 'e2e-sf01-';
const USERNAME = process.env.ADMIN_USERNAME ?? '';
const PASSWORD = process.env.ADMIN_PASSWORD ?? '';
if (!USERNAME || !PASSWORD) {
  throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set (.env.local) to run the admin E2E spec.');
}
const LOGIN_URL_RE = /\/login\?callbackUrl=(\/admin|%2Fadmin)$/;

function uid() {
  return `${PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function baseURLOf(testInfo: { project: { use: { baseURL?: string } } }) {
  return testInfo.project.use.baseURL as string;
}

async function newApi(baseURL: string): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL });
}

/** Signs in through the NextAuth credentials endpoints; the context keeps the session cookie. */
async function loginAdminApi(api: APIRequestContext) {
  const csrfRes = await api.get('/api/auth/csrf');
  const { csrfToken } = await csrfRes.json();
  const res = await api.post('/api/auth/callback/credentials', {
    form: { csrfToken, username: USERNAME, password: PASSWORD, json: 'true' }
  });
  const session = await (await api.get('/api/auth/session')).json();
  if (!res.ok() || !session?.user) {
    throw new Error(`Admin login failed (callback status ${res.status()}, session present: ${Boolean(session?.user)})`);
  }
}

async function adminApi(baseURL: string) {
  const api = await newApi(baseURL);
  await loginAdminApi(api);
  return api;
}

async function loginAdminUi(page: Page) {
  // The dev server can recompile during the first login and drop the CSRF cookie (MissingCSRF);
  // wait for the page to settle and retry the login once.
  for (let attempt = 1; ; attempt++) {
    await page.goto('/login?callbackUrl=/admin');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Usuário').fill(USERNAME);
    await page.getByPlaceholder('Senha').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    try {
      await page.waitForURL('**/admin', { timeout: 20_000 });
      break;
    } catch (error) {
      // Clear the fields so the failure snapshot (test-results/**/error-context.md) never records the credentials.
      await page.getByPlaceholder('Usuário').fill('').catch(() => {});
      await page.getByPlaceholder('Senha').fill('').catch(() => {});
      if (attempt >= 2) throw error;
    }
  }
  // First hit compiles /admin in dev; wait for the gate to resolve before the test acts.
  await expect(page.getByRole('heading', { name: 'Manage RetroKey' })).toBeVisible({ timeout: 45_000 });
}

type Item = { id: string; [k: string]: unknown };

async function listOf(admin: APIRequestContext, path: 'games' | 'cartridges'): Promise<Item[]> {
  const res = await admin.get(`/api/admin/${path}`);
  expect(res.status(), `admin GET /api/admin/${path}`).toBe(200);
  return res.json();
}

function snapshot(items: Item[]) {
  return JSON.stringify(items.map((i) => i.id).sort());
}

/** Cartridges need MongoDB (no in-memory fallback); null when the backend answers non-200 (e.g. DB unreachable). */
async function cartridgesOrNull(admin: APIRequestContext): Promise<Item[] | null> {
  const res = await admin.get('/api/admin/cartridges');
  return res.status() === 200 ? res.json() : null;
}

async function createGame(admin: APIRequestContext, slug: string) {
  const res = await admin.post('/api/admin/games', {
    data: { title: `Title ${slug}`, system: 'nes', console: 'nes', slug, description: 'sf01 e2e', romPath: '' }
  });
  expect(res.status(), 'admin POST game').toBe(201);
  const created = (await listOf(admin, 'games')).find((g) => g.slug === slug);
  expect(created, 'created game visible in admin list').toBeTruthy();
  return created as Item;
}

async function createCartridge(admin: APIRequestContext, nfcId: string, gameId: string) {
  const res = await admin.post('/api/admin/cartridges', {
    data: { nfcId, gameId, collectionNumber: 1, status: 'active' }
  });
  expect(res.status(), 'admin POST cartridge').toBe(201);
  const created = (await listOf(admin, 'cartridges')).find((c) => c.nfcId === nfcId);
  expect(created, 'created cartridge visible in admin list').toBeTruthy();
  return created as Item;
}

/** Removes every record this spec may have created (also covers anonymous writes that slipped through). */
async function cleanup(baseURL: string) {
  const admin = await adminApi(baseURL);
  try {
    for (const c of (await cartridgesOrNull(admin)) ?? []) {
      if (String(c.nfcId ?? '').startsWith(PREFIX)) await admin.delete(`/api/admin/cartridges/${c.id}`);
    }
    for (const g of await listOf(admin, 'games')) {
      if (String(g.slug ?? '').startsWith(PREFIX)) await admin.delete(`/api/admin/games/${g.id}`);
    }
  } finally {
    await admin.dispose();
  }
}

// Dev server compiles each route on first hit; a compile in the middle of a login can drop the CSRF cookie.
// Warm the routes once per project so the tests act on compiled routes.
test.beforeAll(async ({}, testInfo) => {
  test.setTimeout(180_000);
  const api = await newApi(baseURLOf(testInfo));
  try {
    for (const path of ['/login', '/admin', '/api/auth/csrf', '/api/auth/session', '/api/admin/games', '/api/admin/games/warmup', '/api/admin/cartridges', '/api/admin/cartridges/warmup']) {
      await api.get(path, { maxRedirects: 0, timeout: 120_000 }).catch(() => {});
    }
  } finally {
    await api.dispose();
  }
});

test.beforeEach(async ({}, testInfo) => {
  const isNoMongo = testInfo.project.name === 'no-mongo';
  const isT17 = testInfo.title.startsWith('T17');
  test.skip(isNoMongo !== isT17, isT17 ? 'T17 runs only in the no-mongo project' : 'runs only in the main project');
});

test.describe('main project', () => {
  test('T03 all 10 admin routes deny anonymous calls and the catalog is unchanged', async ({}, testInfo) => {
    const baseURL = baseURLOf(testInfo);
    const admin = await adminApi(baseURL);
    const anon = await newApi(baseURL);
    const slug = uid();
    try {
      const game = await createGame(admin, slug);
      const cartsUp = (await cartridgesOrNull(admin)) !== null;
      if (!cartsUp) {
        testInfo.annotations.push({
          type: 'warning',
          description: 'cartridge catalog comparison skipped: /api/admin/cartridges did not answer 200 (backend unavailable)'
        });
        expect(process.env.CI, 'cartridge backend must be reachable in CI').toBeFalsy();
      }
      const cart: Item = cartsUp ? await createCartridge(admin, slug, game.id) : { id: `${slug}-no-db` };
      const beforeGames = snapshot(await listOf(admin, 'games'));
      const beforeCarts = cartsUp ? snapshot((await cartridgesOrNull(admin)) ?? []) : null;

      const body = { title: `anon ${slug}`, system: 'nes', slug: `${slug}-anon`, nfcId: `${slug}-anon`, gameId: game.id };
      const calls: Array<[string, string, unknown?]> = [
        ['GET', '/api/admin/games'],
        ['POST', '/api/admin/games', body],
        ['GET', `/api/admin/games/${game.id}`],
        ['PUT', `/api/admin/games/${game.id}`, { ...body, title: 'hijacked' }],
        ['DELETE', `/api/admin/games/${game.id}`],
        ['GET', '/api/admin/cartridges'],
        ['POST', '/api/admin/cartridges', body],
        ['GET', `/api/admin/cartridges/${cart.id}`],
        ['PUT', `/api/admin/cartridges/${cart.id}`, { ...body, status: 'hijacked' }],
        ['DELETE', `/api/admin/cartridges/${cart.id}`]
      ];

      const failures: string[] = [];
      for (const [method, path, data] of calls) {
        const res = await anon.fetch(path, { method, data: data as object | undefined, maxRedirects: 0 });
        const text = await res.text();
        let json: unknown = null;
        try {
          json = JSON.parse(text);
        } catch {
          /* not json */
        }
        if (res.status() !== 401 || JSON.stringify(json) !== JSON.stringify({ error: 'Unauthorized' })) {
          failures.push(`${method} ${path.replace(String(game.id), ':gid').replace(String(cart.id), ':cid')} -> ${res.status()}`);
        }
      }

      const afterGames = snapshot(await listOf(admin, 'games'));
      const afterCarts = cartsUp ? snapshot((await cartridgesOrNull(admin)) ?? []) : null;
      expect(failures, 'routes not answering 401 {error:Unauthorized}').toEqual([]);
      expect(afterGames, 'games catalog unchanged').toBe(beforeGames);
      expect(afterCarts, 'cartridges catalog unchanged (null = cartridge backend unavailable)').toBe(beforeCarts);
    } finally {
      await anon.dispose();
      await admin.dispose();
      await cleanup(baseURL);
    }
  });

  test('T06 anonymous /admin page redirects to login', async ({ page, request }) => {
    for (const path of ['/admin', '/admin/x']) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), `GET ${path} status`).toBe(307);
      const location = res.headers()['location'] ?? '';
      const url = new URL(location, 'http://localhost');
      expect(url.pathname, `GET ${path} location`).toBe('/login');
      expect(url.searchParams.get('callbackUrl')).toBe('/admin');
    }
    await page.goto('/admin');
    await expect(page).toHaveURL(LOGIN_URL_RE);
  });

  test('T07 logged-in admin reaches /admin without redirect', async ({ page }) => {
    await loginAdminUi(page);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('button', { name: 'Games', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cartridges', exact: true })).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/admin$/);
  });

  const expiredCopy = 'Sua sessão expirou. Entre novamente para continuar.';

  async function expectExpiredPanel(page: Page) {
    const alert = page.getByRole('alert').filter({ hasText: expiredCopy });
    await expect(alert).toBeVisible();
    await expect(page.getByRole('button', { name: 'Games', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cartridges', exact: true })).toHaveCount(0);
    await expect(page.getByText('No games yet.')).toHaveCount(0);
    await expect(page.getByText('No cartridges yet.')).toHaveCount(0);
  }

  async function expectReloginButton(page: Page) {
    await page.getByRole('button', { name: 'Entrar novamente' }).click();
    await expect(page).toHaveURL(LOGIN_URL_RE);
  }

  test('T10 expired session shows panel on tab load (cartridges)', async ({ page }) => {
    await loginAdminUi(page);
    await expect(page.getByRole('button', { name: 'Cartridges', exact: true })).toBeVisible();
    await page.context().clearCookies();
    await page.getByRole('button', { name: 'Cartridges', exact: true }).click();
    await expectExpiredPanel(page);
    await expectReloginButton(page);
  });

  test('T10 expired session shows panel on save (games)', async ({ page }, testInfo) => {
    await loginAdminUi(page);
    await expect(page.getByRole('heading', { name: 'Add new game' })).toBeVisible();
    await page.context().clearCookies();
    const slug = uid();
    try {
      await page.getByPlaceholder('Title').fill(`Title ${slug}`);
      await page.getByRole('combobox').selectOption({ index: 1 });
      await page.getByPlaceholder('Slug').fill(slug);
      await page.getByRole('button', { name: 'Create game' }).click();
      await expectExpiredPanel(page);
      await expectReloginButton(page);
    } finally {
      await cleanup(baseURLOf(testInfo));
    }
  });

  test('T10 expired session shows panel on delete (games)', async ({ page }, testInfo) => {
    const baseURL = baseURLOf(testInfo);
    const slug = uid();
    const admin = await adminApi(baseURL);
    try {
      const game = await createGame(admin, slug);
      await loginAdminUi(page);
      const row = page
        .locator('div')
        .filter({ hasText: `Title ${slug}` })
        .filter({ has: page.getByRole('button', { name: 'Delete' }) })
        .last();
      await expect(page.getByText(`Title ${slug}`)).toBeVisible();
      await page.context().clearCookies();
      page.once('dialog', (d) => d.accept());
      await row.getByRole('button', { name: 'Delete' }).click();
      await expectExpiredPanel(page);
      await expectReloginButton(page);
      void game;
    } finally {
      await admin.dispose();
      await cleanup(baseURL);
    }
  });

  test('T11 handler rejects even when middleware is bypassed', async ({}, testInfo) => {
    const baseURL = baseURLOf(testInfo);
    const admin = await adminApi(baseURL);
    const anon = await newApi(baseURL);
    const slug = uid();
    try {
      const before = snapshot(await listOf(admin, 'games'));
      // Plain value from the spec, plus the recursion-depth form that skips middleware on Next < 14.2.25 (CVE-2025-29927).
      for (const header of ['middleware', 'middleware:middleware:middleware:middleware:middleware']) {
        const res = await anon.post('/api/admin/games', {
          headers: { 'x-middleware-subrequest': header },
          data: { title: `bypass ${slug}`, system: 'nes', slug },
          maxRedirects: 0
        });
        expect(res.status(), `x-middleware-subrequest: ${header}`).toBe(401);
        expect(await res.json()).toEqual({ error: 'Unauthorized' });
        expect(snapshot(await listOf(admin, 'games')), 'games catalog unchanged').toBe(before);
      }
    } finally {
      await anon.dispose();
      await admin.dispose();
      await cleanup(baseURL);
    }
  });

  test('T12 admin API calls keep their behavior', async ({}, testInfo) => {
    const baseURL = baseURLOf(testInfo);
    const admin = await adminApi(baseURL);
    const slug = uid();
    try {
      const list = await admin.get('/api/admin/games');
      expect(list.status()).toBe(200);
      expect(Array.isArray(await list.json())).toBe(true);

      const created = await admin.post('/api/admin/games', {
        data: { title: `Title ${slug}`, system: 'nes', console: 'nes', slug, description: 'sf01 e2e', romPath: '' }
      });
      expect(created.status()).toBe(201);
      expect(await created.json()).toMatchObject({ slug });
      const game = (await listOf(admin, 'games')).find((g) => g.slug === slug) as Item;
      expect(game).toBeTruthy();

      const updated = await admin.put(`/api/admin/games/${game.id}`, {
        data: { title: `Updated ${slug}`, system: 'nes', console: 'nes', slug, description: 'sf01 e2e', romPath: '', active: true }
      });
      expect(updated.status()).toBe(200);
      expect(await updated.json()).toEqual({ updated: true });

      const deleted = await admin.delete(`/api/admin/games/${game.id}`);
      expect(deleted.status()).toBe(200);
      expect(await deleted.json()).toEqual({ deleted: true });
      expect((await listOf(admin, 'games')).some((g) => g.slug === slug)).toBe(false);
    } finally {
      await admin.dispose();
      await cleanup(baseURL);
    }
  });

  test('T13 middleware never answers /api/admin (401 JSON, not a redirect)', async ({ request }) => {
    const res = await request.get('/api/admin/games', { maxRedirects: 0 });
    expect(res.status()).toBe(401);
    expect(res.headers()['location']).toBeUndefined();
    expect(res.headers()['content-type']).toContain('application/json');
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  test('T14 login and auth endpoints are not intercepted', async ({ request, page }) => {
    for (const path of ['/login', '/api/auth/session', '/api/auth/csrf']) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), `GET ${path}`).toBe(200);
      expect(res.headers()['location']).toBeUndefined();
    }
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('T15 /admin is still covered by the matcher (negative pair of T14)', async ({ request }) => {
    for (const path of ['/admin', '/admin/x']) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), `GET ${path}`).toBe(307);
      const url = new URL(res.headers()['location'] ?? '', 'http://localhost');
      expect(url.pathname).toBe('/login');
      expect(url.searchParams.get('callbackUrl')).toBe('/admin');
    }
  });
});

test.describe('no-mongo project', () => {
  test('T17 guard works on the in-memory fallback (anonymous 401 vs admin 200)', async ({}, testInfo) => {
    const baseURL = baseURLOf(testInfo);
    const anon = await newApi(baseURL);
    const admin = await adminApi(baseURL);
    try {
      const anonRes = await anon.get('/api/admin/games', { maxRedirects: 0 });
      expect(anonRes.status()).toBe(401);
      expect(await anonRes.json()).toEqual({ error: 'Unauthorized' });

      const adminRes = await admin.get('/api/admin/games');
      expect(adminRes.status()).toBe(200);
      expect(Array.isArray(await adminRes.json())).toBe(true);
    } finally {
      await anon.dispose();
      await admin.dispose();
    }
  });
});

// ====================================================================================================
// SF04 console-bezels admin tab (plan.md Test Specification T39-T45, T47, T48; no T46)
// Bezel data reaches the page only through page.route on `**/api/bezel/**` and `**/api/admin/bezels/**`:
// no real R2 read or write ever happens. Runs in the `main` project (the title does not start with T17).
// ====================================================================================================

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
/** Valid solid-colour RGB PNG, zlib-compressed, so the browser decodes the natural size. */
function solidPng(width: number, height: number, rgb: [number, number, number] = [40, 80, 160]) {
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set(rgb, 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

const CONSOLE_IDS = ['nes', 'snes', 'n64', 'dmg', 'gbc', 'gba', 'sms', 'megadrive', 'gamegear', 'ps', 'arcade', 'neogeo'];
const IMAGE_A = solidPng(800, 450, [200, 40, 40]);
const IMAGE_B = solidPng(1920, 1080, [40, 200, 40]);
const PNG_16_9 = { name: 'bezel.png', mimeType: 'image/png', buffer: solidPng(1920, 1080) };
const PNG_4_3 = { name: 'off-ratio.png', mimeType: 'image/png', buffer: solidPng(1024, 768) };

type Read = 200 | 404 | 502 | 'abort';
/** Scripted `/api/bezel/<id>` for the admin preview, plus the recorded GET urls and a hold per console. */
class BezelApi {
  gets: string[] = [];
  image: Buffer = IMAGE_A;
  private script = new Map<string, Read[]>();
  private holds = new Map<string, Promise<void>>();
  set(id: string, ...reads: Read[]) {
    this.script.set(id, reads);
  }
  hold(id: string) {
    let release: () => void = () => {};
    this.holds.set(id, new Promise<void>((resolve) => (release = resolve)));
    return release;
  }
  getsFor(id: string) {
    return this.gets.filter((url) => new URL(url).pathname === `/api/bezel/${id}`);
  }
  async install(page: Page) {
    await page.route('**/api/bezel/**', async (route) => {
      const url = route.request().url();
      this.gets.push(url);
      const id = new URL(url).pathname.split('/').pop() ?? '';
      const hold = this.holds.get(id);
      if (hold) await hold;
      const reads = this.script.get(id) ?? [404];
      const next = reads.length > 1 ? reads.shift()! : reads[0];
      if (next === 'abort') return route.abort();
      if (next === 200) {
        return route.fulfill({ status: 200, contentType: 'image/png', headers: { 'Cache-Control': 'no-store' }, body: this.image });
      }
      return route.fulfill({ status: next, contentType: 'application/json', body: '{"error":"x"}' });
    });
  }
}

type Write = { status: number; abort?: boolean };
class AdminBezelWrites {
  posts: Array<{ url: string; body: Buffer | null }> = [];
  deletes: string[] = [];
  post: Write = { status: 201 };
  del: Write = { status: 204 };
  releasePost: Promise<void> | null = null;
  releaseDelete: Promise<void> | null = null;
  onPostOk: (() => void) | null = null;
  onDeleteOk: (() => void) | null = null;
  async install(page: Page) {
    await page.route('**/api/admin/bezels/**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        this.posts.push({ url: request.url(), body: request.postDataBuffer() });
        if (this.releasePost) await this.releasePost;
        if (this.post.abort) return route.abort();
        if (this.post.status === 201) this.onPostOk?.();
        return route.fulfill({ status: this.post.status, contentType: 'application/json', body: '{"console":"nes","key":"bezels/nes.png"}' });
      }
      if (request.method() === 'DELETE') {
        this.deletes.push(request.url());
        if (this.releaseDelete) await this.releaseDelete;
        if (this.del.abort) return route.abort();
        if (this.del.status === 204) this.onDeleteOk?.();
        return route.fulfill({ status: this.del.status, contentType: this.del.status === 204 ? undefined : 'application/json', body: this.del.status === 204 ? '' : '{"error":"x"}' });
      }
      return route.continue();
    });
  }
}

async function openBezelsTab(page: Page, api: BezelApi, writes?: AdminBezelWrites) {
  await loginAdminUi(page);
  await api.install(page);
  await writes?.install(page);
  await page.getByRole('button', { name: 'Bezels', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bezel por console' })).toBeVisible();
}

const consoleSelect = (page: Page) => page.getByRole('combobox');
const fileInput = (page: Page) => page.locator('input[type="file"]');
const uploadButton = (page: Page) => page.getByRole('button', { name: /^Upload/i });
const removeButton = (page: Page) => page.getByRole('button', { name: /^Remove/i });
const currentPreview = (page: Page) => page.locator('img[src^="blob:"]');
const adminAlert = (page: Page, text: string) => page.getByRole('alert').filter({ hasText: text });
const EMPTY_COPY = 'No bezel for this console yet.';

test.describe('SF04 admin Bezels tab', () => {
  test('SF04-T39 the Bezels tab is third, shows the block with 12 consoles, Cartridges is unchanged', async ({ page }) => {
    const api = new BezelApi();
    await openBezelsTab(page, api);
    const tabs = await page.getByRole('button', { name: /^(Games|Cartridges|Bezels)$/ }).allInnerTexts();
    expect(tabs.map((text) => text.trim())).toEqual(['Games', 'Cartridges', 'Bezels']);
    const values = await consoleSelect(page).locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    expect(values).toEqual(CONSOLE_IDS);
    await page.getByRole('button', { name: 'Cartridges', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Create new cartridge' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cartridges list' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bezel por console' })).toHaveCount(0);
  });

  test('SF04-T40 the current preview shows checking, has-bezel, empty and read-error with Try again', async ({ page }) => {
    const api = new BezelApi();
    api.set('nes', 200);
    api.set('snes', 404);
    api.set('gba', 502, 200);
    const release = api.hold('nes');
    await openBezelsTab(page, api);
    const skeleton = page.locator('[class*="animate-pulse"]');
    await expect(skeleton).toBeVisible();
    const skeletonBox = await skeleton.boundingBox();
    expect(Math.abs(skeletonBox!.width / skeletonBox!.height / (16 / 9) - 1)).toBeLessThanOrEqual(0.02);
    release();
    await expect(currentPreview(page)).toBeVisible();
    await expect(removeButton(page)).toBeEnabled();

    await consoleSelect(page).selectOption('snes');
    await expect(page.getByText(EMPTY_COPY)).toBeVisible();
    await expect(removeButton(page)).toBeDisabled();

    await consoleSelect(page).selectOption('gba');
    await expect(page.getByText('Could not read this bezel.')).toBeVisible();
    await fileInput(page).setInputFiles(PNG_16_9);
    await expect(uploadButton(page)).toBeEnabled();
    expect(api.getsFor('gba')).toHaveLength(1);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(currentPreview(page).first()).toBeVisible();
    await expect(removeButton(page)).toBeEnabled();
    expect(api.getsFor('gba')).toHaveLength(2);
  });

  test('SF04-T41 a late response for the previous console is dropped', async ({ page }) => {
    const api = new BezelApi();
    api.set('nes', 200);
    api.set('snes', 404);
    const release = api.hold('nes');
    await openBezelsTab(page, api);
    await consoleSelect(page).selectOption('snes');
    await expect(page.getByText(EMPTY_COPY)).toBeVisible();
    release();
    await expect.poll(() => api.getsFor('nes').length).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    await expect(page.getByText(EMPTY_COPY)).toBeVisible();
    await expect(currentPreview(page)).toHaveCount(0);
    await expect(removeButton(page)).toBeDisabled();
  });

  test('SF04-T42 uploading over an existing bezel replaces the preview', async ({ page }) => {
    const api = new BezelApi();
    api.set('nes', 200);
    const writes = new AdminBezelWrites();
    writes.onPostOk = () => {
      api.image = IMAGE_B;
    };
    let releasePost: () => void = () => {};
    writes.releasePost = new Promise<void>((resolve) => (releasePost = resolve));
    await openBezelsTab(page, api, writes);
    await expect(currentPreview(page)).toBeVisible();
    await expect.poll(() => currentPreview(page).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(800);

    await fileInput(page).setInputFiles(PNG_16_9);
    await expect(page.getByText('New file')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /16:9/ })).toHaveCount(0);
    const getsBefore = api.getsFor('nes').length;
    await uploadButton(page).click();

    await expect(page.getByText('Uploading...').first()).toBeVisible();
    await expect(consoleSelect(page)).toBeDisabled();
    await expect(fileInput(page)).toBeDisabled();
    await expect(uploadButton(page)).toBeDisabled();
    await expect(removeButton(page)).toBeDisabled();
    releasePost();

    await expect(page.getByRole('status').filter({ hasText: 'Bezel saved for NES.' })).toBeVisible();
    expect(writes.posts).toHaveLength(1);
    expect(writes.posts[0].url).toContain('/api/admin/bezels/nes');
    expect(writes.posts[0].body?.toString('latin1')).toContain('name="file"');
    expect(await fileInput(page).evaluate((input: HTMLInputElement) => input.files?.length ?? 0)).toBe(0);
    await expect.poll(() => api.getsFor('nes').length).toBeGreaterThan(getsBefore);
    expect(api.getsFor('nes').pop()).toMatch(/\?v=\d+/);
    await expect.poll(() => currentPreview(page).first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1920);
  });

  test('SF04-T43 every upload failure shows its copy, keeps the file and keeps Upload enabled', async ({ page }) => {
    const api = new BezelApi();
    api.set('nes', 404);
    const writes = new AdminBezelWrites();
    await openBezelsTab(page, api, writes);
    await fileInput(page).setInputFiles(PNG_16_9);
    const cases: Array<[Write, string]> = [
      [{ status: 400 }, 'Choose a PNG file first.'],
      [{ status: 404 }, 'Unknown console.'],
      [{ status: 413 }, 'File is over 2 MB.'],
      [{ status: 415 }, 'This file is not a PNG.'],
      [{ status: 502 }, 'Storage failed. Nothing was saved. Try again.'],
      [{ status: 503 }, 'Storage is not configured. Nothing was saved.'],
      [{ status: 0, abort: true }, 'Could not reach the server.']
    ];
    for (const [write, text] of cases) {
      writes.post = write;
      await uploadButton(page).click();
      await expect(adminAlert(page, text), text).toBeVisible();
      expect(await fileInput(page).evaluate((input: HTMLInputElement) => input.files?.length ?? 0)).toBe(1);
      await expect(uploadButton(page)).toBeEnabled();
    }
  });

  test('SF04-T44 Remove asks for confirmation, shows Removing..., and reports every outcome', async ({ page }) => {
    const api = new BezelApi();
    api.set('nes', 200);
    const writes = new AdminBezelWrites();
    await openBezelsTab(page, api, writes);
    await expect(currentPreview(page)).toBeVisible();

    const messages: string[] = [];
    let accept = false;
    page.on('dialog', (dialog) => {
      messages.push(dialog.message());
      return accept ? dialog.accept() : dialog.dismiss();
    });
    await removeButton(page).click();
    expect(messages).toEqual(['Remove the bezel for NES?']);
    expect(writes.deletes).toHaveLength(0);

    accept = true;
    const errors: Array<[number, string]> = [
      [404, 'This console has no bezel.'],
      [502, 'Storage failed. Nothing was saved. Try again.'],
      [503, 'Storage is not configured. Nothing was saved.']
    ];
    for (const [status, text] of errors) {
      writes.del = { status };
      await removeButton(page).click();
      await expect(adminAlert(page, text), text).toBeVisible();
      await expect(removeButton(page)).toBeEnabled();
      await expect(currentPreview(page)).toBeVisible();
    }

    let releaseDelete: () => void = () => {};
    writes.releaseDelete = new Promise<void>((resolve) => (releaseDelete = resolve));
    writes.del = { status: 204 };
    writes.onDeleteOk = () => api.set('nes', 404);
    await removeButton(page).click();
    await expect(page.getByText('Removing...').first()).toBeVisible();
    await expect(consoleSelect(page)).toBeDisabled();
    await expect(uploadButton(page)).toBeDisabled();
    await expect(removeButton(page)).toBeDisabled();
    releaseDelete();
    await expect(page.getByRole('status').filter({ hasText: 'Bezel removed for NES.' })).toBeVisible();
    await expect(page.getByText(EMPTY_COPY)).toBeVisible();
  });

  for (const action of ['upload', 'remove'] as const) {
    for (const status of [401, 403]) {
      test(`SF04-T45 a ${status} on ${action} raises the session-expired panel`, async ({ page }) => {
        const api = new BezelApi();
        api.set('nes', action === 'remove' ? 200 : 404);
        const writes = new AdminBezelWrites();
        writes.post = { status };
        writes.del = { status };
        await openBezelsTab(page, api, writes);
        page.on('dialog', (dialog) => dialog.accept());
        if (action === 'upload') {
          await fileInput(page).setInputFiles(PNG_16_9);
          await uploadButton(page).click();
        } else {
          await expect(currentPreview(page)).toBeVisible();
          await removeButton(page).click();
        }
        await expect(page.getByRole('alert').filter({ hasText: 'Sua sessão expirou. Entre novamente para continuar.' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Bezels', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Entrar novamente' })).toBeVisible();
      });
    }
  }

  test('SF04-T47 an off-ratio PNG warns in amber and still uploads', async ({ page }) => {
    const api = new BezelApi();
    api.set('nes', 404);
    const writes = new AdminBezelWrites();
    await openBezelsTab(page, api, writes);
    await fileInput(page).setInputFiles(PNG_4_3);
    const warning = page.getByRole('status').filter({ hasText: '1024×768' });
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('not 16:9');
    await expect(uploadButton(page)).toBeEnabled();
    await uploadButton(page).click();
    await expect.poll(() => writes.posts.length).toBe(1);
  });

  test('SF04-T48 the bezel block has no axe violations and meets 44px targets in six states', async ({ page }) => {
    const api = new BezelApi();
    api.set('nes', 200);
    api.set('snes', 404);
    api.set('gba', 502);
    const writes = new AdminBezelWrites();
    await openBezelsTab(page, api, writes);
    const violations: Record<string, string[]> = {};
    const check = async (name: string) => {
      const results = await new AxeBuilder({ page }).analyze();
      violations[name] = results.violations.map((violation) => violation.id);
    };
    const heights = async (name: string, locators: Array<ReturnType<Page['locator']>>) => {
      for (const locator of locators) {
        const b = await locator.boundingBox();
        expect(b, `${name} target`).not.toBeNull();
        expect(b!.height, `${name} target height`).toBeGreaterThanOrEqual(44);
      }
    };
    const fileLabel = page.locator('label').filter({ has: fileInput(page) });

    await consoleSelect(page).selectOption('snes');
    await expect(page.getByText(EMPTY_COPY)).toBeVisible();
    await check('empty');
    await heights('empty', [consoleSelect(page), fileLabel, uploadButton(page), removeButton(page)]);

    await consoleSelect(page).selectOption('nes');
    await expect(currentPreview(page)).toBeVisible();
    await check('has-bezel');
    await heights('has-bezel', [removeButton(page)]);

    await consoleSelect(page).selectOption('gba');
    await expect(page.getByText('Could not read this bezel.')).toBeVisible();
    await check('read-error');
    await heights('read-error', [page.getByRole('button', { name: 'Try again' })]);

    await fileInput(page).setInputFiles(PNG_16_9);
    await expect(page.getByText('New file')).toBeVisible();
    await check('file-selected');

    await fileInput(page).setInputFiles(PNG_4_3);
    await expect(page.getByRole('status').filter({ hasText: '1024×768' })).toBeVisible();
    await check('aspect-warning');

    writes.post = { status: 415 };
    await uploadButton(page).click();
    await expect(adminAlert(page, 'This file is not a PNG.')).toBeVisible();
    await check('upload-error');

    expect(violations).toEqual({
      empty: [],
      'has-bezel': [],
      'read-error': [],
      'file-selected': [],
      'aspect-warning': [],
      'upload-error': []
    });
  });
});
