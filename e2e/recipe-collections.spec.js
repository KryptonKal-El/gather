/**
 * Recipe collections E2E tests for desktop-chrome project.
 * Tests collection and recipe CRUD operations on desktop (1280x720 viewport).
 */
import { test, expect } from '@playwright/test';

const COLLECTION_NAME = `E2E Test Collection ${Date.now()}`;
const RECIPE_NAME = `E2E Test Recipe ${Date.now()}`;

test.describe.serial('Recipe collections', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/');
    // Wait for app to load (My Lists is the default view)
    await expect(page.getByRole('heading', { name: 'My Lists' })).toBeVisible({ timeout: 10000 });
  });

  test.afterAll(async () => {
    // Cleanup: try to delete test data if still exists
    try {
      // Navigate to Recipes tab
      const recipesTab = page.locator('button').filter({ hasText: 'Recipes' }).first();
      if (await recipesTab.isVisible({ timeout: 1000 })) {
        await recipesTab.click();
        await page.waitForTimeout(500);
      }

      // Try to find and delete test collection
      const collectionOptions = page.getByRole('button', { name: `Options for ${COLLECTION_NAME}` });
      if (await collectionOptions.isVisible({ timeout: 1000 })) {
        await collectionOptions.click();
        const deleteBtn = page.getByRole('button', { name: 'Delete' });
        if (await deleteBtn.isVisible({ timeout: 1000 })) {
          await deleteBtn.click();
          // Handle DeleteCollectionDialog - click any delete button
          const deleteConfirm = page.locator('button').filter({ hasText: /Delete/ }).first();
          if (await deleteConfirm.isVisible({ timeout: 1000 })) {
            await deleteConfirm.click();
          }
        }
      }
    } catch {
      // Swallow errors during cleanup
    }
    await page?.close();
  });

  test('navigates to Recipes tab and sees Collections heading', async () => {
    // Click the "Recipes" desktop tab
    const recipesTab = page.locator('button').filter({ hasText: 'Recipes' }).first();
    await expect(recipesTab).toBeVisible();
    await recipesTab.click();

    // Verify the "Collections" heading appears (use exact match to avoid "My Collections")
    await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('creates a new collection', async () => {
    // Click "+ New" button to open the create form
    await page.getByRole('button', { name: '+ New' }).click();

    // Fill in the collection name
    await page.getByPlaceholder('Collection name...').fill(COLLECTION_NAME);

    // Click "Create" button
    await page.getByRole('button', { name: 'Create' }).click();

    // Verify the collection appears under "My Collections"
    // Collection item shows: emoji, name, (count), chevron
    await expect(page.locator('button').filter({ hasText: COLLECTION_NAME })).toBeVisible({ timeout: 5000 });
  });

  test('opens the collection and sees recipe list view', async () => {
    // Click on the created collection to open it
    await page.locator('button').filter({ hasText: COLLECTION_NAME }).first().click();

    // Verify we're in the recipe list view:
    // - "Back" button should be visible
    // - Collection name should appear as heading
    await expect(page.locator('button').filter({ hasText: 'Back' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: COLLECTION_NAME })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ New Recipe' })).toBeVisible();
  });

  test('creates a recipe in the collection', async () => {
    // Click "+ New Recipe" button to open the RecipeForm
    await page.getByRole('button', { name: '+ New Recipe' }).click();

    // Wait for the RecipeForm to load (look for the recipe name input)
    const recipeNameInput = page.getByPlaceholder('Recipe name');
    await expect(recipeNameInput).toBeVisible({ timeout: 5000 });

    // Fill in the recipe name
    await recipeNameInput.fill(RECIPE_NAME);

    // Fill in an ingredient (there should be one default empty row)
    const ingredientNameInput = page.getByPlaceholder('Ingredient name').first();
    await expect(ingredientNameInput).toBeVisible();
    await ingredientNameInput.fill('Flour');

    const ingredientQtyInput = page.getByPlaceholder('Qty').first();
    await ingredientQtyInput.fill('2 cups');

    // Click "Save" button
    await page.getByRole('button', { name: 'Save' }).click();

    // Wait for the form to close and recipe list to show
    // The recipe should now appear in the list
    await expect(page.locator('button').filter({ hasText: RECIPE_NAME })).toBeVisible({ timeout: 5000 });
  });

  test('verifies recipe appears in collection with ingredient count', async () => {
    // Verify the created recipe shows in the list with ingredient metadata
    // Recipe items show: thumbnail, name, "X ingredients · Y steps"
    const recipeItem = page.locator('button').filter({ hasText: RECIPE_NAME });
    await expect(recipeItem).toBeVisible();

    // Check for "1 ingredients" text (grammatically incorrect but matches the code)
    await expect(page.getByText('1 ingredients')).toBeVisible();
  });

  test('deletes the test recipe', async () => {
    // Click the three-dot menu for the recipe
    const optionsBtn = page.getByRole('button', { name: `Options for ${RECIPE_NAME}` });
    await expect(optionsBtn).toBeVisible();
    await optionsBtn.click();

    // Click "Delete" in the dropdown menu (desktop uses dropdown, not action sheet)
    const deleteOption = page.getByRole('button', { name: 'Delete' });
    await expect(deleteOption).toBeVisible({ timeout: 5000 });
    await deleteOption.click();

    // Confirm in the ConfirmDialog (renders via portal to document.body)
    // Dialog message: Delete "{name}" and all its contents?
    const dialogMessage = page.getByText(`Delete "${RECIPE_NAME}" and all its contents?`);
    await expect(dialogMessage).toBeVisible({ timeout: 5000 });

    // Click the confirm "Delete" button (using CSS module selector for confirmBtn)
    const confirmBtn = page.locator('[class*="confirmBtn"]');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Wait for dialog to close
    await expect(dialogMessage).not.toBeVisible({ timeout: 5000 });

    // Due to database/realtime race conditions, reload to ensure fresh data
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'My Lists' })).toBeVisible({ timeout: 10000 });

    // Navigate back to Recipes tab and into the collection
    const recipesTab = page.locator('button').filter({ hasText: 'Recipes' }).first();
    await recipesTab.click();
    await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible({ timeout: 5000 });
    
    // Open the collection again
    await page.locator('button').filter({ hasText: COLLECTION_NAME }).first().click();
    await expect(page.locator('button').filter({ hasText: 'Back' })).toBeVisible({ timeout: 5000 });

    // Verify recipe is removed from the list
    await expect(page.locator('button').filter({ hasText: RECIPE_NAME })).not.toBeVisible({ timeout: 5000 });
  });

  test('navigates back to collections view', async () => {
    // Click the "Back" button to return to collections
    await page.locator('button').filter({ hasText: 'Back' }).click();

    // Verify "Collections" heading appears again
    await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible({ timeout: 5000 });

    // Verify the test collection is still there
    await expect(page.locator('button').filter({ hasText: COLLECTION_NAME })).toBeVisible();
  });

  test('deletes the test collection', async () => {
    // Click three-dot menu for the collection
    const optionsBtn = page.getByRole('button', { name: `Options for ${COLLECTION_NAME}` });
    await expect(optionsBtn).toBeVisible();
    await optionsBtn.click();

    // Click "Delete" in the dropdown
    const deleteOption = page.getByRole('button', { name: 'Delete' });
    await expect(deleteOption).toBeVisible({ timeout: 5000 });
    await deleteOption.click();

    // DeleteCollectionDialog opens via portal
    // Since collection is empty, it shows simple confirmation with "Delete" button
    // Look for the dialog title (uses smart quotes: " and ")
    const dialogTitle = page.getByRole('heading', { name: /Delete.*Test Collection/i });
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    // Click the "Delete" button (for empty collection, it's a simple delete)
    // The dialog has deleteBtn class for the delete button
    const deleteBtn = page.locator('[class*="deleteBtn"]');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Wait for dialog to close
    await expect(dialogTitle).not.toBeVisible({ timeout: 5000 });

    // Give database time to sync and reload to verify
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'My Lists' })).toBeVisible({ timeout: 10000 });

    // Navigate back to Recipes tab
    const recipesTab = page.locator('button').filter({ hasText: 'Recipes' }).first();
    await recipesTab.click();
    await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible({ timeout: 5000 });

    // Verify the collection is removed
    await expect(page.locator('button').filter({ hasText: COLLECTION_NAME })).not.toBeVisible({ timeout: 5000 });
  });
});
