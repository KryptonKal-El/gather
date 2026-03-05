/**
 * Core shopping list E2E tests for desktop-chrome project.
 * Tests run serially since they build on each other (create list → use it → delete it).
 */
import { test, expect } from '@playwright/test';

const LIST_NAME = `E2E Test List ${Date.now()}`;

/**
 * Helper to get the list button locator that matches the exact list name.
 * This avoids matching other test lists from previous runs.
 */
const getListButton = (page, listName) => {
  // The list button has structure: button > span.listText > span.listName containing the name
  // We match on the exact list name text, filtering by the "items" suffix to avoid the options button
  return page.locator('button').filter({ hasText: listName }).filter({ hasText: /\d+ items?/ });
};

test.describe.serial('Shopping list core flows', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'My Lists' })).toBeVisible({ timeout: 10000 });
  });

  test.afterAll(async () => {
    // Cleanup: try to delete the test list if it still exists
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

  test('creates a new shopping list', async () => {
    // Click "+ New" button to open the create form
    await page.getByRole('button', { name: '+ New' }).click();

    // Fill in the list name
    await page.getByPlaceholder('List name...').fill(LIST_NAME);

    // Submit the form
    await page.getByRole('button', { name: 'Create' }).click();

    // Verify the list appears in the sidebar
    await expect(getListButton(page, LIST_NAME)).toBeVisible();
  });

  test('shows empty list state', async () => {
    // Click on the newly created list to select it
    await getListButton(page, LIST_NAME).click();

    // Verify the "Your list is empty." message appears
    await expect(page.getByText('Your list is empty.')).toBeVisible();
  });

  test('adds an item to the list', async () => {
    // Type "Apples" in the add item input
    await page.getByPlaceholder('Add an item...').fill('Apples');

    // Click the "Add" button
    await page.getByRole('button', { name: 'Add' }).click();

    // Wait for the item to appear in the shopping list
    await expect(page.locator('span').filter({ hasText: 'Apples' }).first()).toBeVisible();

    // Verify empty state is gone
    await expect(page.getByText('Your list is empty.')).not.toBeVisible();
  });

  test('adds multiple items', async () => {
    // Add "Bananas"
    await page.getByPlaceholder('Add an item...').fill('Bananas');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('span').filter({ hasText: 'Bananas' }).first()).toBeVisible();

    // Add "Milk"
    await page.getByPlaceholder('Add an item...').fill('Milk');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('span').filter({ hasText: 'Milk' }).first()).toBeVisible();

    // Verify all 3 items are visible in the main content area
    await expect(page.locator('span').filter({ hasText: 'Apples' }).first()).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Bananas' }).first()).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Milk' }).first()).toBeVisible();
  });

  test('checks an item via double-click', async () => {
    // Find the span containing "Apples" and double-click on it
    // The onDoubleClick is on the details div which wraps the name
    const applesText = page.locator('span').filter({ hasText: 'Apples' }).first();
    await applesText.dblclick();

    // Verify the item moves to the "Checked" section
    await expect(page.getByRole('heading', { name: /Checked \(1\)/ })).toBeVisible();
  });

  test('clears checked items', async () => {
    // First verify we're on the correct list
    const listHeading = page.getByRole('heading', { level: 2, name: LIST_NAME });
    await expect(listHeading).toBeVisible();
    
    // Click the "Clear checked" button to open the confirm dialog
    const clearCheckedBtn = page.getByRole('button', { name: 'Clear checked' });
    await expect(clearCheckedBtn).toBeVisible();
    await clearCheckedBtn.click();

    // The dialog renders via portal to document.body
    // Wait for the dialog message to appear (indicates dialog is fully rendered)
    const dialogMessage = page.getByText(/Clear all \d+ checked items?/);
    await expect(dialogMessage).toBeVisible({ timeout: 5000 });

    // Find the confirm button in the dialog and click it
    const confirmBtn = page.locator('[class*="confirmBtn"]');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Wait for the dialog to close
    await expect(dialogMessage).not.toBeVisible({ timeout: 5000 });

    // Note: Due to potential database/realtime race conditions, 
    // we verify the dialog flow worked. The actual clear may take longer to reflect.
    // Wait a bit for the database operation to complete
    await page.waitForTimeout(2000);
    
    // Reload to ensure we get fresh data
    await page.reload();
    await expect(page.getByRole('heading', { name: 'My Lists' })).toBeVisible({ timeout: 10000 });
    
    // Re-select the list after reload
    await getListButton(page, LIST_NAME).click();
    await expect(listHeading).toBeVisible();
    
    // Now verify the checked section is gone
    await expect(page.getByRole('heading', { name: /Checked/ })).not.toBeVisible({ timeout: 5000 });

    // Verify Apples is no longer in the shopping list items
    // Note: "apples" may still appear in AI Suggestions, so we need to be specific
    // 
    // Looking at the page structure, items in the main list appear under category headings
    // like "Produce 1" or "Dairy & Eggs 1" (the number is the item count).
    // AI Suggestions section has its own "AI Suggestions" heading.
    //
    // To check if an item is in the main shopping list vs AI Suggestions,
    // we can look for items that appear BEFORE the "AI Suggestions" heading
    // or check for the presence of "Edit item" buttons which only exist on list items.
    
    // Simple approach: check that the page text shows Bananas and Milk under categories,
    // and Apples only appears in AI Suggestions (not as a list item)
    
    // Category headings only appear in the main list, not AI Suggestions
    // Items under categories have their category name shown (e.g., "Produce", "Dairy & Eggs")
    await expect(page.getByRole('heading', { name: /Produce \d+/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Dairy & Eggs \d+/ })).toBeVisible();
    
    // The items are visible in the main area - use text content within list structure
    // The list items have clickable areas with the item name
    await expect(page.getByText('Bananas', { exact: true })).toBeVisible();
    await expect(page.getByText('Milk', { exact: true })).toBeVisible();
    
    // For Apples: it should NOT appear as a list item (exact match in main content)
    // AI Suggestions shows "apples" (lowercase) with "Purchased X times before"
    // We check that there's no heading for a category containing Apples
    // If Apples was a list item, there would be a category group for it
    // Since Apples was in Produce and we still have Bananas in Produce, 
    // we just verify Apples text doesn't appear with "Produce" badge
    const applesInList = page.locator('[class*="item"]').filter({ hasText: 'Apples' }).filter({ hasText: 'Produce' });
    await expect(applesInList).not.toBeVisible();
  });

  test('deletes the test list', async () => {
    // First ensure the test list exists and is selected
    const listButton = getListButton(page, LIST_NAME);
    await expect(listButton).toBeVisible();
    
    // Click the three-dot menu button for the test list
    const optionsBtn = page.getByRole('button', { name: `Options for ${LIST_NAME}` });
    await expect(optionsBtn).toBeVisible();
    await optionsBtn.click();

    // Wait for the dropdown menu to appear - it has "Delete List" option
    const deleteListBtn = page.getByRole('button', { name: 'Delete List' });
    await expect(deleteListBtn).toBeVisible({ timeout: 5000 });
    await deleteListBtn.click();

    // Wait for the confirm dialog to appear (rendered via portal)
    // The message is: Delete "LIST_NAME" and all its items?
    const dialogMessage = page.getByText(`Delete "${LIST_NAME}" and all its items?`);
    await expect(dialogMessage).toBeVisible({ timeout: 5000 });

    // Click the confirm button in the dialog (using CSS module selector)
    const confirmBtn = page.locator('[class*="confirmBtn"]');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Wait for the dialog to close
    await expect(dialogMessage).not.toBeVisible({ timeout: 5000 });
    
    // Give the database operation time to complete and reload to get fresh data
    // (similar to clear checked test - realtime may have timing issues)
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'My Lists' })).toBeVisible({ timeout: 10000 });

    // Verify the list is removed from the sidebar
    await expect(getListButton(page, LIST_NAME)).not.toBeVisible({ timeout: 5000 });
  });
});
