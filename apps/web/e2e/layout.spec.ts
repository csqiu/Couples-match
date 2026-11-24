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
  ['/app/map', 'Map of your list'],
  ['/app/activity', 'Activity'],
  ['/app/account', 'Account'],
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

test('the printable list has one R3 table per partner and renders to PDF', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/login');
  const form = page.getByTestId('dev-login');
  await form.getByLabel('Test user email').fill(env.E2E_ALEX_EMAIL);
  await form.getByLabel('Test user password').fill(env.E2E_PASSWORD);
  await form.getByRole('button', { name: 'Sign in with password' }).click();
  await expect(page).toHaveURL(/\/app\//);
  await page.goto('/print/list');
  await expect(page.getByTestId('print-partner-0')).toContainText('’s R3 entries');
  const rows0 = await page.getByTestId('print-partner-0').getByRole('row').count();
  const rows1 = await page.getByTestId('print-partner-1').getByRole('row').count();
  expect(rows0).toBeGreaterThan(1);
  expect(rows1).toBe(rows0); // equal-length lists
  const pdf = await page.pdf({ format: 'Letter' });
  expect(pdf.byteLength).toBeGreaterThan(5_000);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/13-print.png`, fullPage: true, caret: 'initial' });
  await ctx.close();
});

test('map of the whole list, activity feed and account page', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await ctx.newPage();
  await page.goto('/login');
  const form = page.getByTestId('dev-login');
  await form.getByLabel('Test user email').fill(env.E2E_ALEX_EMAIL);
  await form.getByLabel('Test user password').fill(env.E2E_PASSWORD);
  await form.getByRole('button', { name: 'Sign in with password' }).click();
  await expect(page).toHaveURL(/\/app\//);

  // Map: reached from the final list; pairs drawn as lines; picking one in the list shows it.
  await page.goto('/app/list');
  await page.getByRole('link', { name: 'Map' }).click();
  await expect(page.getByRole('heading', { name: 'Map of your list' })).toBeVisible();
  const pairs = page.getByRole('list', { name: 'Pairs on the map' });
  await expect(pairs.getByRole('button').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __pairwiseMapLines?: number }).__pairwiseMapLines ?? 0)).toBeGreaterThan(0);
  await pairs.getByRole('button').first().click();
  await expect(pairs.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/^#1$/).first()).toBeVisible();
  // Hiding a band takes its pairs off the list.
  const before = await pairs.getByRole('button').count();
  const together = page.getByRole('button', { name: /Together \(\d+\)/ });
  const n = Number((await together.textContent())?.match(/\((\d+)\)/)?.[1] ?? 0);
  await together.click();
  await expect(together).toHaveAttribute('aria-pressed', 'false');
  await expect(pairs.getByRole('button')).toHaveCount(n === before ? 0 : before - n);
  if (SHOTS) {
    await together.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/50-map.png`, caret: 'initial' });
  }

  // Activity: both partners' changes, in words.
  await page.getByRole('link', { name: 'Activity' }).click();
  const feed = page.getByRole('list', { name: 'Activity' });
  await expect(feed.getByText(/^You$/).first()).toBeVisible();
  await expect(feed.getByText('Sam', { exact: true }).first()).toBeVisible();
  await expect(feed.getByText(/answered \d+ “this or that” question/).first()).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/51-activity.png`, fullPage: true, caret: 'initial' });

  // Account.
  await page.getByRole('link', { name: 'Account' }).click();
  await expect(page.getByText(env.E2E_ALEX_EMAIL)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave this couple' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete my account' })).toBeDisabled();
  await page.getByLabel('Type DELETE to confirm').fill('delete');
  await expect(page.getByRole('button', { name: 'Delete my account' })).toBeEnabled();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/52-account.png`, fullPage: true, caret: 'initial' });
  await ctx.close();
});
