import { expect, request as pwRequest, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

// SF04 rom-path-containment contract spec (plan.md Test Specification T07, T08).
// Credentials come from ADMIN_USERNAME / ADMIN_PASSWORD (loaded from .env.local by playwright.config.ts);
// with ADMIN_PASSWORD_HASH set, ADMIN_PASSWORD must be the plain password that hash was made from.
// T07 reads the `super-retro` game, present in the mock catalog (lib/mock-data.ts) and in the seed;
// its file public/roms/super-retro.bin is not in the repository, so the read fails with 404.
// T08 creates `e2e-sf04-*` games and deletes them at the end.
// T09 edits the mock game `game-1` in the in-memory store of the no-mongo server (MONGODB_URI empty),
// so it never writes to a database; the [id] route bundle holds its own copy of the mock catalog.
// Run one project at a time: `--project=main` (T07, T08), then `--project=no-mongo` (T09).

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
    for (const path of ['/login', '/api/auth/csrf', '/api/auth/session', '/api/admin/games', '/api/admin/games/game-1', '/api/rom/warmup']) {
      await api.get(path, { maxRedirects: 0, timeout: 120_000 }).catch(() => {});
    }
  } finally {
    await api.dispose();
  }
});

test.beforeEach(async ({}, testInfo) => {
  const isNoMongo = testInfo.project.name === 'no-mongo';
  const isT09 = testInfo.title.startsWith('T09');
  test.skip(isNoMongo !== isT09, isT09 ? 'T09 runs only in the no-mongo project' : 'runs only in the main project');
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

test('T09 edit without a file keeps the stored romPath and ignores romPath in the body', async ({}, testInfo) => {
  const admin = await adminApi(baseURLOf(testInfo));
  try {
    const readGame = async (): Promise<Item> => {
      const res = await admin.get('/api/admin/games/game-1');
      expect(res.status(), 'admin GET /api/admin/games/game-1').toBe(200);
      return res.json();
    };
    const before = await readGame();
    expect(before.romPath).toBe('/roms/super-retro.bin');
    const fields = {
      title: String(before.title),
      system: String(before.system),
      console: String(before.console),
      slug: String(before.slug),
      description: String(before.description),
      image: String(before.image)
    };

    const json = await admin.put('/api/admin/games/game-1', { data: { ...fields, active: true, romPath: '../.env' } });
    expect(json.status()).toBe(200);
    expect(await json.json()).toEqual({ updated: true });
    expect((await readGame()).romPath, 'JSON edit').toBe(before.romPath);

    const multipart = await admin.put('/api/admin/games/game-1', { multipart: { ...fields, active: 'true', romPath: '../.env' } });
    expect(multipart.status()).toBe(200);
    expect(await multipart.json()).toEqual({ updated: true });
    expect((await readGame()).romPath, 'multipart edit without romFile').toBe(before.romPath);
  } finally {
    await admin.dispose();
  }
});
