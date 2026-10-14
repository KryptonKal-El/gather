/**
 * Eat-out deals E2E tests for desktop-chrome project.
 * Adds a "kids eat free" Tuesday-dinner deal, checks the badge shows only on
 * Tuesday dinner, uses "Eat here instead", switches the deal off, and deletes
 * it. Works three weeks ahead so it never collides with meal-plan.spec.js,
 * and removes everything it creates.
 */
import { test, expect } from '@playwright/test';

const STAMP = Date.now();
const RESTAURANT = `E2E Deal Diner ${STAMP}`;
const BADGE = `Kids eat free at ${RESTAURANT}`;
const WEEKS_AHEAD = 3;

test.describe.serial('Eat-out deals', () => {
  let page;

  test.skip(({ isMobile }) => isMobile, 'Desktop Plan tab flow');

  const days = () => page.locator('section[aria-label]').filter({ has: page.locator('h3') });
  const dinnerSlot = (dayIndex) => days().nth(dayIndex).getByRole('button', { name: /^Dinner: / });
  const eatHereButton = (dayIndex) =>
    days().nth(dayIndex).getByRole('button', { name: new RegExp(`^Eat at ${RESTAURANT} instead`) });

  const openTab = async (name) => {
    await page.locator('button').filter({ hasText: name }).first().click();
  };

  const openDeals = async () => {
    await page.getByRole('button', { name: 'Plan options' }).click();
    await page.getByRole('menuitem', { name: 'Eat-out deals' }).click();
    return page.getByRole('dialog', { name: 'Eat-out deals' });
  };

  const goAhead = async () => {
    for (let i = 0; i < WEEKS_AHEAD; i += 1) await page.getByRole('button', { name: 'Next week' }).click();
    await expect(page.getByRole('button', { name: 'Back to this week' })).toBeVisible();
  };

  const clearDinner = async (dayIndex) => {
    if ((await dinnerSlot(dayIndex).getAttribute('aria-label')) === 'Dinner: add a meal') return;
    await dinnerSlot(dayIndex).click();
    await page.getByRole('button', { name: 'Clear meal' }).click();
    await expect(dinnerSlot(dayIndex)).toHaveAccessibleName('Dinner: add a meal', { timeout: 5000 });
  };

  // Deletes every E2E deal, including ones a failed earlier run left behind.
  const deleteTestDeals = async () => {
    const dialog = await openDeals();
    const leftovers = dialog.getByRole('button', { name: /E2E Deal Diner/ });
    for (let count = await leftovers.count(); count > 0; count -= 1) {
      await leftovers.first().click();
      await dialog.getByRole('button', { name: 'Delete deal' }).click();
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(leftovers).toHaveCount(count - 1, { timeout: 5000 });
    }
    await dialog.getByRole('button', { name: 'Done' }).click();
  };

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Lists', exact: true })).toBeVisible({ timeout: 10000 });
    await openTab('Plan');
    await expect(page.getByRole('button', { name: /Plan my week/ })).toBeEnabled({ timeout: 10000 });
    await deleteTestDeals();
  });

  test.afterAll(async () => {
    try {
      await clearDinner(1);
      await deleteTestDeals();
    } catch {
      // Swallow errors during cleanup
    }
    await page?.close();
  });

  test('adds a Tuesday dinner deal', async () => {
    const dialog = await openDeals();
    await dialog.getByRole('button', { name: 'Add a deal' }).click();
    await dialog.getByLabel('Restaurant', { exact: true }).fill(RESTAURANT);
    await expect(dialog.getByLabel('Deal', { exact: true })).toHaveValue('Kids eat free');
    await dialog.getByRole('button', { name: 'Tue', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Dinner', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByRole('button', { name: 'Save' }).click();

    const row = dialog.getByRole('button', { name: new RegExp(RESTAURANT) });
    await expect(row).toBeVisible({ timeout: 5000 });
    await expect(row).toContainText('Tue · Dinner');
    await dialog.getByRole('button', { name: 'Done' }).click();
  });

  test('badges only Tuesday dinner', async () => {
    await goAhead();
    await clearDinner(1);
    await expect(days().nth(1)).toContainText(BADGE);
    await expect(eatHereButton(1)).toBeVisible();
    for (const other of [0, 2, 3, 4, 5, 6]) {
      await expect(days().nth(other)).not.toContainText(RESTAURANT);
    }
  });

  test('eats there instead', async () => {
    await eatHereButton(1).click();
    await expect(dinnerSlot(1)).toHaveAccessibleName(`Dinner: ${RESTAURANT}`, { timeout: 5000 });
    await expect(days().nth(1)).toContainText('Kids eat free');
    // The slot is already eating out, so the offer goes away
    await expect(eatHereButton(1)).toHaveCount(0);

    // The slot editor keeps the restaurant and offers the day's deal
    await dinnerSlot(1).click();
    const editor = page.getByRole('dialog', { name: /Dinner$/ });
    await expect(editor.getByLabel('Where')).toHaveValue(RESTAURANT);
    await expect(editor.getByRole('button', { name: new RegExp(BADGE) })).toHaveAttribute('aria-pressed', 'true');
    await editor.getByRole('button', { name: 'Cancel' }).click();

    await clearDinner(1);
    await expect(eatHereButton(1)).toBeVisible();
  });

  test('hides the badge once the deal is switched off', async () => {
    const dialog = await openDeals();
    await dialog.getByRole('button', { name: new RegExp(RESTAURANT) }).click();
    await dialog.getByLabel('Deal is on').uncheck();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByRole('button', { name: new RegExp(RESTAURANT) })).toContainText('Switched off', { timeout: 5000 });
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(days().nth(1)).not.toContainText(RESTAURANT);
  });

  test('deletes the deal', async () => {
    await deleteTestDeals();
    const dialog = await openDeals();
    await expect(dialog.getByRole('button', { name: new RegExp(RESTAURANT) })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Done' }).click();
  });
});
