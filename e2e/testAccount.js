/**
 * Test-account helpers for the Playwright suite.
 */
import fs from 'fs';
import path from 'path';

/**
 * Loads the e2e test account from environment variables or e2e/.env.test.
 * @returns {{ email: string, password: string }}
 */
export const loadCredentials = () => {
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

/**
 * Signs the test account in on an already-loaded /app page.
 *
 * The app has no password form any more, but the server still accepts the test
 * account's password. Importing the Vite dev server's copy of the app's Supabase
 * client signs in the same client instance the app listens to, so the UI reacts
 * exactly as it would to a real sign-in.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
export const signInTestAccount = async (page) => {
  const { email, password } = loadCredentials();
  const errorMessage = await page.evaluate(async (credentials) => {
    const { supabase } = await import('/src/services/supabase.js');
    const { error } = await supabase.auth.signInWithPassword(credentials);
    return error?.message ?? null;
  }, { email, password });
  if (errorMessage) {
    throw new Error(`Test account sign-in failed: ${errorMessage}`);
  }
};
