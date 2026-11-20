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

async function newUser(browser: Browser) {
  const ctx = await browser.newContext({ deviceScaleFactor: SHOTS ? 2 : 1, viewport: { width: 1280, height: 900 } });
  return ctx.newPage();
}

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
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

  // Keyboard drag: pick up Hopkins, move it up into Tier A, drop.
  const handle = alex.getByRole('button', { name: 'Drag Johns Hopkins University — Internal Medicine' });
  await handle.focus();
  await alex.keyboard.press('Space');
  await alex.keyboard.press('ArrowUp');
  await alex.keyboard.press('Space');
  await expect(board.getByTestId('tier-A').getByText('Johns Hopkins University — Internal Medicine', { exact: true })).toBeVisible();
  await alex.waitForTimeout(1000);

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
  const presence = await sam.getByText('Alex is ranking').isVisible({ timeout: 10_000 }).catch(() => false);
  console.log(`presence visible to Sam: ${presence}`);

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
