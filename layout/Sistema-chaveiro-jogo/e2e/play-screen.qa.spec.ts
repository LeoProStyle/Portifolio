import { expect, request as pwRequest, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { deflateSync } from 'node:zlib';

// 0002F SF01 play-screen-themes contract spec (plan.md Test Specification T05-T08, T17).
// `super-retro` comes from mockGames (lib/mock-data.ts) in both projects: getGames merges the mock
// catalog with MongoDB, and retrokey_e2e has no game with that slug, so no seed is needed.
// Its ROM file is not in the repository, so the real emulator never reaches `running`.
// `running` is reached with a stub of /emulator.html that posts EMULATOR_CANVAS_READY to the parent.
// `failed` uses the real emulator and the real core chain (fbneo: 3 candidates, about 31s).
// Each test records the design state it captures in its title and in test.info().annotations.
// Run one project at a time: `--project=main`, then `--project=no-mongo`.
// 0002F SF04 console-bezels (plan.md Test Specification T23-T38, no T46; T28 migrates T05/T06/T07/T17 below).
// Bezel data reaches the page only through page.route on `**/api/bezel/**` (routeBezel); every test that can
// be Wide (1280x720 default, 1366x768, 1920x1080) calls it, so no run ever reads a real bucket.
// "Held ready" = the /emulator.html stub posts EMULATOR_CANVAS_READY only when the test releases it.
// New titles carry the `SF04-` prefix so they do not clash with the SF01 `T05`-`T17` titles.

const SLUG = 'super-retro';
const ARCADE_BG = 'rgb(11, 11, 26)'; // #0B0B1A, design.md Tokens "Arcade (FBNeo)"
const NEUTRAL_BG = 'rgb(9, 9, 11)'; // #09090B, design.md Tokens "neutral"
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '844x390', width: 844, height: 390 },
  { name: '1366x768', width: 1366, height: 768 }
];

function state(name: string) {
  test.info().annotations.push({ type: 'design-state', description: name });
}

// --- SF04 helpers -------------------------------------------------------------------------------

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
const pngCache = new Map<string, Buffer>();
/** Valid solid-colour RGB PNG (zlib-compressed, a few KB), so the browser decodes the natural size. */
function solidPng(width: number, height: number, rgb: [number, number, number] = [30, 30, 60]) {
  const key = `${width}x${height}`;
  const cached = pngCache.get(key);
  if (cached) return cached;
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set(rgb, 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
  pngCache.set(key, png);
  return png;
}

type BezelMode = 'missing' | 'png' | 'error' | 'slow';
/**
 * Routes every GET /api/bezel/** for this page: 'missing' = 404, 'png' = 200 16:9 PNG,
 * 'error' = 500 (or an aborted request with { abort: true }), 'slow' = PNG after 3 s.
 */
async function routeBezel(page: Page, mode: BezelMode, options: { status?: number; abort?: boolean } = {}) {
  const requests: string[] = [];
  await page.route('**/api/bezel/**', async (route) => {
    requests.push(route.request().url());
    if (mode === 'missing') return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Not found"}' });
    if (mode === 'error') {
      if (options.abort) return route.abort();
      return route.fulfill({ status: options.status ?? 500, contentType: 'application/json', body: '{"error":"x"}' });
    }
    if (mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 3000));
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'Cache-Control': 'no-store' },
      body: solidPng(1920, 1080)
    });
  });
  return { requests };
}

