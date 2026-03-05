/**
 * Playwright auth setup — authenticates via the Login UI and saves storageState.
 */
import { test as setup, expect } from '@playwright/test';
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

const AUTH_FILE = '.auth/user.json';

setup('authenticate', async ({ page }) => {
  const { email, password } = loadCredentials();

  await page.goto('/');

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  // Wait for login to complete — the email input should disappear
  await expect(page.locator('input[type="email"]')).not.toBeVisible({ timeout: 10000 });

  await page.context().storageState({ path: AUTH_FILE });
});
