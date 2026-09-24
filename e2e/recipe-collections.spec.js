/**
 * Recipe collections E2E tests for desktop-chrome project.
 * Tests collection and recipe CRUD on the card-grid recipes view
 * (collections are filter chips above a recipe card grid; selecting a
 * chip shows a collection header with add/options actions, and recipes
 * are created via the header's "Add recipe to X" button).
 */
import { test, expect } from '@playwright/test';

const COLLECTION_NAME = `E2E Test Collection ${Date.now()}`;
const RECIPE_NAME = `E2E Test Recipe ${Date.now()}`;

test.describe.serial('Recipe collections', () => {
  let page;

  test.skip(({ isMobile }) => isMobile, 'Desktop recipes grid flow');

  const collectionChip = () =>
    page.locator('[class*="_chip_"]').filter({ hasText: COLLECTION_NAME }).first();

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Lists', exact: true })).toBeVisible({ timeout: 10000 });
  });

  test.afterAll(async () => {
    // Cleanup: try to delete test data if still exists
    try {
      const chip = collectionChip();
      if (await chip.isVisible({ timeout: 1000 })) {
        await chip.click();
        const collectionOptions = page.getByRole('button', { name: `Options for ${COLLECTION_NAME}` });
        if (await collectionOptions.isVisible({ timeout: 1000 })) {
          await collectionOptions.click();
          const deleteBtn = page.getByRole('button', { name: 'Delete' });
          if (await deleteBtn.isVisible({ timeout: 1000 })) {
            await deleteBtn.click();
            const deleteConfirm = page.locator('button').filter({ hasText: /Delete/ }).last();
            if (await deleteConfirm.isVisible({ timeout: 1000 })) {
              await deleteConfirm.click();
            }
          }
        }
      }
    } catch {
      // Swallow errors during cleanup
    }
    await page?.close();
  });

  test('navigates to Recipes tab and sees the chip-filtered grid', async () => {
    const recipesTab = page.locator('button').filter({ hasText: 'Recipes' }).first();
    await expect(recipesTab).toBeVisible();
    await recipesTab.click();

    // The grid view always shows the "All" filter chip, active by default,
    // plus a chip for the built-in My Recipes collection
    await expect(page.locator('[class*="_chipActive_"]').filter({ hasText: 'All' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[class*="_chip_"]').filter({ hasText: 'My Recipes' }).first()).toBeVisible();
  });

  test('creates a new collection', async () => {
    // "+ Add" opens a menu with New Recipe / New Collection
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'New Collection' }).click();

    await page.getByPlaceholder('Collection name...').fill(COLLECTION_NAME);
    await page.getByRole('button', { name: 'Create' }).click();

    // The new collection appears as a filter chip
    await expect(collectionChip()).toBeVisible({ timeout: 5000 });
  });

  test('creates a recipe in the collection', async () => {
    // Select the collection chip; its header card appears with an add button
    await collectionChip().click();
    await page.getByRole('button', { name: `Add recipe to ${COLLECTION_NAME}` }).click();

    // New Recipe modal: choose manual entry
    await page.getByRole('button', { name: /Start from scratch/ }).click();

    const recipeNameInput = page.getByPlaceholder('Recipe name');
    await expect(recipeNameInput).toBeVisible({ timeout: 5000 });
    await recipeNameInput.fill(RECIPE_NAME);

    // At least one named ingredient is required to save
    await page.getByPlaceholder('Ingredient name').first().fill('Flour');
    await page.getByPlaceholder('Qty').first().fill('2 cups');

    await page.getByRole('button', { name: 'Save' }).click();

    // The recipe appears as a card in the collection's grid
    await expect(page.getByRole('button', { name: `Options for ${RECIPE_NAME}` })).toBeVisible({ timeout: 5000 });
  });

  test('verifies recipe card shows ingredient count', async () => {
    // Cards show "X ingredients · Y steps" metadata; scope to this recipe's
    // card so other recipes with one ingredient don't collide
    const recipeCard = page.locator('[class*="_recipeCard_"]').filter({ hasText: RECIPE_NAME }).first();
    await expect(recipeCard).toContainText('1 ingredients');
  });

  test('lists the recipe once in the All grid', async () => {
    await page.locator('[class*="_chip_"]').filter({ hasText: /^All$/ }).click();
    await expect(page.locator('[class*="_chipActive_"]').filter({ hasText: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: `Options for ${RECIPE_NAME}` })).toHaveCount(1);
    await collectionChip().click();
  });

  test('deletes the test recipe', async () => {
    await page.getByRole('button', { name: `Options for ${RECIPE_NAME}` }).click();

    // Options menu: Edit / Move to Collection / Delete
    await page.getByRole('button', { name: 'Delete' }).click();

    // ConfirmDialog renders via portal to document.body
    const dialogMessage = page.getByText(`Delete "${RECIPE_NAME}" and all its contents?`);
    await expect(dialogMessage).toBeVisible({ timeout: 5000 });

    const confirmBtn = page.locator('[class*="confirmBtn"]');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();
    await expect(dialogMessage).not.toBeVisible({ timeout: 5000 });

    await expect(page.getByRole('button', { name: `Options for ${RECIPE_NAME}` })).not.toBeVisible({ timeout: 5000 });
  });

  test('deletes the test collection', async () => {
    // The collection is still selected; delete via its header options menu
    await page.getByRole('button', { name: `Options for ${COLLECTION_NAME}` }).click();

    // Options menu: Rename / Share / Delete
    await page.getByRole('button', { name: 'Delete' }).click();

    // DeleteCollectionDialog opens via portal; for an empty collection it is a
    // simple confirmation with a delete button
    const dialogTitle = page.getByRole('heading', { name: /Delete.*Test Collection/i });
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    const deleteBtn = page.locator('[class*="deleteBtn"]');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();
    await expect(dialogTitle).not.toBeVisible({ timeout: 5000 });

    // The chip disappears and the view falls back to the All grid
    await expect(collectionChip()).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('[class*="_chipActive_"]').filter({ hasText: 'All' })).toBeVisible();
  });
});