/** /emulator.html stub that posts EMULATOR_CANVAS_READY only after the page releases it. */
async function stubEmulatorHeld(page: Page) {
  await page.route(/\/emulator\.html/, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body style="margin:0;background:#000"><script>window.addEventListener("message",function(e){if(e.data==="sf04-release"){parent.postMessage({ type: "EMULATOR_CANVAS_READY" }, "*");}});</script></body></html>'
    })
  );
}
async function releaseReady(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const frame = document.querySelector('iframe');
        return frame?.contentDocument?.readyState ?? 'none';
      })
    )
    .toBe('complete');
  await page.evaluate(() => {
    (document.querySelector('iframe') as HTMLIFrameElement).contentWindow!.postMessage('sf04-release', '*');
  });
}
async function bezelLoaded(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const img = document.querySelector<HTMLImageElement>('.play-bezel-img');
        return !!img && img.complete && img.naturalWidth > 0;
      })
    )
    .toBe(true);
}
async function mockGame(page: Page, system: string, title = 'Bezel Test') {
  await page.route('**/api/game/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ title, system, console: system }) })
  );
}
async function box(locator: ReturnType<Page['locator']>) {
  const b = await locator.boundingBox();
  expect(b, 'bounding box').not.toBeNull();
  return b!;
}
const center = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
/** Opens the play screen with the bezel loaded and adopted while the game is still booting. Returns the release. */
async function openBezelHeld(page: Page, bezel: BezelMode = 'png') {
  await routeBezel(page, bezel);
  await stubEmulatorHeld(page);
  await page.goto(`/play/${SLUG}`);
  await expect(page.getByRole('status')).toHaveText(/Starting game/);
  await bezelLoaded(page);
  return async () => {
    await releaseReady(page);
    await expect(page.getByRole('status')).toHaveText(/Running/);
  };
}

async function stubEmulatorReady(page: Page) {
  await page.route(/\/emulator\.html/, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body style="margin:0;background:#000"><script>parent.postMessage({ type: "EMULATOR_CANVAS_READY" }, "*");</script></body></html>'
    })
  );
}

async function openRunning(page: Page, bezel: BezelMode = 'missing') {
  await routeBezel(page, bezel);
  await stubEmulatorReady(page);
  await page.goto(`/play/${SLUG}`);
  await expect(page.locator('[data-window]')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(/Running/);
}

async function expectNoScroll(page: Page) {
  const size = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  expect(size.scrollHeight, 'page must not scroll vertically').toBeLessThanOrEqual(size.innerHeight);
  expect(size.scrollWidth, 'page must not scroll horizontally').toBeLessThanOrEqual(size.innerWidth);
}

async function frameRatio(page: Page) {
  const box = await page.locator('[data-window]').boundingBox();
  expect(box, 'frame box').not.toBeNull();
  return box!.width / box!.height;
}

test.beforeAll(async ({}, testInfo) => {
  test.setTimeout(180_000);
  const api = await pwRequest.newContext({ baseURL: testInfo.project.use.baseURL as string });
  try {
    for (const path of [`/play/${SLUG}`, `/api/game/${SLUG}`]) {
      await api.get(path, { timeout: 150_000 }).catch(() => {});
    }
  } finally {
    await api.dispose();
  }
});

for (const viewport of VIEWPORTS) {
  const wide = viewport.width >= 1024;
  test.describe(`viewport ${viewport.name}, fine pointer`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test(`T05 running: the window fits with no page scroll and keeps 4/3 (${viewport.name})`, async ({ page }) => {
      state('running');
      await openRunning(page);
      await expectNoScroll(page);
      expect(Math.abs((await frameRatio(page)) / (4 / 3) - 1)).toBeLessThanOrEqual(0.02);
      // SF04 T28: the CSS frame exists only in Wide (no bezel here); the phone modes have none.
      await expect(page.locator('[data-frame]')).toHaveCount(wide ? 1 : 0);
    });

    test(`T06 running: legend slot only in Wide, touch overlay hidden on a fine pointer (${viewport.name})`, async ({ page }) => {
      state('running');
      await openRunning(page);
      if (wide) await expect(page.locator('[data-slot="legend"]')).toBeVisible();
      else await expect(page.locator('[data-slot="legend"]')).toBeHidden();
      await expect(page.locator('[data-slot="touch-overlay"]')).toBeHidden();
      await expect(page.locator('[data-slot="fullscreen"]')).toHaveCount(1);
      await expectNoScroll(page);
    });
  });

  test.describe(`viewport ${viewport.name}, touch pointer`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: true, isMobile: true });

    test(`T06 running: touch overlay shown over the stage, legend hidden, window box unchanged (${viewport.name})`, async ({ page }) => {
      state('running');
      await openRunning(page);
      await expect(page.locator('[data-slot="touch-overlay"]')).toBeVisible();
      await expect(page.locator('[data-slot="legend"]')).toBeHidden();
      const overlayPosition = await page
        .locator('[data-slot="touch-overlay"]')
        .evaluate((element) => getComputedStyle(element).position);
      expect(overlayPosition).toBe('absolute');
      expect(Math.abs((await frameRatio(page)) / (4 / 3) - 1)).toBeLessThanOrEqual(0.02);
      await expect(page.locator('[data-frame]')).toHaveCount(0);
      await expectNoScroll(page);
    });
  });
}

