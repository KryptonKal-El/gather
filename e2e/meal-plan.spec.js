/**
 * Meal plan E2E tests for desktop-chrome project.
 * Builds a scratch collection of four recipes, then drives the Plan tab on
 * next week (so no day is in the past): manual slots, sharing, recipe
 * details, "Plan my week", Keep, Swap and Regenerate. Everything it creates
 * is removed at the end, and the plan's meals are restored to all three.
 */
import { test, expect } from '@playwright/test';

const STAMP = Date.now();
const COLLECTION_NAME = `E2E Plan Collection ${STAMP}`;
const RECIPE_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta'].map((n) => `E2E Plan ${n} ${STAMP}`);
const MEALS = ['Breakfast', 'Lunch', 'Dinner'];

test.describe.serial('Meal plan', () => {
  let page;
  const feedbackEvents = [];

  test.skip(({ isMobile }) => isMobile, 'Desktop Plan tab flow');

  const collectionChip = () =>
    page.locator('[class*="_chip_"]').filter({ hasText: COLLECTION_NAME }).first();
  const days = () => page.locator('section[aria-label]').filter({ has: page.locator('h3') });
  const dinnerSlot = (dayIndex) =>
    days().nth(dayIndex).getByRole('button', { name: /^Dinner: / });
  const dinnerTitle = async (dayIndex) =>
    (await dinnerSlot(dayIndex).getAttribute('aria-label')).replace(/^Dinner: /, '');

  const openTab = async (name) => {
    await page.locator('button').filter({ hasText: name }).first().click();
  };

  const setMealShown = async (label, shown) => {
    await page.getByRole('button', { name: 'Plan options' }).click();
    const box = page.getByRole('menu').getByLabel(label);
    if ((await box.isChecked()) !== shown) await box.setChecked(shown);
    await page.getByRole('button', { name: 'Plan options' }).click();
  };

  // Deletes a collection and its recipes; their plan entries and reactions go with them.
  const deleteCollection = async (chip) => {
    const name = (await chip.textContent()).replace('📁', '').trim();
    await chip.click();
    await page.getByRole('button', { name: `Options for ${name}` }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    const deleteAll = page.getByRole('button', { name: /^Delete collection and all/ });
    await (await deleteAll.isVisible({ timeout: 2000 }) ? deleteAll : page.locator('[class*="deleteBtn"]')).click();
    await expect(page.locator('[class*="_chip_"]').filter({ hasText: name })).toHaveCount(0, { timeout: 5000 });
  };

  const clearDinner = async (dayIndex) => {
    if ((await dinnerTitle(dayIndex)) === 'add a meal') return;
    await dinnerSlot(dayIndex).click();
    await page.getByRole('button', { name: 'Clear meal' }).click();
    await expect(dinnerSlot(dayIndex)).toHaveAccessibleName('Dinner: add a meal', { timeout: 5000 });
  };

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/rest/v1/meal_plan_feedback')) {
        for (const row of JSON.parse(req.postData() ?? '[]')) feedbackEvents.push(row.event);
      }
    });
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Lists', exact: true })).toBeVisible({ timeout: 10000 });

    // Remove scratch libraries a failed earlier run left behind
    await openTab('Recipes');
    const leftovers = page.locator('[class*="_chip_"]').filter({ hasText: 'E2E Plan Collection' });
    await expect(page.locator('[class*="_chip_"]').filter({ hasText: 'All' }).first()).toBeVisible({ timeout: 10000 });
    if (await leftovers.count() > 0) {
      while (await leftovers.count() > 0) await deleteCollection(leftovers.first());
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Lists', exact: true })).toBeVisible({ timeout: 10000 });
    }
  });

  test.afterAll(async () => {
    test.setTimeout(120000);
    try {
      await openTab('Plan');
      for (let i = 0; i < 7; i += 1) await clearDinner(i);
      for (const meal of MEALS) await setMealShown(meal, true);
    } catch {
      // Swallow errors during cleanup
    }
    try {
      await openTab('Recipes');
      if (await collectionChip().isVisible({ timeout: 1000 })) await deleteCollection(collectionChip());
    } catch {
      // Swallow errors during cleanup
    }
    await page?.close();
  });

  test('creates a scratch recipe library', async () => {
    await openTab('Recipes');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'New Collection' }).click();
    await page.getByPlaceholder('Collection name...').fill(COLLECTION_NAME);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(collectionChip()).toBeVisible({ timeout: 5000 });
    await collectionChip().click();

    for (const name of RECIPE_NAMES) {
      await page.getByRole('button', { name: `Add recipe to ${COLLECTION_NAME}` }).click();
      await page.getByRole('button', { name: /Start from scratch/ }).click();
      await page.getByPlaceholder('Recipe name').fill(name);
      await page.getByPlaceholder('Ingredient name').first().fill('Rice');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByRole('button', { name: `Options for ${name}` })).toBeVisible({ timeout: 5000 });
    }
  });

  test('records recipe details from the recipe page', async () => {
    const [first] = RECIPE_NAMES;
    await page.locator('[class*="_recipeCard_"]').filter({ hasText: first }).first().click();

    const details = page.getByRole('heading', { name: 'DETAILS' });
    await expect(details).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Meal, protein, cuisine and effort help the Plan tab')).toBeVisible();
    await page.getByRole('button', { name: 'Add', exact: true }).last().click();

    const editor = page.getByRole('dialog', { name: `Details for ${first}` });
    await editor.getByLabel('Dinner').check();
    await editor.getByLabel('Main protein').selectOption({ label: 'Chicken' });
    await editor.getByLabel('Effort').selectOption({ label: 'Quick (under 30 min)' });
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect(editor).not.toBeVisible({ timeout: 5000 });

    const chips = page.locator('[class*="_chips_"]');
    await expect(chips).toContainText('Dinner');
    await expect(chips).toContainText('Chicken');
    await expect(chips).toContainText('Quick');

    // Details survive a reload (which lands back on the grid)
    await page.reload();
    await openTab('Recipes');
    await page.locator('[class*="_recipeCard_"]').filter({ hasText: first }).first().click();
    await expect(page.locator('[class*="_chips_"]')).toContainText('Chicken', { timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Edit', exact: true }).last()).toBeVisible();
  });

  test('opens the Plan tab on next week with dinner only', async () => {
    await openTab('Plan');
    await expect(page.getByRole('button', { name: /Plan my week/ })).toBeEnabled({ timeout: 10000 });
    await expect(page.getByText('This week')).toBeVisible();
    await expect(days()).toHaveCount(7);

    await page.getByRole('button', { name: 'Next week' }).click();
    await expect(page.getByRole('button', { name: 'Back to this week' })).toBeVisible();

    await setMealShown('Breakfast', false);
    await setMealShown('Lunch', false);
    await expect(page.getByRole('button', { name: /^Lunch: / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Dinner: / })).toHaveCount(7);
  });

  test('plans a slot by hand and marks another as eating out', async () => {
    await dinnerSlot(0).click();
    const editor = page.getByRole('dialog', { name: /Dinner$/ });
    await editor.getByLabel('Search recipes').fill(RECIPE_NAMES[1]);
    await editor.getByRole('option', { name: RECIPE_NAMES[1] }).click();
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect(dinnerSlot(0)).toHaveAccessibleName(`Dinner: ${RECIPE_NAMES[1]}`, { timeout: 5000 });

    await dinnerSlot(1).click();
    await page.getByRole('button', { name: /Eating out/ }).click();
    await page.getByLabel('Note').fill('Birthday dinner');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(dinnerSlot(1)).toHaveAccessibleName(/^Dinner: Eating out/, { timeout: 5000 });
    await expect(days().nth(1)).toContainText('Birthday dinner');

    // Both survive a reload (the plan reopens on this week, so step forward again)
    await page.reload();
    await openTab('Plan');
    await page.getByRole('button', { name: 'Next week' }).click();
    await expect(dinnerSlot(0)).toHaveAccessibleName(`Dinner: ${RECIPE_NAMES[1]}`, { timeout: 10000 });
    await expect(dinnerSlot(1)).toHaveAccessibleName(/^Dinner: Eating out/);

    await clearDinner(0);
  });

  test('opens the share dialog for the plan', async () => {
    await page.getByRole('button', { name: 'Plan options' }).click();
    await page.getByRole('menuitem', { name: 'Share plan' }).click();
    await expect(page.getByPlaceholder('Enter email address...')).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(page.getByPlaceholder('Enter email address...')).not.toBeVisible();
  });

  test('plans the week using every recipe before repeating one', async () => {
    await page.getByRole('button', { name: /Plan my week/ }).click();
    await expect(page.getByRole('button', { name: /Plan my week/ })).toBeEnabled({ timeout: 15000 });

    // The eating-out night is left alone; the other six dinners are filled
    await expect(dinnerSlot(1)).toHaveAccessibleName(/^Dinner: Eating out/);
    const titles = [];
    for (const i of [0, 2, 3, 4, 5, 6]) {
      await expect(dinnerSlot(i)).not.toHaveAccessibleName('Dinner: add a meal', { timeout: 10000 });
      titles.push(await dinnerTitle(i));
    }

    // The library can include recipes shared with this account, so read its size from
    // the small-library note (shown under 8 recipes); no note means 8 or more.
    const note = page.getByRole('status');
    const noteText = (await note.isVisible()) ? await note.textContent() : '';
    const librarySize = Number(noteText.match(/You have (\d+) recipes? for main meals/)?.[1] ?? 8);
    expect(librarySize).toBeGreaterThanOrEqual(RECIPE_NAMES.length);

    // No recipe repeats until every recipe in the library has been used
    expect(new Set(titles).size).toBe(Math.min(titles.length, librarySize));
    // Each suggestion says why it was picked, and has Keep and Swap buttons
    await expect(days().nth(0)).toContainText('✨');
    await expect(days().nth(0).getByRole('button', { name: 'Keep Dinner' })).toBeVisible();
    await expect(days().nth(0).getByRole('button', { name: 'Swap Dinner' })).toBeVisible();
  });

  test('keeps a suggestion and swaps another', async () => {
    const keep = days().nth(0).getByRole('button', { name: 'Keep Dinner' });
    await keep.click();
    await expect(days().nth(0).getByRole('button', { name: 'Unlock Dinner' })).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });
    await expect(days().nth(0).getByRole('button', { name: 'Swap Dinner' })).toHaveCount(0);

    const before = await dinnerTitle(2);
    await days().nth(2).getByRole('button', { name: 'Swap Dinner' }).click();
    await expect(dinnerSlot(2)).not.toHaveAccessibleName(`Dinner: ${before}`, { timeout: 10000 });
    await expect(dinnerSlot(2)).not.toHaveAccessibleName('Dinner: add a meal');

    await expect.poll(() => feedbackEvents).toEqual(expect.arrayContaining(['kept', 'swapped']));
  });

  test('regenerates everything except the kept dinner', async () => {
    const kept = await dinnerTitle(0);
    await page.getByRole('button', { name: 'Regenerate' }).click();
    await expect(page.getByRole('button', { name: /Plan my week/ })).toBeEnabled({ timeout: 15000 });

    await expect(dinnerSlot(0)).toHaveAccessibleName(`Dinner: ${kept}`);
    await expect(dinnerSlot(1)).toHaveAccessibleName(/^Dinner: Eating out/);
    await expect.poll(() => feedbackEvents).toContain('regenerated');
  });

  test('clears the week', async () => {
    for (let i = 0; i < 7; i += 1) await clearDinner(i);
    await expect(page.getByRole('button', { name: 'Dinner: add a meal' })).toHaveCount(7);
    for (const meal of MEALS) await setMealShown(meal, true);
    await expect(page.getByRole('button', { name: /^Breakfast: / })).toHaveCount(7);
  });

  test('removes the scratch library', async () => {
    await openTab('Recipes');
    await deleteCollection(collectionChip());
  });
});
