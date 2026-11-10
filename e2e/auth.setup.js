/**
 * Playwright auth setup — signs the test account in and saves storageState.
 */
import { test as setup, expect } from '@playwright/test';
import { signInTestAccount } from './testAccount.js';

const AUTH_FILE = '.auth/user.json';

setup('authenticate', async ({ page }) => {
  // The root URL serves the marketing landing page; the app (and its login
  // form) lives at /app.
  await page.goto('/app');
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await signInTestAccount(page);

  // Wait for login to complete — the email input should disappear
  await expect(page.locator('input[type="email"]')).not.toBeVisible({ timeout: 10000 });

  // Keep the one-time "add a passkey" prompt (PasskeyPrompt.jsx) from covering
  // controls the tests click; the dismissal is saved into storageState below.
  await page.evaluate(() => {
    const tokenKey = Object.keys(localStorage).find((key) => /^sb-.*-auth-token$/.test(key));
    const userId = tokenKey ? JSON.parse(localStorage.getItem(tokenKey))?.user?.id : null;
    if (userId) localStorage.setItem(`gather.passkeyPromptDismissed.${userId}`, '1');
  });

  await page.context().storageState({ path: AUTH_FILE });
});
