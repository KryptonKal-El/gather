/**
 * @verification-test
 * @component ResetListItemsEmptyState
 * @location src/App.jsx
 * @location src/components/ListSelector.jsx
 * @location src/components/MobileListDetail.jsx
 * @reach / → sign in → create guest list → open list menu
 *
 * @prerequisites
 *   - Test user can sign in with Supabase email/password
 *   - Lists view loads successfully after authentication
 *   - Guest lists can be created from the desktop sidebar
 *
 * @feature-assertions
 *   - Empty guest lists expose a disabled Reset items action with the native tooltip title
 *   - Resetting an already-reset guest list shows an "Already reset" toast
 *   - The second reset path does not open a ConfirmDialog/modal for the already-reset state
 *
 * @success-criteria
 *   - Reset menu item is disabled with title "List has no items to reset"
 *   - Second reset shows the "Already reset" toast
 *   - No dialog containing "Already reset" appears
 * @generated-at 2026-04-21T00:00:00Z
 * @task-context US-007 / prd-reset-list-items
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const SCREENSHOT_DIR = 'ai-tmp/verification/screenshots';

const ensureScreenshotDir = () => {
  fs.mkdirSync(path.join(process.cwd(), SCREENSHOT_DIR), { recursive: true });
};

const captureContradiction = async (page, name: string) => {
  ensureScreenshotDir();
  if (page.isClosed()) return;
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, name),
    fullPage: true,
  });
};

const loadCredentials = () => {
  let email = process.env.E2E_TEST_EMAIL;
  let password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    const envPath = path.join(process.cwd(), 'e2e', '.env.test');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const [key, ...rest] = trimmed.split('=');
        const value = rest.join('=');
        if (key === 'E2E_TEST_EMAIL') email = email ?? value;
        if (key === 'E2E_TEST_PASSWORD') password = password ?? value;
      }
    }
  }

  if (!email || !password) {
    throw new Error('Missing E2E_TEST_EMAIL or E2E_TEST_PASSWORD for verification auth.');
  }

  return { email, password };
};

const getListButton = (page, listName: string) => {
  return page.locator('button').filter({ hasText: listName }).filter({ hasText: /\d+ items?/ }).first();
};

const createGuestList = async (page, listName: string) => {
  await page.getByRole('button', { name: '+ New' }).click();
  await page.getByRole('button', { name: 'Guest List', exact: true }).click();
  await page.getByPlaceholder('List name...').fill(listName);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(getListButton(page, listName)).toBeVisible();
};

const deleteListIfPresent = async (page, listName: string) => {
  const optionsButton = page.getByRole('button', { name: `Options for ${listName}` });

  if (!(await optionsButton.isVisible().catch(() => false))) {
    return;
  }

  await optionsButton.click();
  await page.getByRole('button', { name: 'Delete List' }).click();

  const deleteDialog = page.getByRole('alertdialog').filter({ hasText: `Delete "${listName}" and all its items?` });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole('button', { name: 'Delete' }).click();
  await expect(getListButton(page, listName)).not.toBeVisible({ timeout: 10000 });
};

const login = async (page) => {
  const { email, password } = loadCredentials();

  await page.goto('/');

  const emailInput = page.locator('input[type="email"]');
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(emailInput).not.toBeVisible({ timeout: 15000 });
  }

  await expect(page.getByRole('heading', { name: 'Lists' }).first()).toBeVisible({ timeout: 15000 });
};

const openResetMenuItem = async (page, listName: string) => {
  await page.getByRole('button', { name: `Options for ${listName}` }).click();
  return page.getByRole('button', { name: 'Reset items' });
};

const waitForResetRpc = async (page) => {
  await page.waitForResponse(
    (response) => response.url().includes('/rest/v1/rpc/reset_guest_list_rsvp')
      && response.request().method() === 'POST'
      && response.ok(),
    { timeout: 15000 }
  );
};

const waitForLoadingToFinish = async (page) => {
  const loadingText = page.getByText('Loading...', { exact: true });
  if (await loadingText.isVisible().catch(() => false)) {
    await expect(loadingText).not.toBeVisible({ timeout: 15000 });
  }
};

test.describe('US-007 reset list items verification', () => {
  test.setTimeout(90000);

  test('shows the empty guest-list tooltip on a disabled reset action', async ({ page }) => {
    ensureScreenshotDir();
    const listName = `US-007 Empty ${Date.now()}`;

    try {
      await login(page);
      await createGuestList(page, listName);

      const resetButton = await openResetMenuItem(page, listName);
      await expect(resetButton).toBeDisabled();
      await expect(resetButton).toHaveAttribute('title', 'List has no items to reset');

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'us-007-empty-reset-tooltip.png'),
        fullPage: false,
      });
    } finally {
      await page.goto('/');
      await deleteListIfPresent(page, listName);
    }
  });

  test('shows an Already reset toast without opening a modal on the second reset', async ({ page }) => {
    ensureScreenshotDir();
    const listName = `US-007 Reset ${Date.now()}`;

    try {
      await login(page);
      await createGuestList(page, listName);
      await getListButton(page, listName).click();

      const addItemInput = page.getByPlaceholder('Add an item...');
      await addItemInput.fill('Alice Reset');
      await addItemInput.press('Enter');

      await expect(page.getByText('Alice Reset', { exact: true })).toBeVisible();

      const rsvpSelect = page.getByRole('combobox').first();
      await rsvpSelect.selectOption('confirmed');
      await expect(rsvpSelect).toHaveValue('confirmed');

      const firstResetButton = await openResetMenuItem(page, listName);
      console.log('Opened first reset menu item');
      await expect(firstResetButton).toBeEnabled();
      const resetRpcPromise = waitForResetRpc(page);
      await firstResetButton.click();
      console.log('Clicked first reset menu item');

      const resetDialog = page.getByRole('alertdialog').filter({ hasText: 'Reset all 1 guests?' });
      await expect(resetDialog).toBeVisible();
      console.log('First reset dialog visible');
      await resetDialog.getByRole('button', { name: 'Reset' }).click();
      await expect(resetDialog).not.toBeVisible({ timeout: 10000 });
      await resetRpcPromise;
      console.log('First reset RPC completed');

      await expect(rsvpSelect).toHaveValue('not_invited', { timeout: 15000 });
      await expect.poll(async () => rsvpSelect.inputValue(), {
        timeout: 2500,
        intervals: [1000, 1000, 500],
      }).toBe('not_invited');
      console.log('Immediate post-reset state is not_invited');
      await expect(page.locator('span').filter({ hasText: /^Not Yet Invited$/ }).first()).toBeVisible();

      await page.reload();
      await waitForLoadingToFinish(page);
      await expect(page.getByRole('heading', { name: 'Lists' }).first()).toBeVisible({ timeout: 15000 });
      await getListButton(page, listName).click();
      console.log('Reloaded and re-opened list');

      const refreshedRsvpSelect = page.getByRole('combobox').first();
      await expect(refreshedRsvpSelect).toHaveValue('not_invited', { timeout: 15000 });
      console.log('Reloaded state remains not_invited');

      const secondResetButton = await openResetMenuItem(page, listName);
      console.log('Opened second reset menu item');
      await secondResetButton.click();
      console.log('Clicked second reset menu item');

      const alreadyResetToast = page.getByText('Already reset', { exact: true });
      await expect(alreadyResetToast).toBeVisible({ timeout: 10000 });
      console.log('Already reset toast visible');
      await expect(page.locator('[role="dialog"]', { hasText: 'Already reset' })).toHaveCount(0);
      await expect(page.locator('[role="alertdialog"]', { hasText: 'Already reset' })).toHaveCount(0);
      await expect(page.getByRole('alertdialog').filter({ hasText: 'Reset all 1 guests?' })).toHaveCount(0);
      console.log('No modal appeared for second reset');

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'us-007-already-reset-toast.png'),
        fullPage: false,
      });
    } catch (error) {
      await captureContradiction(page, 'us-007-already-reset-contradiction.png');
      throw error;
    } finally {
      if (!page.isClosed()) {
        await page.goto('/');
        await deleteListIfPresent(page, listName);
      }
    }
  });
});
