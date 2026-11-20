import { defineConfig, devices } from '@playwright/test';

// Behind an HTTPS proxy (e.g. a sandbox), route the browser through it too; localhost stays direct.
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;

/**
 * End-to-end tests run against the dev server (dev-only password sign-in is
 * enabled there) and the real Supabase project in .env.local.
 * Reset the two test users' data first: supabase/tests/e2e-reset.sql.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
    ...devices['Desktop Chrome'],
    launchOptions: proxy ? { proxy } : {},
  },
  webServer: {
    command: 'pnpm dev --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
