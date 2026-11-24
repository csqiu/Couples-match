import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Runs last (it ends the couple the other tests use): Sam leaves the couple,
 * and both partners are back at setup with a note about the ended couple.
 */
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

test('a partner leaves the couple', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/login');
  const form = page.getByTestId('dev-login');
  await form.getByLabel('Test user email').fill(env.E2E_SAM_EMAIL);
  await form.getByLabel('Test user password').fill(env.E2E_PASSWORD);
  await form.getByRole('button', { name: 'Sign in with password' }).click();
  await expect(page).toHaveURL(/\/app\//);
  await page.goto('/app/account');
  test.skip(!(await page.getByRole('button', { name: 'Leave this couple' }).isVisible()), 'Sam has no couple (run couple-flow.spec.ts first).');

  await page.getByRole('button', { name: 'Leave this couple' }).click();
  await expect(page.getByText('deleted after 30 days')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, leave the couple' }).click();
  await expect(page).toHaveURL(/\/app\/setup/);
  await expect(page.getByRole('button', { name: 'Start our couple' })).toBeVisible();

  await page.goto('/app/account');
  await expect(page.getByText(/couple ended on .* kept until/)).toBeVisible();
});
