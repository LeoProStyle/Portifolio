import { expect, request as pwRequest, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// 0002F SF01 play-screen-themes contract spec (plan.md Test Specification T05-T08, T17).
// `super-retro` comes from mockGames (lib/mock-data.ts) in both projects: getGames merges the mock
// catalog with MongoDB, and retrokey_e2e has no game with that slug, so no seed is needed.
// Its ROM file is not in the repository, so the real emulator never reaches `running`.
// `running` is reached with a stub of /emulator.html that posts EMULATOR_CANVAS_READY to the parent.
// `failed` uses the real emulator and the real core chain (fbneo: 3 candidates, about 31s).
// Each test records the design state it captures in its title and in test.info().annotations.
// Run one project at a time: `--project=main`, then `--project=no-mongo`.

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

async function stubEmulatorReady(page: Page) {
  await page.route(/\/emulator\.html/, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body style="margin:0;background:#000"><script>parent.postMessage({ type: "EMULATOR_CANVAS_READY" }, "*");</script></body></html>'
    })
  );
}

async function openRunning(page: Page) {
  await stubEmulatorReady(page);
  await page.goto(`/play/${SLUG}`);
  await expect(page.locator('[data-frame="arcade"]')).toBeVisible();
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
  const box = await page.locator('[data-frame]').boundingBox();
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
  test.describe(`viewport ${viewport.name}, fine pointer`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test(`T05 running: the frame fits with no page scroll and keeps 4/3 (${viewport.name})`, async ({ page }) => {
      state('running');
      await openRunning(page);
      await expectNoScroll(page);
      expect(Math.abs((await frameRatio(page)) / (4 / 3) - 1)).toBeLessThanOrEqual(0.02);
    });

    test(`T06 running: legend slot shown, touch overlay hidden on a fine pointer (${viewport.name})`, async ({ page }) => {
      state('running');
      await openRunning(page);
      await expect(page.locator('[data-slot="legend"]')).toBeVisible();
      await expect(page.locator('[data-slot="touch-overlay"]')).toBeHidden();
      await expect(page.locator('[data-slot="fullscreen"]')).toHaveCount(1);
      await expectNoScroll(page);
    });
  });

  test.describe(`viewport ${viewport.name}, touch pointer`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: true, isMobile: true });

    test(`T06 running: touch overlay shown over the stage, legend hidden, frame box unchanged (${viewport.name})`, async ({ page }) => {
      state('running');
      await openRunning(page);
      await expect(page.locator('[data-slot="touch-overlay"]')).toBeVisible();
      await expect(page.locator('[data-slot="legend"]')).toBeHidden();
      const overlayPosition = await page
        .locator('[data-slot="touch-overlay"]')
        .evaluate((element) => getComputedStyle(element).position);
      expect(overlayPosition).toBe('absolute');
      expect(Math.abs((await frameRatio(page)) / (4 / 3) - 1)).toBeLessThanOrEqual(0.02);
      await expectNoScroll(page);
    });
  });
}

test('T07 running: background and frame are drawn by the page around the iframe', async ({ page }) => {
  state('running');
  await openRunning(page);
  const stage = page.getByTestId('play-stage');
  await expect(stage).toHaveCSS('background-color', ARCADE_BG);
  const iframe = page.locator('[data-frame="arcade"] iframe');
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
  await page.goto(`/play/${SLUG}`);
  await expect(page.locator('[data-frame="arcade"]')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(/Starting game/);
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Could not start this game', { timeout: 75_000 });
  await expect(page.getByRole('status')).toHaveText(/Failed/);
  const url = page.url();
  await page.getByRole('button', { name: 'Reload' }).click();
  await expect(page.getByRole('status')).toHaveText(/Starting game/);
  expect(page.url()).toBe(url);
});

test('T17 not-found: an unknown slug shows the neutral theme and never boots the emulator', async ({ page }) => {
  state('not-found');
  await page.goto('/play/e2e-sf01-no-such-game');
  await expect(page.locator('[data-frame="neutral"]')).toBeVisible();
  await expect(page.getByText('Game not found')).toBeVisible();
  await expect(page.getByTestId('play-stage')).toHaveCSS('background-color', NEUTRAL_BG);
  await expect(page.getByRole('link', { name: /Back home/ })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Retry|Reload/ })).toHaveCount(0);
});

test('T17 metadata-error: a failed metadata request shows Retry, and Retry fetches again', async ({ page }) => {
  state('metadata-error');
  await page.route('**/api/game/**', (route) => route.abort());
  await page.goto(`/play/${SLUG}`);
  await expect(page.locator('[data-frame="neutral"]')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Could not load game info.');
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.unroute('**/api/game/**');
  await stubEmulatorReady(page);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('[data-frame="arcade"]')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(/Running/);
});
