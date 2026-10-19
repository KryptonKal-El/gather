/**
 * Typing-suggestion store label E2E tests for desktop-chrome project.
 * The same product bought at two stores appears as one suggestion row per
 * store, and picking a row adds the item under that
 * row's store even when the store picker says "No store".
 */
import { test, expect } from '@playwright/test';

const LIST_NAME = `Suggest Test ${Date.now()}`;
const ITEM_NAME = `Oatmilk${Date.now().toString().slice(-5)}`;
const STORE_A = 'Suggest Store A';
const STORE_B = 'Suggest Store B';

/**
 * Helper to get the list button locator that matches the exact list name.
 */
const getListButton = (page, listName) => {
  return page.locator('button').filter({ hasText: listName }).filter({ hasText: /\d+ items?/ });
};

/**
 * Helper for the suggestion dropdown rows (CSS modules mangle class names).
 */
const getDropdownItems = (page) => page.locator('[class*="dropdownItem"]');

test.describe.serial('Typing suggestions with stores', () => {
  let page;

  test.skip(({ isMobile }) => isMobile, 'Store manager flow is exercised on desktop');

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Lists', exact: true })).toBeVisible({ timeout: 10000 });
  });

  test.afterAll(async () => {
    try {
      const optionsBtn = page.getByRole('button', { name: `Options for ${LIST_NAME}` });
      if (await optionsBtn.isVisible({ timeout: 1000 })) {
        await optionsBtn.click();
        const deleteOption = page.getByRole('button', { name: 'Delete List' });
        if (await deleteOption.isVisible({ timeout: 1000 })) {
          await deleteOption.click();
          const confirmBtn = page.getByRole('button', { name: 'Delete' });
          if (await confirmBtn.isVisible({ timeout: 1000 })) {
            await confirmBtn.click();
          }
        }
      }
    } catch {
      // Swallow errors during cleanup
    }
    await page?.close();
  });

  test('seeds a list with two stores', async () => {
    await page.getByRole('button', { name: '+ New' }).click();
    await page.getByPlaceholder('List name...').fill(LIST_NAME);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(getListButton(page, LIST_NAME)).toBeVisible();
    await getListButton(page, LIST_NAME).click();

    await page.getByRole('button', { name: `Options for ${LIST_NAME}` }).click();
    await page.getByRole('button', { name: 'Manage Stores' }).click();

    for (const storeName of [STORE_A, STORE_B]) {
      // The store manager's "+ New" is the last one on screen (list "+ New" is first)
      await page.getByRole('button', { name: '+ New' }).last().click();
      await page.getByPlaceholder('Store name (e.g. Walmart, Costco)').fill(storeName);
      await page.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByPlaceholder('Store name (e.g. Walmart, Costco)')).toBeHidden();
    }

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('combobox', { name: 'Assign to store' })).toBeVisible();
  });

  test('adds the same item at two stores to build history', async () => {
    const input = page.getByPlaceholder('Add an item...');
    const storeSelect = page.getByRole('combobox', { name: 'Assign to store' });

    for (const storeName of [STORE_A, STORE_B]) {
      await input.fill(ITEM_NAME);
      await storeSelect.selectOption({ label: storeName });
      // Enter avoids the dropdown intercepting a click on the Add button
      await input.press('Enter');
      await expect(
        page.locator('[class*="itemWrapper"]').filter({ hasText: ITEM_NAME })
      ).toHaveCount(storeName === STORE_A ? 1 : 2);
    }
  });

  test('shows one suggestion row per store, labeled', async () => {
    const input = page.getByPlaceholder('Add an item...');
    await input.fill(ITEM_NAME.slice(0, 6));

    const rows = getDropdownItems(page).filter({ hasText: ITEM_NAME });
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: STORE_A })).toHaveCount(1);
    await expect(rows.filter({ hasText: STORE_B })).toHaveCount(1);
  });

  test('picking a store row adds the item under that store despite the picker', async () => {
    const input = page.getByPlaceholder('Add an item...');
    const storeSelect = page.getByRole('combobox', { name: 'Assign to store' });
    await storeSelect.selectOption({ label: 'No store' });

    await getDropdownItems(page).filter({ hasText: STORE_A }).click();
    await expect(input).toHaveValue(ITEM_NAME);
    await input.press('Enter');

    // The store group header carries the store name; the new item joins store A's group
    const storeAGroup = page
      .locator('section, div')
      .filter({ has: page.getByRole('heading', { name: STORE_A }) })
      .first();
    await expect(
      storeAGroup.locator('[class*="itemWrapper"]').filter({ hasText: ITEM_NAME })
    ).toHaveCount(2);
  });

  test('no-store history rows show no store label', async () => {
    const input = page.getByPlaceholder('Add an item...');
    const plainName = `${ITEM_NAME}Plain`;

    await input.fill(plainName);
    await page.getByRole('combobox', { name: 'Assign to store' }).selectOption({ label: 'No store' });
    await input.press('Enter');
    await expect(
      page.locator('[class*="itemWrapper"]').filter({ hasText: plainName })
    ).toHaveCount(1);

    await input.fill(plainName);
    const row = getDropdownItems(page).filter({ hasText: plainName });
    await expect(row).toHaveCount(1);
    await expect(row.locator('[class*="storeLabel"]')).toHaveCount(0);
  });
});
