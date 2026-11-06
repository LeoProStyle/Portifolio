import { expect, request as pwRequest, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

// SF02 login-hardening contract spec (RED-first: hint prop and 429 land in tasks.md T13 and T16).
// Admin credentials come from ADMIN_USERNAME / ADMIN_PASSWORD (loaded from .env.local by playwright.config.ts).
// T23 uses a throwaway username per run, so the real admin user+IP key is never locked.

const USERNAME = process.env.ADMIN_USERNAME ?? '';
const PASSWORD = process.env.ADMIN_PASSWORD ?? '';
if (!USERNAME || !PASSWORD) {
  throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set (.env.local) to run the login E2E spec.');
}
const GENERIC_ERROR = 'Credenciais inválidas.';

function throwawayUser() {
  return `e2e-sf02-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function newApi(baseURL: string): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL });
}

async function postCredentials(api: APIRequestContext, username: string, password: string) {
  const { csrfToken } = await (await api.get('/api/auth/csrf')).json();
  return api.post('/api/auth/callback/credentials', {
    form: { csrfToken, username, password, json: 'true' },
    headers: { 'X-Auth-Return-Redirect': '1' },
    maxRedirects: 0
  });
}

/** MongoDB answers when an admin can list cartridges (no in-memory fallback there). */
async function mongoReachable(baseURL: string): Promise<boolean> {
  const api = await newApi(baseURL);
  try {
    const res = await postCredentials(api, USERNAME, PASSWORD);
    const session = await (await api.get('/api/auth/session')).json();
    if (!res.ok() || !session?.user) return false;
    return (await api.get('/api/admin/cartridges')).status() === 200;
  } finally {
    await api.dispose();
  }
}

async function submitLogin(page: Page, username: string, password: string) {
  await page.getByPlaceholder('Usuário').fill(username);
  await page.getByPlaceholder('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

test.describe('SF02 login hardening', () => {
  test.beforeAll(async ({ baseURL }) => {
    // Warm the dev compile of /login and the auth routes so the first test does not race it.
    const api = await newApi(baseURL as string);
    await api.get('/login');
    await api.get('/api/auth/csrf');
    await api.dispose();
  });

  test('T22 the login page hides the default hint with configured credentials and shows the generic error', async ({ page }) => {
    await page.goto('/login?callbackUrl=/admin');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('admin123')).toHaveCount(0);
    await expect(page.getByText('Modo desenvolvimento')).toHaveCount(0);

    await submitLogin(page, throwawayUser(), 'wrong-password');
    await expect(page.getByText(GENERIC_ERROR)).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('T23 the 6th wrong login in 15 minutes gets 429 with Retry-After and the same message', async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    if (!(await mongoReachable(baseURL as string))) {
      test.info().annotations.push({ type: 'skip-reason', description: 'MongoDB not reachable: the login throttle store is off.' });
      if (process.env.CI) throw new Error('T23 needs a reachable MongoDB in CI.');
      test.skip(true, 'MongoDB not reachable: the login throttle store is off.');
    }

    const username = throwawayUser();
    const api = await newApi(baseURL as string);
    try {
      for (let i = 1; i <= 5; i += 1) {
        const res = await postCredentials(api, username, `wrong-${i}`);
        expect(res.status(), `attempt ${i}`).not.toBe(429);
      }
      const sixth = await postCredentials(api, username, 'wrong-6');
      expect(sixth.status()).toBe(429);
      const retryAfter = Number(sixth.headers()['retry-after']);
      expect(Number.isInteger(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(900);
    } finally {
      await api.dispose();
    }

    // The browser shares the same IP, so the locked key answers the form the same way.
    await page.goto('/login?callbackUrl=/admin');
    await page.waitForLoadState('networkidle');
    const callback = page.waitForResponse((res) => res.url().includes('/api/auth/callback/credentials'));
    await submitLogin(page, username, 'wrong-7');
    expect((await callback).status()).toBe(429);
    await expect(page.getByText(GENERIC_ERROR)).toBeVisible();
  });
});
