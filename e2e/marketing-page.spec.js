/**
 * Marketing page E2E test: the public landing page at / shows the brand logo
 * made for its dark header.
 */
import { test, expect } from '@playwright/test';

test.describe('Marketing page', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows the dark-header logo in the header', async ({ page }) => {
    await page.goto('/');
    const logo = page.locator('header.site-header a.logo img');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('src', '/logo/icon-name-dark.svg');
    await expect(logo).toHaveAttribute('alt', 'Gather Lists');
    // The image actually loaded rather than showing a broken icon
    expect(await logo.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  });
});
