import { expect, request as pwRequest, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

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
  await page.goto('/login?callbackUrl=/admin');
  await page.getByPlaceholder('Usuário').fill(USERNAME);
  await page.getByPlaceholder('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  try {
    await page.waitForURL('**/admin', { timeout: 30_000 });
  } catch (error) {
    // Clear the fields so the failure snapshot (test-results/**/error-context.md) never records the credentials.
    await page.getByPlaceholder('Usuário').fill('').catch(() => {});
    await page.getByPlaceholder('Senha').fill('').catch(() => {});
    throw error;
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
