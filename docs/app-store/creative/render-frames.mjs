// Renders scene.html to numbered PNG frames. Usage: node render-frames.mjs <header|search> <output-dir>
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const SIZES = { header: [3840, 1646], search: [3840, 2560] };
const FPS = 30;
const LOOP_SECONDS = 8;

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , asset, outputDir] = process.argv;
if (!SIZES[asset] || !outputDir) {
  throw new Error('Usage: node render-frames.mjs <header|search> <output-dir>');
}
const [width, height] = SIZES[asset];
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: width / 2, height: height / 2 },
    deviceScaleFactor: 2,
  });
  await page.goto(`${pathToFileURL(path.join(here, 'scene.html')).href}?asset=${asset}`);
  await page.evaluate(() => window.sceneReady);

  const frameCount = FPS * LOOP_SECONDS;
  for (let frame = 0; frame < frameCount; frame += 1) {
    await page.evaluate((seconds) => window.renderAt(seconds), frame / FPS);
    const name = `frame-${String(frame).padStart(4, '0')}.png`;
    await page.screenshot({ path: path.join(outputDir, name) });
  }
  console.log(`Rendered ${frameCount} frames to ${outputDir}`);
} finally {
  await browser.close();
}
