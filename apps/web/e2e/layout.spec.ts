import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Runs after couple-flow.spec.ts (which leaves Alex with a full couple) — or on any account with data.
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const SHOTS = process.env.SHOTS_DIR;

const PAGES: Array<[string, string]> = [
  ['/app/setup', 'Welcome'],
  ['/app/programs', 'My programs'],
  ['/app/rank', 'Rank and tier'],
  ['/app/compare', 'This or that'],
  ['/app/conflicts', 'Resolve conflicts'],
  ['/app/list', 'Final list'],
  ['/app/versions', 'Versions'],
];

test('every app page fits a phone screen, in light and dark mode', async ({ browser }) => {
  test.setTimeout(120_000);
  for (const scheme of ['light', 'dark'] as const) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SHOTS ? 2 : 1, isMobile: true, hasTouch: true, colorScheme: scheme });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/login');
    const form = page.getByTestId('dev-login');
    await form.getByLabel('Test user email').fill(env.E2E_ALEX_EMAIL);
    await form.getByLabel('Test user password').fill(env.E2E_PASSWORD);
    await form.getByRole('button', { name: 'Sign in with password' }).click();
    await expect(page).toHaveURL(/\/app\//);
    for (const [path, heading] of PAGES) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: new RegExp(heading) })).toBeVisible();
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} (${scheme})`).toBeLessThanOrEqual(390);
      if (SHOTS && (path === '/app/rank' || path === '/app/compare' || path === '/app/list')) {
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SHOTS}/phone-${scheme}${path.replace(/\//g, '-')}.png`, fullPage: true, caret: 'initial' });
      }
    }
    expect(errors).toEqual([]);
    await ctx.close();
  }
});
