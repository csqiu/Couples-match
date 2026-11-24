import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Accessibility pass: every page, in light and dark mode, checked with axe
 * against WCAG 2.1 A and AA (contrast included). Runs after couple-flow.spec.ts,
 * which leaves Alex with a full couple.
 */
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

const SIGNED_OUT = ['/', '/login', '/privacy'];
const COUPLE = [
  '/app/setup', '/app/programs', '/app/rank', '/app/compare', '/app/conflicts', '/app/list',
  '/app/map', '/app/versions', '/app/activity', '/app/account', '/print/list',
];
const ADMIN = ['/admin', '/admin/import'];

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  const form = page.getByTestId('dev-login');
  await form.getByLabel('Test user email').fill(email);
  await form.getByLabel('Test user password').fill(env.E2E_PASSWORD);
  await form.getByRole('button', { name: 'Sign in with password' }).click();
  await page.waitForURL(/\/app/);
}

async function scan(browser: Browser, scheme: 'light' | 'dark', paths: string[], email?: string) {
  const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  if (email) await signIn(page, email);
  const problems: string[] = [];
  for (const path of paths) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.waitForTimeout(800); // let the engine worker and maps settle
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // The map canvas and its tile attribution are drawn by MapLibre; the pair list beside it is the text alternative.
      .exclude('.maplibregl-ctrl-attrib')
      .analyze();
    for (const v of violations) {
      for (const n of v.nodes.slice(0, 3)) problems.push(`${scheme} ${path} [${v.id}] ${v.help}: ${n.target.join(' ')} ${n.failureSummary?.split('\n')[1] ?? ''}`);
    }
  }
  await ctx.close();
  return problems;
}

test('every page passes axe (WCAG 2.1 AA) in light and dark mode', async ({ browser }) => {
  test.setTimeout(240_000);
  const problems: string[] = [];
  for (const scheme of ['light', 'dark'] as const) {
    problems.push(...(await scan(browser, scheme, SIGNED_OUT)));
    problems.push(...(await scan(browser, scheme, COUPLE, env.E2E_ALEX_EMAIL)));
    problems.push(...(await scan(browser, scheme, ADMIN, env.E2E_ADMIN_EMAIL)));
  }
  expect(problems, problems.join('\n')).toEqual([]);
});
