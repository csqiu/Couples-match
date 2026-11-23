import { expect, test, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Credentials for the two dev-only test users live in .env.local (never committed).
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const ALEX = env.E2E_ALEX_EMAIL;
const SAM = env.E2E_SAM_EMAIL;
const PASSWORD = env.E2E_PASSWORD;
const SHOTS = process.env.SHOTS_DIR;

async function devSignIn(page: Page, email: string) {
  const form = page.getByTestId('dev-login');
  await form.getByLabel('Test user email').fill(email);
  await form.getByLabel('Test user password').fill(PASSWORD);
  await form.getByRole('button', { name: 'Sign in with password' }).click();
}

const browserErrors: string[] = [];

async function newUser(browser: Browser) {
  const ctx = await browser.newContext({ deviceScaleFactor: SHOTS ? 2 : 1, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => browserErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') browserErrors.push(`console: ${m.text()}`);
  });
  return page;
}

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true, caret: 'initial' });
}

test('two partners: setup, invite, accept, choose programs, rank and tier', async ({ browser }) => {
  // --- Alex: sign in, profile, start the couple, invite Sam ---------------------------------
  const alex = await newUser(browser);
  await alex.goto('/');
  await shot(alex, '01-landing');
  await alex.goto('/login');
  await devSignIn(alex, ALEX);
  await expect(alex).toHaveURL(/\/app\/setup/);

  await alex.getByLabel('Your name').fill('Alex');
  await alex.getByLabel('Your specialty').selectOption('internal-medicine');
  await alex.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(alex.getByText('Saved.')).toBeVisible();
  await alex.reload();

  await alex.getByRole('button', { name: 'Start our couple' }).click();
  await expect(alex.getByText('Waiting for partner')).toBeVisible();

  await alex.getByLabel('Your partner’s email').fill(SAM);
  await alex.getByRole('button', { name: 'Send invite' }).click();
  const link = alex.getByRole('textbox', { name: 'Invite link' });
  await expect(link).toBeVisible();
  const inviteUrl = await link.inputValue();
  expect(inviteUrl).toMatch(/\/invite\/[0-9a-f]{64}$/);
  await shot(alex, '02-setup-invite');

  // --- Sam: open the invite, sign in as the invited email, accept ---------------------------
  const sam = await newUser(browser);
  await sam.goto(new URL(inviteUrl).pathname);
  await expect(sam.getByText('Alex', { exact: true })).toBeVisible();
  await shot(sam, '03-invite-landing');
  await sam.getByRole('link', { name: `Sign in as ${SAM}` }).click();
  await devSignIn(sam, SAM);
  await expect(sam).toHaveURL(/\/invite\//);
  await sam.getByRole('button', { name: 'Accept and join' }).click();
  await expect(sam).toHaveURL(/\/app\/setup\?joined=1/);
  await expect(sam.getByText('You’ve joined Alex')).toBeVisible();
  await sam.getByLabel('Your name').fill('Sam');
  await sam.getByLabel('Your specialty').selectOption('pediatrics');
  await sam.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(sam.getByText('Saved.')).toBeVisible();

  // Alex now sees the couple as linked.
  await alex.reload();
  await expect(alex.getByText('Linked')).toBeVisible();

  // --- Alex: search and add programs; map shows them ---------------------------------------
  await alex.goto('/app/programs');
  const results = alex.getByTestId('search-results');
  await expect(results.getByRole('listitem').first()).toBeVisible();
  for (const name of [
    'Massachusetts General Hospital — Internal Medicine',
    'Johns Hopkins University — Internal Medicine',
    'University of California San Francisco — Internal Medicine',
    'Beth Israel Deaconess Medical Center — Internal Medicine',
  ]) {
    await alex.getByLabel('Search programs').fill(name.split(' — ')[0]);
    await alex.getByRole('button', { name: `Add ${name}` }).click();
    await expect(alex.getByRole('button', { name: `Remove ${name}` }).first()).toBeVisible();
  }
  await alex.getByLabel('Search programs').fill('');
  await expect(alex.locator('.maplibregl-canvas')).toBeVisible();
  // The pins rendered (the map's worker loaded and the program layer is drawn).
  await expect
    .poll(() => alex.evaluate(() => document.querySelector('.maplibregl-canvas')?.closest('[role=img]')?.getAttribute('aria-label')))
    .toBe('Map of 4 programs');
  await expect.poll(() => alex.evaluate(() => (window as unknown as { __pairwiseMapPins?: number }).__pairwiseMapPins ?? 0)).toBe(4);
  await expect(alex.getByText('Mine (4)')).toBeVisible();
  await alex.waitForTimeout(1500); // let tiles paint for the screenshot
  await shot(alex, '04-programs-map');

  // --- Alex: rank and tier ------------------------------------------------------------------
  await alex.goto('/app/rank');
  const board = alex.getByTestId('rank-board');
  await expect(board.getByTestId('tier-B').getByRole('listitem')).toHaveCount(4);

  await alex.getByLabel('Tier for Massachusetts General Hospital — Internal Medicine').selectOption('A');
  await expect(board.getByTestId('tier-A').getByText('Massachusetts General Hospital — Internal Medicine', { exact: true })).toBeVisible();
  await expect(alex.getByText('Moved Massachusetts General Hospital — Internal Medicine to Tier A')).toBeVisible();

  await alex.getByLabel('Tier for University of California San Francisco — Internal Medicine').selectOption('A');
  await alex.getByRole('button', { name: 'Move University of California San Francisco — Internal Medicine up' }).click();
  await expect(board.getByTestId('tier-A').getByRole('listitem').first()).toContainText('University of California San Francisco');

  await alex.getByLabel('Tier for Beth Israel Deaconess Medical Center — Internal Medicine').selectOption('C');
  await alex.getByRole('switch', { name: 'Beth Israel Deaconess Medical Center — Internal Medicine is acceptable' }).click();

  const code = alex.getByLabel('NRMP code for Johns Hopkins University — Internal Medicine');
  await code.fill('12345');
  await code.blur();
  await expect(code).toHaveAttribute('aria-invalid', 'true');
  await code.fill('1234140C0');
  await code.blur();
  await expect(code).toHaveAttribute('aria-invalid', 'false');
  await expect(alex.getByText('Saved code 1234140C0 for Johns Hopkins University — Internal Medicine')).toBeVisible();

  // Keyboard drag: pick up Hopkins, move it up into Tier A, drop.
  const handle = alex.getByRole('button', { name: 'Drag Johns Hopkins University — Internal Medicine' });
  await handle.focus();
  // Human pacing: dnd-kit needs a moment to pick the item up and to settle after each move.
  await alex.keyboard.press('Space');
  await alex.waitForTimeout(300);
  await alex.keyboard.press('ArrowUp');
  await alex.waitForTimeout(300);
  await alex.keyboard.press('Space');
  await expect(board.getByTestId('tier-A').getByText('Johns Hopkins University — Internal Medicine', { exact: true })).toBeVisible();
  await expect(alex.getByText('Moved Johns Hopkins University — Internal Medicine to Tier A')).toBeVisible();

  // Everything persisted: reload and check the order.
  await alex.reload();
  const order = await board.locator('li p.truncate.text-sm').allInnerTexts();
  expect(order).toEqual([
    'University of California San Francisco — Internal Medicine',
    'Massachusetts General Hospital — Internal Medicine',
    'Johns Hopkins University — Internal Medicine',
    'Beth Israel Deaconess Medical Center — Internal Medicine',
  ]);
  await expect(alex.getByLabel('NRMP code for Johns Hopkins University — Internal Medicine')).toHaveValue('1234140C0');
  await shot(alex, '05-rank-board');

  // --- Sam sees Alex's programs on the map, and Alex's presence --------------------------------
  await sam.goto('/app/programs');
  await expect(sam.getByText('Alex (4)')).toBeVisible();
  // Presence over the private couple channel (also proves its access policy admits members).
  await expect(sam.getByText('Alex is ranking')).toBeVisible({ timeout: 30_000 });

  // Live sync: Alex removes a program; Sam's page updates without a reload.
  await alex.getByRole('button', { name: 'Remove Beth Israel Deaconess Medical Center — Internal Medicine' }).click();
  await expect(alex.getByText('Removed Beth Israel Deaconess Medical Center — Internal Medicine')).toBeVisible();
  await expect(sam.getByText('Alex (3)')).toBeVisible({ timeout: 20_000 });
  await shot(sam, '08-partner-view-live');

  // --- Phase 6: Sam builds a list so there are pairs to compare ------------------------------
  for (const name of ['Boston Children\'s Hospital — Pediatrics', 'Children\'s National Hospital — Pediatrics', 'University of California San Francisco — Pediatrics']) {
    await sam.getByLabel('Search programs').fill(name.split(' — ')[0]);
    await sam.getByRole('button', { name: `Add ${name}` }).click();
    await expect(sam.getByRole('button', { name: `Remove ${name}` }).first()).toBeVisible();
  }
  await sam.goto('/app/rank');
  await sam.getByLabel('Tier for Boston Children\'s Hospital — Pediatrics').selectOption('A');
  await expect(sam.getByText('Moved Boston Children\'s Hospital — Pediatrics to Tier A')).toBeVisible();
  // Alex keeps one non-Tier-A program, so the Tier A priority question arises.
  await alex.getByLabel('Tier for Massachusetts General Hospital — Internal Medicine').selectOption('B');
  await expect(alex.getByText('Moved Massachusetts General Hospital — Internal Medicine to Tier B')).toBeVisible();

  // --- Step 4: this or that ---------------------------------------------------------------------
  await alex.goto('/app/compare');
  const choose = alex.getByRole('button', { name: 'Choose this pair' });
  await expect(choose).toHaveCount(2);
  await expect(alex.getByTestId('confidence')).toHaveText(/\d+%/);
  const answered = alex.getByText(/\d+ answers? so far/);
  await expect(answered).toHaveText(/^0 answers/);
  await choose.first().click();
  await expect(answered).toHaveText(/^1 answer /);
  await alex.getByRole('switch', { name: 'I’m certain' }).click();
  await choose.nth(1).click();
  await expect(answered).toHaveText(/^2 answers/);
  await alex.getByRole('button', { name: 'Undo last' }).click();
  await expect(answered).toHaveText(/^1 answer /);
  await alex.waitForTimeout(1500); // mini-maps paint
  await shot(alex, '09-compare');

  // --- Step 5: Tier A priority ------------------------------------------------------------------
  await alex.goto('/app/conflicts');
  await expect(alex.getByRole('heading', { name: 'Who gets priority for Tier A?' })).toBeVisible();
  await shot(alex, '10-conflicts');
  await alex.getByRole('button', { name: 'Alex gets priority' }).click();
  await expect(alex.getByText('No conflicts')).toBeVisible();

  // --- Answering separately: a disagreement, settled together -----------------------------------
  await alex.goto('/app/setup');
  await alex.getByText('Separately', { exact: true }).click();
  await alex.getByRole('button', { name: 'Save settings' }).click();
  await expect(alex.getByText('Settings saved.')).toBeVisible();
  await alex.goto('/app/compare');
  await expect(alex.getByRole('button', { name: 'Choose this pair' })).toHaveCount(2);
  await alex.getByRole('button', { name: 'Choose this pair' }).first().click();
  await expect(alex.getByText(/^2 answers/)).toBeVisible();
  await expect(alex.getByTestId('save-status')).toHaveText('All answers saved.');

  await sam.goto('/app/compare');
  await expect(sam.getByText('Alex answered this one')).toBeVisible();
  await sam.getByRole('button', { name: 'Choose this pair' }).nth(1).click();
  await expect(sam.getByTestId('save-status')).toHaveText('All answers saved.');
  await sam.goto('/app/conflicts');
  await expect(sam.getByRole('heading', { name: 'You answered differently' })).toBeVisible();
  await expect(sam.getByText(/Sam \(you\) picked the second pair/)).toBeVisible();
  await sam.getByRole('button', { name: 'We choose this pair' }).first().click();
  await expect(sam.getByText('No conflicts')).toBeVisible();

  // Phone width: no sideways scrolling on any app page.
  const phoneCheck = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await alex.context().storageState() });
  const pp = await phoneCheck.newPage();
  for (const path of ['/app/setup', '/app/programs', '/app/rank', '/app/compare', '/app/conflicts']) {
    await pp.goto(path);
    await pp.waitForLoadState('networkidle');
    expect(await pp.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(390);
  }

  expect(browserErrors).toEqual([]);

  // Dark mode and phone width, for the record.
  if (SHOTS) {
    await alex.emulateMedia({ colorScheme: 'dark' });
    await alex.evaluate(() => localStorage.setItem('pairwise-theme', 'dark'));
    await alex.reload();
    await shot(alex, '06-rank-board-dark');
    const phone = await browser.newContext({ ...{ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, storageState: await alex.context().storageState() });
    const p = await phone.newPage();
    await p.goto('/app/rank');
    await expect(p.getByTestId('rank-board')).toBeVisible();
    await shot(p, '07-rank-board-phone');
  }
});
