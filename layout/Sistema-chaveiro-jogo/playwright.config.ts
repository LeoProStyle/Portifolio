import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

// Admin credentials and the rest of the env come from .env.local (values are never printed).
// The suite creates and deletes `e2e-*` records and login attempts. It always uses the separate
// `retrokey_e2e` database on the cluster MONGODB_URI points to, never the production database:
// the value is set before .env.local loads, and an already-set variable is never overridden,
// so the MONGODB_DB line in .env.local cannot win. The dev servers inherit it.
export const E2E_MONGODB_DB = 'retrokey_e2e';
process.env.MONGODB_DB = E2E_MONGODB_DB;
const envFile = resolve(__dirname, '.env.local');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const MAIN_PORT = 3001;
const NO_MONGO_PORT = 3002;

// The 3002 server (T17, no MongoDB) is only started when its project can run:
// no --project flag at all, or an explicit --project=no-mongo.
// Both dev servers write to the same .next folder (no distDir override exists), so run the
// projects one at a time: `--project=main`, then `--project=no-mongo`.
const argv = process.argv.join(' ');
const projectFlagged = /--project/.test(argv);
const wantsNoMongo = !projectFlagged || /no-mongo/.test(argv);
const wantsMain = !projectFlagged || /--project[= ]"?main/.test(argv);

const webServer = [
  ...(wantsMain
    ? [
        {
          command: 'npm run dev',
          url: `http://localhost:${MAIN_PORT}/login`,
          reuseExistingServer: true,
          timeout: 120_000
        }
      ]
    : []),
  ...(wantsNoMongo
    ? [
        {
          command: `npx next dev -p ${NO_MONGO_PORT}`,
          url: `http://localhost:${NO_MONGO_PORT}/login`,
          reuseExistingServer: true,
          timeout: 120_000,
          // Empty value wins over .env.local (Next never overrides an already-set variable),
          // so getDb() throws and the in-memory fallback answers.
          env: { ...(process.env as Record<string, string>), MONGODB_URI: '' }
        }
      ]
    : [])
];

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.qa.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${MAIN_PORT}`,
    trace: 'off'
  },
  webServer,
  projects: [
    { name: 'main', use: { baseURL: `http://localhost:${MAIN_PORT}` } },
    { name: 'no-mongo', use: { baseURL: `http://localhost:${NO_MONGO_PORT}` } }
  ]
});
