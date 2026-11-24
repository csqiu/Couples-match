import { expect, test, type Browser, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Phase 8: a couple adds a program that isn't listed; an admin reviews it and
 * merges it into the listed program; an admin imports a CSV.
 *
 * Runs after couple-flow.spec.ts (one worker, files in order), which leaves Alex
 * in a couple. Programs it imports have source "e2e-import" and are removed by
 * supabase/tests/e2e-reset.sql.
 */
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const SHOTS = process.env.SHOTS_DIR;
const NEW_NAME = 'E2E Tufts Medical Center Internal Medicine';

async function signIn(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext({ deviceScaleFactor: SHOTS ? 2 : 1, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto('/login');
  const form = page.getByTestId('dev-login');
  await form.getByLabel('Test user email').fill(email);
  await form.getByLabel('Test user password').fill(env.E2E_PASSWORD);
  await form.getByRole('button', { name: 'Sign in with password' }).click();
  await page.waitForURL(/\/app/);
  return page;
}

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true, caret: 'initial' });
}

test('add a program not listed, admin merges it, admin imports a CSV', async ({ browser }) => {
  test.setTimeout(180_000);

  // --- Alex adds a program that isn't listed --------------------------------------------------
  const alex = await signIn(browser, env.E2E_ALEX_EMAIL);
  await alex.goto('/app/programs');
  test.skip(!alex.url().includes('/app/programs'), 'Run couple-flow.spec.ts first: Alex needs a couple.');

  // Typing an address that's already listed offers the listed program instead.
  await alex.getByRole('button', { name: 'Add a program not listed' }).click();
  const form = alex.getByRole('form', { name: 'Add a program not listed' });
  await form.getByLabel('Program name').fill('MGH medicine');
  await form.getByLabel('Specialty').selectOption('internal-medicine');
  await form.getByLabel('Street address').fill('55 Fruit St');
  await form.getByLabel('City').fill('Boston');
  await form.getByLabel('State').fill('MA');
  await form.getByLabel('ZIP').fill('02114');
  await form.getByRole('button', { name: 'Add program' }).click();
  await expect(form.getByText('Is it one of these?')).toBeVisible({ timeout: 30_000 });
  await expect(form.getByText('MGB-Massachusetts Gen Hosp — Internal Medicine', { exact: true })).toBeVisible();
  await shot(alex, '40-add-program-similar');
  await form.getByRole('button', { name: 'Cancel' }).click();

  // A genuinely new one is saved, located, and added to my list.
  await alex.getByRole('button', { name: 'Add a program not listed' }).click();
  await form.getByLabel('Program name').fill(NEW_NAME);
  await form.getByLabel('Hospital or institution').fill('Tufts Medical Center');
  await form.getByLabel('Specialty').selectOption('internal-medicine');
  await form.getByLabel('Street address').fill('800 Washington St');
  await form.getByLabel('City').fill('Boston');
  await form.getByLabel('State').fill('MA');
  await form.getByLabel('ZIP').fill('02111');
  await form.getByRole('button', { name: 'Add program' }).click();
  // Tufts is about a mile from other Boston programs: if one is offered, it isn't the same program.
  const added = alex.getByText(`Added ${NEW_NAME}`);
  const similar = form.getByRole('button', { name: 'No, add mine' });
  await expect(added.or(similar)).toBeVisible({ timeout: 30_000 });
  if (await similar.isVisible()) await similar.click();
  await expect(added).toBeVisible({ timeout: 30_000 });
  await expect(alex.getByRole('button', { name: `Remove ${NEW_NAME}` }).first()).toBeVisible();
  await alex.getByLabel('Search programs').fill('E2E Tufts');
  await expect(alex.getByTestId('search-results').getByText('Added by you · not checked yet')).toBeVisible();
  await shot(alex, '41-add-program-added');

  // --- The admin reviews it and merges it into a listed program -------------------------------
  const admin = await signIn(browser, env.E2E_ADMIN_EMAIL);
  await admin.goto('/admin');
  await expect(admin.getByRole('heading', { name: 'Review programs' })).toBeVisible();
  const card = admin.getByTestId('review-program').filter({ hasText: NEW_NAME });
  await expect(card.getByText('Added by a couple')).toBeVisible();
  await expect(admin.getByRole('heading', { name: /Imported, nothing flagged/ })).toBeVisible();
  await shot(admin, '42-admin-review');

  await card.getByRole('button', { name: 'Merge into…' }).click();
  await card.getByLabel(/Merge “.*” into another/).fill('Boston Univ');
  await card.getByRole('listitem').filter({ hasText: 'Boston Univ Med Ctr — Internal Medicine' }).first().getByRole('button', { name: 'Merge into this' }).click();
  await expect(admin.getByText('Merged into Boston Univ Med Ctr — Internal Medicine')).toBeVisible();
  await expect(admin.getByTestId('review-program').filter({ hasText: NEW_NAME })).toHaveCount(0);

  // Alex's list now has the listed program in its place.
  await alex.goto('/app/programs');
  await expect(alex.getByRole('button', { name: 'Remove Boston Univ Med Ctr — Internal Medicine' }).first()).toBeVisible();
  await expect(alex.getByRole('button', { name: `Remove ${NEW_NAME}` })).toHaveCount(0);

  // Couples can't open the admin area.
  const res = await alex.goto('/admin');
  expect(res?.status()).toBe(404);

  // --- The admin imports a CSV ----------------------------------------------------------------
  const csv = join(tmpdir(), 'pairwise-e2e-import.csv');
  writeFileSync(
    csv,
    [
      'name,institution,specialty,street,city,state,zip,acgme_id',
      'E2E Import Tufts Pediatrics,Tufts Medical Center,Pediatrics,800 Washington St,Boston,MA,02111,e2e-0001',
      'MGB-Massachusetts Gen Hosp Internal Medicine,MGB-Massachusetts Gen Hosp,Internal Medicine,55 Fruit St,Boston,MA,02114,',
      'Basket Weaving,Somewhere,Underwater Basket Weaving,1 Main St,Boston,MA,02111,',
    ].join('\n'),
  );
  await admin.getByRole('link', { name: 'Import' }).click();
  await admin.getByLabel('CSV file').setInputFiles(csv);
  await admin.getByLabel('Source name').fill('e2e-import');
  await admin.getByRole('button', { name: /^Check / }).click();
  const preview = admin.getByTestId('import-preview');
  await expect(preview).toBeVisible({ timeout: 60_000 });
  await expect(preview).toContainText(/3 rows → (1 new, 0 updates|0 new, 1 updates)/);
  await expect(preview).toContainText('1 skipped as possible duplicates, 1 rejected');
  await expect(preview.getByText('Specialty not recognised')).toBeVisible();
  await shot(admin, '43-admin-import-preview');
  await preview.getByRole('button', { name: 'Save 1 program' }).click();
  await expect(admin.getByText(/Saved: (1 new, 0|0 new, 1) updated/)).toBeVisible();
});
