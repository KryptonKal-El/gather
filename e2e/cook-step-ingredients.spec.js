/**
 * Cook mode ingredient reference E2E tests for desktop-chrome project.
 * Each step lists the ingredients it mentions with their amounts, and the
 * Ingredients panel shows the full list (keeping gathered checkmarks) without
 * leaving the current step.
 */
import { test, expect } from '@playwright/test';

const COLLECTION_NAME = `E2E StepIng Collection ${Date.now()}`;
const RECIPE_NAME = `E2E StepIng Recipe ${Date.now()}`;

const INGREDIENTS = [
  ['Rice', '1 cup'],
  ['Water', '2 cups'],
  ['Salt', '1 tsp'],
];
const STEPS = [
  'Rinse the rice.',
  'Add the water and salt, then bring to a boil.',
  'Cover and simmer until tender.',
];

test.describe.serial('Cook mode ingredient reference', () => {
  let page;

  test.skip(({ isMobile }) => isMobile, 'Desktop recipes grid flow');

  const collectionChip = () =>
    page.locator('[class*="_chip_"]').filter({ hasText: COLLECTION_NAME }).first();
  const overlay = () => page.locator('[class*="_overlay_"]');
  const stepSection = () => overlay().getByRole('region', { name: 'Ingredients for this step' });
  const panel = () => page.getByRole('dialog', { name: 'Ingredients' });

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Lists', exact: true })).toBeVisible({ timeout: 10000 });
  });

  test.afterAll(async () => {
    try {
      const discard = overlay().getByRole('button', { name: 'Discard' });
      if (await discard.isVisible({ timeout: 1000 })) {
        await discard.click();
        await page.locator('[class*="confirmBtn"]').click();
      }
      const chip = collectionChip();
      if (await chip.isVisible({ timeout: 2000 })) {
        await chip.click();
        await page.getByRole('button', { name: `Options for ${COLLECTION_NAME}` }).click();
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: /^Delete collection/ }).click();
        await expect(collectionChip()).toHaveCount(0, { timeout: 5000 });
      }
    } catch {
      // Swallow errors during cleanup
    }
    await page?.close();
  });

  test('creates a recipe with three ingredients and three steps', async () => {
    await page.locator('button').filter({ hasText: 'Recipes' }).first().click();
    await expect(page.locator('[class*="_chipActive_"]').filter({ hasText: 'All' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'New Collection' }).click();
    await page.getByPlaceholder('Collection name...').fill(COLLECTION_NAME);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(collectionChip()).toBeVisible({ timeout: 5000 });

    await collectionChip().click();
    await page.getByRole('button', { name: `Add recipe to ${COLLECTION_NAME}` }).click();
    await page.getByRole('button', { name: /Start from scratch/ }).click();
    await page.getByPlaceholder('Recipe name').fill(RECIPE_NAME);

    const nameInputs = page.getByPlaceholder('Ingredient name');
    while ((await nameInputs.count()) < INGREDIENTS.length) {
      await page.getByRole('button', { name: '+ Add ingredient' }).click();
    }
    for (const [i, [name, qty]] of INGREDIENTS.entries()) {
      await nameInputs.nth(i).fill(name);
      await page.getByPlaceholder('Qty').nth(i).fill(qty);
    }

    const stepInputs = page.getByPlaceholder('Step instruction');
    while ((await stepInputs.count()) < STEPS.length) {
      await page.getByRole('button', { name: '+ Add step' }).click();
    }
    for (const [i, text] of STEPS.entries()) {
      await stepInputs.nth(i).fill(text);
    }

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: `Options for ${RECIPE_NAME}` })).toBeVisible({ timeout: 5000 });
  });

  test('step 1 lists only the ingredient it mentions, with its amount', async () => {
    await page.locator('[class*="_recipeCard_"]').filter({ hasText: RECIPE_NAME }).first().click();
    await page.getByRole('button', { name: /Start Cooking/ }).click();

    await expect(overlay().getByRole('heading', { name: 'Gather your ingredients' })).toBeVisible({ timeout: 5000 });
    // Gather rice only, so the panel can prove it keeps the checkmark.
    await overlay().getByRole('checkbox').first().check();
    await overlay().getByRole('button', { name: /Begin Cooking/ }).click();

    await expect(overlay().getByText('Step 1 of 3')).toBeVisible({ timeout: 5000 });
    await expect(stepSection().getByRole('listitem')).toHaveCount(1);
    await expect(stepSection()).toContainText('Rice');
    await expect(stepSection()).toContainText('1 cup');
  });

  test('step 2 lists water and salt, not rice', async () => {
    await page.getByRole('button', { name: 'Next Step' }).click();
    await expect(overlay().getByText('Step 2 of 3')).toBeVisible();

    const rows = stepSection().getByRole('listitem');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Water');
    await expect(rows.nth(0)).toContainText('2 cups');
    await expect(rows.nth(1)).toContainText('Salt');
    await expect(rows.nth(1)).toContainText('1 tsp');
  });

  test('a step naming no ingredient shows no list', async () => {
    await page.getByRole('button', { name: 'Next Step' }).click();
    await expect(overlay().getByText('Step 3 of 3')).toBeVisible();
    await expect(stepSection()).toHaveCount(0);
  });

  test('Ingredients panel shows every ingredient and keeps you on the step', async () => {
    await overlay().getByRole('button', { name: 'Ingredients', exact: true }).click();
    await expect(panel()).toBeVisible();

    for (const [name, qty] of INGREDIENTS) {
      await expect(panel()).toContainText(name);
      await expect(panel()).toContainText(qty);
    }
    const checkboxes = panel().getByRole('checkbox');
    await expect(checkboxes.nth(0)).toBeChecked();
    await expect(checkboxes.nth(1)).not.toBeChecked();

    await panel().getByRole('button', { name: 'Close ingredients' }).click();
    await expect(panel()).toHaveCount(0);
    await expect(overlay().getByText('Step 3 of 3')).toBeVisible();

    await overlay().getByRole('button', { name: 'Ingredients', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(panel()).toHaveCount(0);
  });
});
