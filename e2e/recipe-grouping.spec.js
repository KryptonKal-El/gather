/**
 * Recipes "All" view grouping E2E tests for desktop-chrome project.
 * Covers the Group by control (Collection / None) and collapsible collection
 * sections, including that both choices survive a reload.
 */
import { test, expect } from '@playwright/test';

const COLLECTION_NAME = `E2E Group Collection ${Date.now()}`;
const RECIPE_NAME = `E2E Group Recipe ${Date.now()}`;

test.describe.serial('Recipe All-view grouping', () => {
  let page;

  test.skip(({ isMobile }) => isMobile, 'Desktop recipes grid flow');

  const collectionChip = () =>
    page.locator('[class*="_chip_"]').filter({ hasText: COLLECTION_NAME }).first();
  const allChip = () => page.locator('[class*="_chip_"]').filter({ hasText: /^All$/ });
  const recipeCard = () => page.getByRole('button', { name: `Options for ${RECIPE_NAME}` });
  const sectionToggle = () => page.locator('button[aria-expanded]').filter({ hasText: COLLECTION_NAME });
  const groupingOption = (name) => page.getByRole('radio', { name, exact: true });

  const openRecipes = async () => {
    await page.locator('button').filter({ hasText: 'Recipes' }).first().click();
    await expect(page.locator('[class*="_chipActive_"]').filter({ hasText: 'All' })).toBeVisible({ timeout: 10000 });
  };

  const reloadRecipes = async () => {
    await page.reload();
    // The app may reopen on either tab after a reload.
    await expect(page.locator('button').filter({ hasText: 'Recipes' }).first()).toBeVisible({ timeout: 10000 });
    await openRecipes();
  };

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Lists', exact: true })).toBeVisible({ timeout: 10000 });
    // Start from the defaults regardless of what an earlier run left behind.
    await page.evaluate(() => {
      localStorage.removeItem('gather_recipe_all_grouping');
      localStorage.removeItem('gather_recipe_collapsed_collections');
      localStorage.removeItem('gather_recipe_selected_collection');
    });
  });

  test.afterAll(async () => {
    try {
      await page.evaluate(() => {
        localStorage.removeItem('gather_recipe_all_grouping');
        localStorage.removeItem('gather_recipe_collapsed_collections');
      });
      const chip = collectionChip();
      if (await chip.isVisible({ timeout: 1000 })) {
        await chip.click();
        await page.getByRole('button', { name: `Options for ${COLLECTION_NAME}` }).click();
        await page.getByRole('button', { name: 'Delete' }).click();
        // Deleting a non-empty collection offers "delete recipes too"; take it.
        await page.getByRole('button', { name: /^Delete collection/ }).click();
        await expect(collectionChip()).toHaveCount(0, { timeout: 5000 });
      }
    } catch {
      // Swallow errors during cleanup
    }
    await page?.close();
  });

  test('sets up a collection with one recipe', async () => {
    await openRecipes();

    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'New Collection' }).click();
    await page.getByPlaceholder('Collection name...').fill(COLLECTION_NAME);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(collectionChip()).toBeVisible({ timeout: 5000 });

    await collectionChip().click();
    await page.getByRole('button', { name: `Add recipe to ${COLLECTION_NAME}` }).click();
    await page.getByRole('button', { name: /Start from scratch/ }).click();
    await page.getByPlaceholder('Recipe name').fill(RECIPE_NAME);
    await page.getByPlaceholder('Ingredient name').first().fill('Flour');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(recipeCard()).toBeVisible({ timeout: 5000 });
  });

  test('All defaults to grouping by collection', async () => {
    await allChip().click();

    await expect(groupingOption('Collection')).toHaveAttribute('aria-checked', 'true');
    await expect(sectionToggle()).toHaveAttribute('aria-expanded', 'true');
    const section = page.locator('section').filter({ has: sectionToggle() });
    await expect(section.getByRole('button', { name: `Options for ${RECIPE_NAME}` })).toBeVisible();
  });

  test('collapses a collection and keeps it collapsed after reload', async () => {
    await sectionToggle().click();
    await expect(sectionToggle()).toHaveAttribute('aria-expanded', 'false');
    await expect(recipeCard()).toHaveCount(0);

    await reloadRecipes();
    await expect(sectionToggle()).toHaveAttribute('aria-expanded', 'false');
    await expect(recipeCard()).toHaveCount(0);
  });

  test('search shows matches inside a collapsed collection', async () => {
    await page.getByPlaceholder('Search recipes & collections...').fill(RECIPE_NAME);
    await expect(recipeCard()).toBeVisible();
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(recipeCard()).toHaveCount(0);
  });

  test('expands the collection again', async () => {
    await sectionToggle().click();
    await expect(sectionToggle()).toHaveAttribute('aria-expanded', 'true');
    await expect(recipeCard()).toBeVisible();
  });

  test('Group by None shows one flat grid and persists', async () => {
    await groupingOption('None').click();
    await expect(groupingOption('None')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('button[aria-expanded]')).toHaveCount(0);
    await expect(recipeCard()).toHaveCount(1);
    const card = page.locator('[class*="_recipeCard_"]').filter({ hasText: RECIPE_NAME });
    await expect(card.locator('[class*="_cardMarker_"]')).toBeVisible();

    await reloadRecipes();
    await expect(groupingOption('None')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('button[aria-expanded]')).toHaveCount(0);

    await groupingOption('Collection').click();
    await expect(sectionToggle()).toBeVisible();
  });
});
