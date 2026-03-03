#!/usr/bin/env node

/**
 * Captures App Store screenshots at required device resolutions.
 * Requires: npx playwright install chromium (one-time setup)
 * Usage: node scripts/capture-screenshots.js
 */

const SCREENSHOTS = [
  { name: 'iphone-6.7', width: 1290, height: 2796, scale: 3 },
  { name: 'iphone-6.5', width: 1284, height: 2778, scale: 3 },
  { name: 'ipad-12.9', width: 2048, height: 2732, scale: 2 },
];

const PAGES = [
  { name: '01-shopping-list', path: '/', waitFor: 2000 },
];

const BASE_URL = 'http://localhost:5173';

async function main() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    console.error('Playwright not installed. Run: npx playwright install chromium');
    process.exit(1);
  }

  const { chromium } = playwright;
  const browser = await chromium.launch();

  for (const device of SCREENSHOTS) {
    const viewport = {
      width: Math.round(device.width / device.scale),
      height: Math.round(device.height / device.scale),
    };

    for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: device.scale,
        colorScheme,
      });

      const page = await context.newPage();

      for (const pageConfig of PAGES) {
        await page.goto(`${BASE_URL}${pageConfig.path}`, { waitUntil: 'networkidle' });
        if (pageConfig.waitFor) await page.waitForTimeout(pageConfig.waitFor);

        const filename = `${pageConfig.name}-${colorScheme}.png`;
        const dir = `docs/app-store/screenshots/${device.name}`;
        
        await page.screenshot({
          path: `${dir}/${filename}`,
          fullPage: false,
        });

        console.log(`  ✅ ${dir}/${filename} (${device.width}x${device.height})`);
      }

      await context.close();
    }
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to docs/app-store/screenshots/');
}

main().catch(console.error);
