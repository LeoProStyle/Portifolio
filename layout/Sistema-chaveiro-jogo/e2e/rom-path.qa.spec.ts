import { expect, request as pwRequest, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

// SF04 rom-path-containment contract spec (plan.md Test Specification T07, T08).
// Credentials come from ADMIN_USERNAME / ADMIN_PASSWORD (loaded from .env.local by playwright.config.ts);
// with ADMIN_PASSWORD_HASH set, ADMIN_PASSWORD must be the plain password that hash was made from.
// T07 reads the `super-retro` game, present in the mock catalog (lib/mock-data.ts) and in the seed;
// its file public/roms/super-retro.bin is not in the repository, so the read fails with 404.
// T08 creates `e2e-sf04-*` games and deletes them at the end.
// Run in the main project only: `npx playwright test e2e/rom-path.qa.spec.ts --project=main`.

const PREFIX = 'e2e-sf04-';
const USERNAME = process.env.ADMIN_USERNAME ?? '';
const PASSWORD = process.env.ADMIN_PASSWORD ?? '';
if (!USERNAME || !PASSWORD) {
  throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set (.env.local) to run the ROM path E2E spec.');
}

type Item = { id: string; slug?: string; romPath?: string; [k: string]: unknown };

function uid() {
  return `${PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function baseURLOf(testInfo: { project: { use: { baseURL?: string } } }) {
  return testInfo.project.use.baseURL as string;
}

async function adminApi(baseURL: string): Promise<APIRequestContext> {
  const api = await pwRequest.newContext({ baseURL });
  const { csrfToken } = await (await api.get('/api/auth/csrf')).json();
  const res = await api.post('/api/auth/callback/credentials', {
    form: { csrfToken, username: USERNAME, password: PASSWORD, json: 'true' }
  });
  const session = await (await api.get('/api/auth/session')).json();
  if (!res.ok() || !session?.user) {
    throw new Error(`Admin login failed (callback status ${res.status()}, session present: ${Boolean(session?.user)})`);
  }
  return api;
}

async function listGames(admin: APIRequestContext): Promise<Item[]> {
  const res = await admin.get('/api/admin/games');
  expect(res.status(), 'admin GET /api/admin/games').toBe(200);
  return res.json();
}

test.beforeAll(async ({}, testInfo) => {
  test.setTimeout(180_000);
  const api = await pwRequest.newContext({ baseURL: baseURLOf(testInfo) });
  try {
    for (const path of ['/login', '/api/auth/csrf', '/api/auth/session', '/api/admin/games', '/api/admin/games/warmup', '/api/rom/warmup']) {
      await api.get(path, { maxRedirects: 0, timeout: 120_000 }).catch(() => {});
    }
  } finally {
    await api.dispose();
  }
});

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'main', 'runs only in the main project');
});

test('T07 ROM route stays public and never echoes a path', async ({ request }) => {
  const missingFile = await request.get('/api/rom/super-retro', { maxRedirects: 0 });
  expect(missingFile.status()).toBe(404);
  const missingFileBody = await missingFile.text();
  expect(JSON.parse(missingFileBody)).toEqual({ error: 'ROM not found' });
  expect(missingFileBody).not.toMatch(/roms|public|\.bin/i);

  const missingGame = await request.get('/api/rom/does-not-exist', { maxRedirects: 0 });
  expect(missingGame.status()).toBe(404);
  expect(await missingGame.json()).toEqual({ error: 'Game not found' });
});

test('T08 romPath in the request body is ignored on create', async ({}, testInfo) => {
  const baseURL = baseURLOf(testInfo);
  const admin = await adminApi(baseURL);
  const slug = uid();
  try {
    const created = await admin.post('/api/admin/games', {
      data: { title: `Title ${slug}`, system: 'nes', console: 'nes', slug, description: 'sf04 e2e', romPath: '../.env' }
    });
    expect(created.status()).toBe(201);
    expect(await created.json()).toMatchObject({ slug, romPath: '' });

    const game = (await listGames(admin)).find((g) => g.slug === slug);
    expect(game, 'created game is listed').toBeTruthy();
    expect(game?.romPath).toBe('');
  } finally {
    // In dev without MongoDB the [id] route has its own in-memory array, so the delete may answer 404.
    for (const g of await listGames(admin)) {
      if (String(g.slug ?? '').startsWith(PREFIX)) await admin.delete(`/api/admin/games/${g.id}`);
    }
    await admin.dispose();
  }
});