test('T07 running: background and frame are drawn by the page around the iframe', async ({ page }) => {
  state('running');
  await openRunning(page);
  const stage = page.getByTestId('play-stage');
  await expect(stage).toHaveCSS('background-color', ARCADE_BG);
  const iframe = page.locator('[data-window] iframe');
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute('title', 'Play Super Retro');
  const src = (await iframe.getAttribute('src')) ?? '';
  const params = new URL(src, 'http://localhost').searchParams;
  expect([...params.keys()].sort()).toEqual(['core', 'rom', 'title']);
  expect(src.toLowerCase()).not.toContain('0b0b1a');
  expect(src).not.toContain('--t-');
});

test('T07 running: Back home is the first focusable element and targets meet 44px', async ({ page }) => {
  state('running');
  await openRunning(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /Back home/ })).toBeFocused();
  const back = await page.getByRole('link', { name: /Back home/ }).boundingBox();
  expect(back!.height).toBeGreaterThanOrEqual(44);
  expect(back!.width).toBeGreaterThanOrEqual(44);
  const results = await new AxeBuilder({ page }).withRules(['color-contrast', 'target-size']).analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});

test('T08 failed: the real core chain ends in failed and Reload restarts it in place', async ({ page }) => {
  test.setTimeout(90_000);
  state('failed');
  await routeBezel(page, 'missing');
  await page.goto(`/play/${SLUG}`);
  await expect(page.locator('[data-window]')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(/Starting game/);
  // Next.js adds its own empty role="alert" route announcer, so the alert is matched by its text.
  const alert = page.getByRole('alert').filter({ hasText: 'Could not start this game' });
  await expect(alert).toBeVisible({ timeout: 75_000 });
  await expect(page.getByRole('status')).toHaveText(/Failed/);
  const url = page.url();
  await page.getByRole('button', { name: 'Reload' }).click();
  await expect(page.getByRole('status')).toHaveText(/Starting game/);
  expect(page.url()).toBe(url);
});

test('T17 not-found: an unknown slug shows the neutral theme and never boots the emulator', async ({ page }) => {
  state('not-found');
  await routeBezel(page, 'missing');
  await page.goto('/play/e2e-sf01-no-such-game');
  await expect(page.locator('[data-frame="neutral"]')).toBeVisible();
  await expect(page.getByText('Game not found')).toBeVisible();
  await expect(page.getByTestId('play-stage')).toHaveCSS('background-color', NEUTRAL_BG);
  // SF04 T28: two Back home links now (top bar link + panel button); the check is scoped to the panel.
  await expect(page.locator('[data-window]').getByRole('link', { name: 'Back home' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Retry|Reload/ })).toHaveCount(0);
});

test('T17 metadata-error: a failed metadata request shows Retry, and Retry fetches again', async ({ page }) => {
  state('metadata-error');
  await routeBezel(page, 'missing');
  await page.route('**/api/game/**', (route) => route.abort());
  await page.goto(`/play/${SLUG}`);
  await expect(page.locator('[data-frame="neutral"]')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Could not load game info.' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.unroute('**/api/game/**');
  await stubEmulatorReady(page);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('[data-window]')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(/Running/);
});

// ====================================================================================================
// SF04 console-bezels (plan.md Test Specification T23-T38)
// ====================================================================================================

const FRAME_AREA = '.play-frame-area';
const BEZEL_AREA = '.play-bezel-area';
const alerts = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

test.describe('SF04 Wide 1366x768 with a bezel', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('SF04-T23 bezel geometry: 16/9 area centered in the stage, window fills its height at 4/3', async ({ page }) => {
    state('booting -> running (bezel adopted)');
    const release = await openBezelHeld(page);
    await expect(page.locator(FRAME_AREA)).toHaveAttribute('data-mode', 'bezel');
    await release();
    const img = page.locator('.play-bezel-img');
    await expect(img).toHaveAttribute('alt', '');
    await expect(img).toHaveAttribute('aria-hidden', 'true');
    const stage = await box(page.locator(FRAME_AREA));
    const area = await box(page.locator(BEZEL_AREA));
    const win = await box(page.locator('[data-window]'));
    expect(Math.abs(area.width - (area.height * 16) / 9), 'area ratio 16/9').toBeLessThanOrEqual(1);
    expect(Math.abs(center(area).x - center(stage).x)).toBeLessThanOrEqual(2);
    expect(Math.abs(center(area).y - center(stage).y)).toBeLessThanOrEqual(2);
    expect(Math.abs(win.height - area.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(center(win).x - center(area).x)).toBeLessThanOrEqual(2);
    expect(Math.abs(win.width / win.height - 4 / 3)).toBeLessThanOrEqual(0.01);
    await expect(page.locator('[data-frame]')).toHaveCount(0);
  });

  test('SF04-T29 the bezel is adopted once, while the game is still booting, and the box never changes after', async ({ page }) => {
    state('booting -> running (single frame to bezel switch)');
    await page.addInitScript(() => {
      const w = window as unknown as { __modes: Array<{ mode: string; status: string }> };
      w.__modes = [];
      new MutationObserver(() => {
        const mode = document.querySelector<HTMLElement>('.play-frame-area')?.dataset.mode;
        const last = w.__modes[w.__modes.length - 1];
        if (mode && (!last || last.mode !== mode)) {
          w.__modes.push({ mode, status: document.querySelector('[role="status"]')?.textContent ?? '' });
        }
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-mode'] });
    });
    const release = await openBezelHeld(page);
    await expect(page.locator(FRAME_AREA)).toHaveAttribute('data-mode', 'bezel');
    await release();
    const modes = await page.evaluate(() => (window as unknown as { __modes: Array<{ mode: string; status: string }> }).__modes);
    expect(modes.map((entry) => entry.mode)).toEqual(['frame', 'bezel']);
    expect(modes[1].status).toMatch(/Starting game/);
    const before = await box(page.locator('[data-window]'));
    await page.waitForTimeout(1000);
    const after = await box(page.locator('[data-window]'));
    expect(after).toEqual(before);
  });

  test('SF04-T25 no bezel keeps the CSS frame', async ({ page }) => {
    state('running (no bezel)');
    await openRunning(page, 'missing');
    await expect(page.locator(FRAME_AREA)).toHaveAttribute('data-mode', 'frame');
    await expect(page.locator('[data-frame="arcade"]')).toBeVisible();
    expect(Math.abs((await frameRatio(page)) / (4 / 3) - 1)).toBeLessThanOrEqual(0.02);
    await expect(page.locator('[data-slot="legend"]')).toBeVisible();
    await expectNoScroll(page);
  });

  for (const [label, options] of [
    ['404', undefined],
    ['500', { status: 500 }],
    ['aborted', { abort: true }]
  ] as const) {
    test(`SF04-T30 a bezel that answers ${label} never blocks the game`, async ({ page }) => {
      state('running (bezel refused)');
      await routeBezel(page, label === '404' ? 'missing' : 'error', options);
      await stubEmulatorReady(page);
      await page.goto(`/play/${SLUG}`);
      await expect(page.getByRole('status')).toHaveText(/Running/);
      await page.waitForTimeout(500);
      await expect(page.locator(FRAME_AREA)).toHaveAttribute('data-mode', 'frame');
      await expect(alerts(page)).toHaveCount(0);
      await expect(page.getByText(/bezel/i)).toHaveCount(0);
    });
  }

  test('SF04-T31 a bezel that arrives 3 s late is refused: Running first, mode stays frame', async ({ page }) => {
    state('running (bezel refused, slow)');
    await routeBezel(page, 'slow');
    await stubEmulatorReady(page);
    await page.goto(`/play/${SLUG}`);
    await expect(page.getByRole('status')).toHaveText(/Running/);
    await expect(page.locator(FRAME_AREA)).toHaveAttribute('data-mode', 'frame');
    const before = await box(page.locator('[data-window]'));
    await page.waitForTimeout(3500);
    await expect(page.locator(FRAME_AREA)).toHaveAttribute('data-mode', 'frame');
    expect(await box(page.locator('[data-window]'))).toEqual(before);
  });

  test('SF04-T32 the play screen runs with the CSS frame without MongoDB and without a bezel', async ({ page }) => {
    state('running (no bezel; run in the no-mongo project too)');
    await openRunning(page, 'missing');
    await expect(page.getByRole('status')).toHaveText(/Running/);
    await expect(page.locator('[data-frame="arcade"]')).toBeVisible();
    await expect(alerts(page)).toHaveCount(0);
  });

  test('SF04-T33 panel actions use px-6 (Retry and the not-found Back home)', async ({ page }) => {
    state('metadata-error / not-found');
    await routeBezel(page, 'missing');
    await page.route('**/api/game/**', (route) => route.abort());
    await page.goto(`/play/${SLUG}`);
    const retry = page.getByRole('button', { name: 'Retry' });
    await expect(retry).toBeVisible();
    await expect(retry).toHaveCSS('padding-left', '24px');
    await expect(retry).toHaveCSS('padding-right', '24px');
    await page.unroute('**/api/game/**');
    await page.goto('/play/e2e-sf01-no-such-game');
    const back = page.locator('[data-window]').getByRole('link', { name: 'Back home' });
    await expect(back).toBeVisible();
    await expect(back).toHaveCSS('padding-left', '24px');
    await expect(back).toHaveCSS('padding-right', '24px');
  });

  test('SF04-T34 not-found panel has its own Back home link to / and no retry', async ({ page }) => {
    state('not-found');
    await routeBezel(page, 'missing');
    await page.goto('/play/e2e-sf01-no-such-game');
    const back = page.locator('[data-window]').getByRole('link', { name: 'Back home' });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute('href', '/');
    await expect(page.getByRole('button', { name: /Retry|Reload/ })).toHaveCount(0);
    await expect(page.locator('iframe')).toHaveCount(0);
  });

  test('SF04-T36 loading-metadata has no axe violations', async ({ page }) => {
    state('loading-metadata');
    await routeBezel(page, 'missing');
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/game/**', async (route) => {
      await held;
      await route.abort();
    });
    try {
      await page.goto(`/play/${SLUG}`);
      await expect(page.locator('.play-skeleton')).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
    } finally {
      release();
    }
  });

  test('SF04-T37 the skeleton is 4/3 in Wide too', async ({ page }) => {
    state('loading-metadata');
    await routeBezel(page, 'missing');
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/game/**', async (route) => {
      await held;
      await route.abort();
    });
    try {
      await page.goto(`/play/${SLUG}`);
      const skeleton = page.locator('.play-skeleton');
      await expect(skeleton).toBeVisible();
      const loading = await box(skeleton);
      expect(Math.abs(loading.width / loading.height / (4 / 3) - 1)).toBeLessThanOrEqual(0.02);
    } finally {
      release();
    }
  });

  test('SF04-T38 no "No system selected" console message while the metadata loads', async ({ page }) => {
    state('loading-metadata -> running');
    const messages: string[] = [];
    page.on('console', (message) => messages.push(message.text()));
    await openRunning(page, 'missing');
    expect(messages.filter((text) => text.includes('No system selected'))).toEqual([]);
  });
});

test.describe('SF04 Wide 1920x1080 bezel window share per console', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('SF04-T24 window width / area width is 0.75, 0.625 and 0.84375 for 4/3, 10/9 and 3/2', async ({ page }) => {
    state('running (bezel adopted) per console');
    await routeBezel(page, 'png');
    await stubEmulatorHeld(page);
    for (const [system, share] of [
      ['Arcade (FBNeo)', 0.75],
      ['Game Boy', 0.625],
      ['Game Boy Advance', 0.84375]
    ] as const) {
      await page.unroute('**/api/game/**').catch(() => {});
      await mockGame(page, system);
      await page.goto(`/play/${SLUG}`);
      await expect(page.getByRole('status')).toHaveText(/Starting game/);
      await bezelLoaded(page);
      await expect(page.locator(FRAME_AREA)).toHaveAttribute('data-mode', 'bezel');
      await releaseReady(page);
      await expect(page.getByRole('status')).toHaveText(/Running/);
      const area = await box(page.locator(BEZEL_AREA));
      const win = await box(page.locator('[data-window]'));
      expect(Math.abs(win.width / area.width - share), system).toBeLessThanOrEqual(0.005);
      expect(Math.abs(win.height - area.height), system).toBeLessThanOrEqual(1);
    }
  });
});

const PHONES = [
  { name: '390x844 fine', width: 390, height: 844, touch: false },
  { name: '844x390 fine', width: 844, height: 390, touch: false },
  { name: '390x844 touch', width: 390, height: 844, touch: true },
  { name: '844x390 touch', width: 844, height: 390, touch: true },
  { name: '1366x768 touch', width: 1366, height: 768, touch: true }
];

for (const phone of PHONES) {
  test.describe(`SF04 phone mode ${phone.name}`, () => {
    test.use({
      viewport: { width: phone.width, height: phone.height },
      ...(phone.touch ? { hasTouch: true, isMobile: true } : {})
    });

    test(`SF04-T26 bare window, no bezel request, no scroll (${phone.name})`, async ({ page }) => {
      state('running (phone, bare)');
      const bezel = await routeBezel(page, 'png');
      await stubEmulatorReady(page);
      await page.goto(`/play/${SLUG}`);
      await expect(page.getByRole('status')).toHaveText(/Running/);
      await page.waitForTimeout(500);
      await expect(page.locator(FRAME_AREA)).toHaveAttribute('data-mode', 'bare');
      await expect(page.locator('[data-frame]')).toHaveCount(0);
      await expect(page.locator('.play-bezel-img')).toHaveCount(0);
      expect(bezel.requests).toEqual([]);
      const area = await box(page.locator(FRAME_AREA));
      const win = await box(page.locator('[data-window]'));
      expect(Math.abs(win.width / win.height / (4 / 3) - 1)).toBeLessThanOrEqual(0.02);
      const fillsOneAxis = Math.abs(win.width - area.width) <= 2 || Math.abs(win.height - area.height) <= 2;
      expect(fillsOneAxis, 'window fills the stage on one axis').toBe(true);
      await expectNoScroll(page);
      const back = await box(page.getByRole('link', { name: /Back home/ }));
      expect(back.height).toBeGreaterThanOrEqual(44);
      await expect(page.locator('[data-slot="legend"]')).toBeHidden();
    });
  });
}

test.describe('SF04 phone 390x844 status strip and skeleton', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('SF04-T27 status text is visually hidden in running, the strip overlays on error, the window never moves', async ({ page }) => {
    state('booting -> running; metadata-error');
    await routeBezel(page, 'missing');
    await stubEmulatorHeld(page);
    await page.goto(`/play/${SLUG}`);
    await expect(page.getByRole('status')).toHaveText(/Starting game/);
    const booting = await box(page.locator('[data-window]'));
    await releaseReady(page);
    await expect(page.getByRole('status')).toHaveText(/Running/);
    const running = await box(page.locator('[data-window]'));
    expect(running).toEqual(booting);
    const status = await box(page.getByRole('status'));
    expect(status.width).toBeLessThanOrEqual(1);
    expect(status.height).toBeLessThanOrEqual(1);

    await page.route('**/api/game/**', (route) => route.abort());
    await page.goto(`/play/${SLUG}`);
    const strip = page.getByRole('status');
    await expect(strip).toHaveText(/Error/);
    await expect(strip).toBeVisible();
    const position = await strip.evaluate((el) => {
      for (let node: HTMLElement | null = el as HTMLElement, depth = 0; node && depth < 3; node = node.parentElement, depth++) {
        if (getComputedStyle(node).position === 'absolute') return 'absolute';
      }
      return getComputedStyle(el).position;
    });
    expect(position).toBe('absolute');
  });

  test('SF04-T37 the 4/3 skeleton has the same size rule as the running window', async ({ page }) => {
    state('loading-metadata -> running');
    await routeBezel(page, 'missing');
    await stubEmulatorReady(page);
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/game/**', async (route) => {
      await held;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ title: 'Super Retro', system: 'Arcade (FBNeo)', console: 'Arcade (FBNeo)' })
      });
    });
    await page.goto(`/play/${SLUG}`);
    const skeleton = page.locator('.play-skeleton');
    await expect(skeleton).toBeVisible();
    const loading = await box(skeleton);
    expect(Math.abs(loading.width / loading.height / (4 / 3) - 1)).toBeLessThanOrEqual(0.02);
    release();
    await expect(page.getByRole('status')).toHaveText(/Running/);
    const running = await box(page.locator('[data-window]'));
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(running[key] - loading[key]), key).toBeLessThanOrEqual(2);
    }
  });
});

const TITLE_80 = 'An Exceptionally Long Game Title That Keeps Going And Going Past Every Edge Ever';
for (const view of [
  { name: '390x844', width: 390, height: 844, size: '18px', wide: false },
  { name: '844x390', width: 844, height: 390, size: '18px', wide: false },
  { name: '1366x768', width: 1366, height: 768, size: '24px', wide: true }
]) {
  test.describe(`SF04 title scale ${view.name}`, () => {
    test.use({ viewport: { width: view.width, height: view.height } });

    test(`SF04-T35 title is ${view.size} on one line with an ellipsis; system label ${view.wide ? 'visible' : 'hidden'} (${view.name})`, async ({ page }) => {
      state('running (long title)');
      await routeBezel(page, 'missing');
      await stubEmulatorReady(page);
      await mockGame(page, 'Arcade (FBNeo)', TITLE_80);
      await page.goto(`/play/${SLUG}`);
      await expect(page.getByRole('status')).toHaveText(/Running/);
      const title = page.getByRole('heading', { level: 1 });
      await expect(title).toHaveCSS('font-size', view.size);
      await expect(title).toHaveCSS('white-space', 'nowrap');
      await expect(title).toHaveCSS('text-overflow', 'ellipsis');
      const metrics = await title.evaluate((el) => ({
        height: el.getBoundingClientRect().height,
        lineHeight: parseFloat(getComputedStyle(el).lineHeight)
      }));
      expect(metrics.height).toBeLessThanOrEqual(metrics.lineHeight + 1);
      const label = page.locator('header p');
      if (view.wide) await expect(label).toBeVisible();
      else await expect(label).toBeHidden();
    });
  });
}
