/**
 * Auth flow E2E tests — passwordless login screen, logout, session persistence.
 */
import { test, expect } from '@playwright/test';
import { signInTestAccount } from './testAccount.js';

test.describe('Auth flow', () => {
  // Override storageState to start with fresh, unauthenticated browser
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows passwordless sign-in options on unauthenticated visit', async ({ page }) => {
    await page.goto('/app');

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign in with Apple' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Email me a sign-in code' })).toBeVisible();
    await expect(page.getByText('New to Gather? This creates your account.')).toBeVisible();
  });

  test('logs out from the settings screen', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await signInTestAccount(page);

    await expect(page.locator('input[type="email"]')).not.toBeVisible({ timeout: 10000 });

    // Sign out now lives on the Settings screen (gear on desktop, tab on mobile)
    await page.getByLabel('Settings').first().click();
    await page.getByRole('button', { name: 'Sign Out' }).click();

    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Email me a sign-in code' })).toBeVisible();
  });

  test('preserves session across page reload', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await signInTestAccount(page);

    await expect(page.locator('input[type="email"]')).not.toBeVisible({ timeout: 10000 });

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Lists', exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="email"]')).not.toBeVisible();
  });
});
