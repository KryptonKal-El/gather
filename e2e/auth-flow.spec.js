/**
 * Auth flow E2E tests — login, logout, sign-up toggle, error handling.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Loads credentials from environment variables or .env.test file.
 * @returns {{ email: string, password: string }}
 */
const loadCredentials = () => {
  let email = process.env.E2E_TEST_EMAIL;
  let password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    const envPath = path.join(import.meta.dirname, '.env.test');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...rest] = trimmed.split('=');
        const value = rest.join('=');
        if (key === 'E2E_TEST_EMAIL') email = value;
        if (key === 'E2E_TEST_PASSWORD') password = value;
      }
    }
  }

  if (!email || !password) {
    throw new Error('E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set');
  }

  return { email, password };
};

test.describe('Auth flow', () => {
  // Override storageState to start with fresh, unauthenticated browser
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows login form on unauthenticated visit', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText('Sign In');
    await expect(page.getByRole('heading', { name: 'Gather' })).toBeVisible();
  });

  test('logs in with valid credentials', async ({ page }) => {
    const { email, password } = loadCredentials();

    await page.goto('/');

    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    // Wait for login to complete — email input disappears
    await expect(page.locator('input[type="email"]')).not.toBeVisible({ timeout: 10000 });

    // Verify authenticated content is shown
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    const { email } = loadCredentials();

    await page.goto('/');

    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill('wrongpassword123');
    await page.locator('button[type="submit"]').click();

    // Wait for error message to appear
    await expect(page.getByText('Incorrect email or password.')).toBeVisible({ timeout: 10000 });

    // Verify still on login page
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('toggles between sign-in and sign-up modes', async ({ page }) => {
    await page.goto('/');

    // Initial state: Sign In mode
    await expect(page.locator('button[type="submit"]')).toHaveText('Sign In');
    const toggleToSignUp = page.getByRole('button', { name: /Don't have an account/ });
    await expect(toggleToSignUp).toBeVisible();

    // Switch to Sign Up mode
    await toggleToSignUp.click();
    await expect(page.locator('button[type="submit"]')).toHaveText('Create Account');
    const toggleToSignIn = page.getByRole('button', { name: /Already have an account/ });
    await expect(toggleToSignIn).toBeVisible();

    // Switch back to Sign In mode
    await toggleToSignIn.click();
    await expect(page.locator('button[type="submit"]')).toHaveText('Sign In');
    await expect(page.getByRole('button', { name: /Don't have an account/ })).toBeVisible();
  });

  test('logs out from desktop header', async ({ page }) => {
    const { email, password } = loadCredentials();

    await page.goto('/');

    // Log in
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    // Wait for login to complete
    await expect(page.locator('input[type="email"]')).not.toBeVisible({ timeout: 10000 });

    // Click Sign out button
    await page.getByRole('button', { name: 'Sign out' }).click();

    // Wait for login form to reappear
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });

    // Verify we're back on login page
    await expect(page.locator('button[type="submit"]')).toHaveText('Sign In');
  });

  test('preserves session across page reload', async ({ page }) => {
    const { email, password } = loadCredentials();

    await page.goto('/');

    // Log in
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    // Wait for login to complete
    await expect(page.locator('input[type="email"]')).not.toBeVisible({ timeout: 10000 });

    // Reload the page
    await page.reload();

    // Verify still authenticated after reload
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible({ timeout: 10000 });

    // Verify login form does NOT appear
    await expect(page.locator('input[type="email"]')).not.toBeVisible();
  });
});
