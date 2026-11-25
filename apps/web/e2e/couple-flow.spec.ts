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

test('two partners: setup, invite, accept, choose programs, rank and tier, compare, resolve conflicts', async ({ browser }) => {
  test.setTimeout(240_000);
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
    'MGB-Massachusetts Gen Hosp — Internal Medicine',
    'Johns Hopkins Hosp — Internal Medicine',
    'UC San Francisco — Internal Medicine',
    'B I Deaconess Med Ctr — Internal Medicine',
  ]) {
    await alex.getByLabel('Search programs').fill(name.split(' — ')[0]);
    await alex.getByRole('button', { name: `Add ${name}`, exact: true }).click();
    await expect(alex.getByRole('button', { name: `Remove ${name}` }).first()).toBeVisible();
  }
  await alex.getByLabel('Search programs').fill('');
  await expect(alex.locator('.maplibregl-canvas')).toBeVisible();
  // The pins rendered (the map's worker loaded and the program layer is drawn).
  await expect
    .poll(() => alex.evaluate(() => document.querySelector('[role=region][aria-label^="Map of"]')?.getAttribute('aria-label')))
    .toBe('Map of 4 programs');
  await expect.poll(() => alex.evaluate(() => (window as unknown as { __pairwiseMapPins?: number }).__pairwiseMapPins ?? 0)).toBe(4);
  await expect(alex.getByText('Mine (4)')).toBeVisible();
  await alex.waitForTimeout(1500); // let tiles paint for the screenshot
  await shot(alex, '04-programs-map');

  // --- Alex: rank and tier ------------------------------------------------------------------
  await alex.goto('/app/rank');
  const board = alex.getByTestId('rank-board');
  await expect(board.getByTestId('tier-B').getByRole('listitem')).toHaveCount(4);

  await alex.getByLabel('Tier for MGB-Massachusetts Gen Hosp — Internal Medicine').selectOption('A');
  await expect(board.getByTestId('tier-A').getByText('MGB-Massachusetts Gen Hosp — Internal Medicine', { exact: true })).toBeVisible();

  await alex.getByLabel('Tier for UC San Francisco — Internal Medicine').selectOption('A');
  await alex.getByRole('button', { name: 'Move UC San Francisco — Internal Medicine up' }).click();
  await expect(board.getByTestId('tier-A').getByRole('listitem').first()).toContainText('UC San Francisco');

  await alex.getByLabel('Tier for B I Deaconess Med Ctr — Internal Medicine').selectOption('C');
  await alex.getByRole('switch', { name: 'B I Deaconess Med Ctr — Internal Medicine is acceptable' }).click();

  // Directory programs come with their official NRMP code: shown, nothing to type.
  await expect(board.getByRole('listitem').filter({ hasText: 'Johns Hopkins Hosp — Internal Medicine' }).getByText('1242140C0')).toBeVisible();

  // Keyboard drag: pick up Hopkins, move it up into Tier A, drop.
  const handle = alex.getByRole('button', { name: 'Drag Johns Hopkins Hosp — Internal Medicine' });
  await handle.focus();
  // Human pacing: dnd-kit needs a moment to pick the item up and to settle after each move.
  await alex.keyboard.press('Space');
  await alex.waitForTimeout(300);
  await alex.keyboard.press('ArrowUp');
  await alex.waitForTimeout(300);
  await alex.keyboard.press('Space');
  await expect(board.getByTestId('tier-A').getByText('Johns Hopkins Hosp — Internal Medicine', { exact: true })).toBeVisible();
  await expect(board.getByTestId('tier-A').getByText('Johns Hopkins Hosp — Internal Medicine', { exact: true })).toBeVisible();

  // Everything persisted: reload and check the order.
  await alex.reload();
  const order = await board.locator('li p.truncate.text-sm').allInnerTexts();
  expect(order).toEqual([
    'UC San Francisco — Internal Medicine',
    'MGB-Massachusetts Gen Hosp — Internal Medicine',
    'Johns Hopkins Hosp — Internal Medicine',
    'B I Deaconess Med Ctr — Internal Medicine',
  ]);
  await shot(alex, '05-rank-board');

  // --- Sam sees Alex's programs on the map, and Alex's presence --------------------------------
  await sam.goto('/app/programs');
  await expect(sam.getByText('Alex (4)')).toBeVisible();
  // Presence over the private couple channel (also proves its access policy admits members).
  await expect(sam.getByText('Alex is ranking')).toBeVisible({ timeout: 30_000 });

  // Live sync: Alex removes a program; Sam's page updates without a reload.
  await alex.getByRole('button', { name: 'Remove B I Deaconess Med Ctr — Internal Medicine' }).click();
  await expect(alex.getByText('Removed B I Deaconess Med Ctr — Internal Medicine')).toBeVisible();
  await expect(sam.getByText('Alex (3)')).toBeVisible({ timeout: 20_000 });
  await shot(sam, '08-partner-view-live');

  // --- Phase 6: Sam builds a list so there are pairs to compare ------------------------------
  for (const name of ['Boston Childrens Hospital — Pediatrics', 'Childrens National Med Ctr — Pediatrics', 'UC San Francisco — Pediatrics']) {
    await sam.getByLabel('Search programs').fill(name.split(' — ')[0]);
    await sam.getByRole('button', { name: `Add ${name}`, exact: true }).click();
    await expect(sam.getByRole('button', { name: `Remove ${name}` }).first()).toBeVisible();
  }
  await sam.goto('/app/rank');
  await sam.getByLabel('Tier for Boston Childrens Hospital — Pediatrics').selectOption('A');
  await expect(sam.getByTestId('tier-A').getByText('Boston Childrens Hospital — Pediatrics', { exact: true })).toBeVisible();
  // Alex keeps one non-Tier-A program, so the Tier A priority question arises.
  await alex.getByLabel('Tier for MGB-Massachusetts Gen Hosp — Internal Medicine').selectOption('B');
  await expect(alex.getByTestId('tier-B').getByText('MGB-Massachusetts Gen Hosp — Internal Medicine', { exact: true })).toBeVisible();

  // --- Step 4: this or that ---------------------------------------------------------------------
  await alex.goto('/app/compare');
  const choose = alex.getByRole('button', { name: 'Choose this pair' });
  await expect(choose).toHaveCount(2);
  await expect(alex.getByTestId('confidence')).toHaveText(/\d+%/);
  const answered = alex.getByText(/\d+ answers? so far/);
  await expect(answered).toHaveText(/^0 answers/);
  await choose.first().click();
  await expect(answered).toHaveText(/^1 answer /);
  await alex.getByRole('button', { name: 'Strong preference for this pair' }).nth(1).click();
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
  // Each card says who picked it, in that partner's colour.
  await expect(sam.getByText('Alex picked this')).toBeVisible();
  await expect(sam.getByText('Sam picked this')).toBeVisible();
  await sam.getByRole('button', { name: 'We choose this pair' }).first().click();
  await expect(sam.getByText('No conflicts')).toBeVisible();

  // --- Step 6: final list, versions, export ------------------------------------------------------
  await alex.goto('/app/list');
  const finalList = alex.getByTestId('final-list');
  await expect(finalList.getByRole('listitem').first()).toBeVisible();
  expect(await finalList.getByRole('listitem').count()).toBeGreaterThan(5);
  await expect(finalList.getByRole('listitem').first()).toHaveAttribute('data-band', /together|commutable|drivable|apart/);
  // A row opens its details card (full names, codes, why it's there) on tap.
  await finalList.getByRole('button', { name: /^Rank 2: .*Show details\.$/ }).click();
  const details = alex.getByRole('dialog', { name: /^Rank 2:/ });
  await expect(details).toContainText('Why here:');
  await alex.keyboard.press('Escape');
  await expect(details).toBeHidden();
  await expect(alex.getByTestId('fees')).toContainText('Alex: $');
  await expect(alex.getByTestId('checklist')).toContainText('No Match pairs are at the bottom');

  // Length slider, by keyboard: Home (just the No Match rows) then four steps right = four pairs where both match.
  const slider = alex.getByLabel(/List length/);
  const min = Number(await slider.getAttribute('min'));
  const n = min + 4;
  await slider.focus();
  await alex.keyboard.press('Home');
  for (let i = 0; i < 4; i++) await alex.keyboard.press('ArrowRight');
  await expect(alex.getByText(`List length: ${n} ranks`)).toBeVisible();
  await expect(finalList.getByRole('listitem')).toHaveCount(n);
  await expect(finalList.getByRole('listitem').filter({ has: alex.getByLabel('Locked') })).toHaveCount(min);
  await expect(alex.getByTestId('available')).toContainText('other pair');

  const [csvDownload] = await Promise.all([alex.waitForEvent('download'), alex.getByRole('button', { name: 'CSV' }).click()]);
  const csv = readFileSync(await csvDownload.path(), 'utf8');
  expect(csv.split('\n')[0]).toBe('Rank,Alex program,Alex NRMP code,Sam program,Sam NRMP code,Distance (mi),Band');
  expect(csv.trim().split('\n')).toHaveLength(n + 1);

  await alex.getByLabel('Version name').fill('v1');
  await alex.getByRole('button', { name: 'Save version' }).click();
  await expect(alex.getByText('Saved “v1”.')).toBeVisible();
  await alex.waitForTimeout(1500);
  await shot(alex, '11-final-list');

  // Drag rank 3 above rank 2 by keyboard: either allowed (saved as a pin) or blocked with reasons, then overridden.
  const rowHandle = alex.getByRole('button', { name: 'Drag rank 3' });
  await rowHandle.focus();
  await alex.keyboard.press('Space');
  await alex.waitForTimeout(300);
  await alex.keyboard.press('ArrowUp');
  await alex.waitForTimeout(300);
  await alex.keyboard.press('Space');
  const blockedDialog = alex.getByRole('alertdialog');
  const moved = alex.getByText('Moved. Saved as your ordering.');
  await expect(blockedDialog.or(moved).first()).toBeVisible();
  if (await blockedDialog.isVisible()) {
    await expect(blockedDialog).toContainText('because');
    await alex.getByRole('button', { name: 'Override with an exception' }).click();
    await expect(moved).toBeVisible();
  }
  await alex.getByLabel('Version name').fill('v2');
  await alex.getByRole('button', { name: 'Save version' }).click();
  await expect(alex.getByText('Saved “v2”.')).toBeVisible();

  await alex.goto('/app/versions');
  await expect(alex.getByTestId('versions').getByRole('listitem')).toHaveCount(2);
  // Versions freeze exactly the ranks shown, even though the slider saves after a pause.
  await expect(alex.getByTestId('versions').getByRole('listitem').filter({ hasText: 'v1' })).toContainText(`${n} ranks`);
  await alex.getByLabel('Older').selectOption({ label: 'v1' });
  await alex.getByLabel('Newer').selectOption({ label: 'v2' });
  await alex.getByRole('button', { name: 'Compare' }).click();
  await expect(alex.getByTestId('diff')).toContainText('v1 → v2: 2 moved, 0 added, 0 removed');
  await shot(alex, '12-versions-diff');

  await alex.getByRole('button', { name: 'Restore v1' }).click();
  await alex.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(alex.getByText('Restored “v1”.')).toBeVisible();
  await alex.reload();
  await expect(alex.getByTestId('versions').getByRole('listitem')).toHaveCount(3); // the current list was saved first
  await expect(alex.getByTestId('versions').getByText('Before restoring “v1”')).toBeVisible();

  expect(browserErrors).toEqual([]);

});
