/**
 * Generate PNG icons and splash screens for PWA and Capacitor (iOS/Android).
 * Uses sharp to rasterize the Gather logo SVG.
 *
 * Run: node scripts/generate-icons.js
 */
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PUBLIC = join(PROJECT_ROOT, 'public');
const ASSETS = join(PROJECT_ROOT, 'assets');
const LOGO_SVG_PATH = join(PUBLIC, 'logo', 'icon-only.svg');

// Brand colors
const GRADIENT_START = '#B5E8C8';
const GRADIENT_END = '#A8D8EA';
const GRADIENT_MIDPOINT = '#AEDFD9';
const DARK_BACKGROUND = '#1a1a2e';

// Ensure assets directory exists
if (!existsSync(ASSETS)) {
  mkdirSync(ASSETS, { recursive: true });
  console.log(`Created ${ASSETS}`);
}

/**
 * Read the logo SVG content.
 * @returns {string} SVG content
 */
const readLogoSvg = () => readFileSync(LOGO_SVG_PATH, 'utf-8');

/**
 * Extract the inner content of the SVG (everything inside the root svg tag).
 * @param {string} svgContent - Full SVG content
 * @returns {string} Inner SVG content (defs, shapes, etc.)
 */
const extractSvgInner = (svgContent) => {
  const match = svgContent.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  return match ? match[1] : '';
};

/**
 * Generate PWA icons with transparency.
 * @param {string} svgContent - SVG content
 * @param {number[]} sizes - Array of icon sizes
 */
const generatePwaIcons = async (svgContent, sizes) => {
  for (const size of sizes) {
    const outputPath = join(PUBLIC, `icon-${size}x${size}.png`);
    await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated ${outputPath}`);
  }
};

/**
 * Generate opaque 1024x1024 icons for Capacitor/App Store.
 * Creates a solid background and composites the SVG on top.
 * @param {string} svgContent - SVG content
 */
const generateCapacitorIcons = async (svgContent) => {
  const size = 1024;

  // Render SVG at 1024x1024 and flatten onto solid background
  const iconBuffer = await sharp(Buffer.from(svgContent))
    .resize(size, size)
    .flatten({ background: GRADIENT_MIDPOINT })
    .png()
    .toBuffer();

  const iconOnlyPath = join(ASSETS, 'icon-only.png');
  const iconFgPath = join(ASSETS, 'icon-foreground.png');

  await sharp(iconBuffer).toFile(iconOnlyPath);
  console.log(`Generated ${iconOnlyPath} (1024x1024, opaque)`);

  await sharp(iconBuffer).toFile(iconFgPath);
  console.log(`Generated ${iconFgPath} (1024x1024, opaque)`);
};

/**
 * Create an SVG wrapper for splash screens with a background and centered logo.
 * @param {string} logoInner - Inner content of the logo SVG
 * @param {number} size - Canvas size
 * @param {number} logoSize - Size to render the logo
 * @param {string} background - Background style (color or gradient def + fill)
 * @param {boolean} useGradient - Whether to use gradient background
 * @returns {string} Complete SVG for splash screen
 */
const createSplashSvg = (logoInner, size, logoSize, background, useGradient = false) => {
  const logoOffset = (size - logoSize) / 2;
  // Scale factor: original viewBox is 148x148, we want logoSize
  const scale = logoSize / 148;

  // The original SVG viewBox is "76 60 148 148"
  // We need to transform the logo content to center it in our canvas
  const translateX = logoOffset - 76 * scale;
  const translateY = logoOffset - 60 * scale;

  const gradientDef = useGradient
    ? `<linearGradient id="splashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${GRADIENT_START};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${GRADIENT_END};stop-opacity:1" />
      </linearGradient>`
    : '';

  const bgFill = useGradient ? 'url(#splashGrad)' : background;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    ${gradientDef}
    <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#B5E8C8;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#A8D8EA;stop-opacity:1" />
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#5BA08A" flood-opacity="0.15"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" fill="${bgFill}"/>
  <g transform="translate(${translateX}, ${translateY}) scale(${scale})">
    ${logoInner}
  </g>
</svg>`;
};

/**
 * Generate splash screens for Capacitor.
 * @param {string} svgContent - Original logo SVG content
 */
const generateSplashScreens = async (svgContent) => {
  const size = 2732;
  const logoSize = 500;
  const logoInner = extractSvgInner(svgContent);

  // Light splash with gradient background
  const lightSplashSvg = createSplashSvg(logoInner, size, logoSize, GRADIENT_MIDPOINT, true);
  const splashPath = join(ASSETS, 'splash.png');
  await sharp(Buffer.from(lightSplashSvg))
    .png()
    .toFile(splashPath);
  console.log(`Generated ${splashPath} (2732x2732, light)`);

  // Dark splash with solid dark background
  const darkSplashSvg = createSplashSvg(logoInner, size, logoSize, DARK_BACKGROUND, false);
  const splashDarkPath = join(ASSETS, 'splash-dark.png');
  await sharp(Buffer.from(darkSplashSvg))
    .png()
    .toFile(splashDarkPath);
  console.log(`Generated ${splashDarkPath} (2732x2732, dark)`);
};

/**
 * Main entry point. Generates all icons and splash screens.
 */
const main = async () => {
  console.log('Reading logo SVG...');
  const svgContent = readLogoSvg();

  console.log('\nGenerating PWA icons...');
  await generatePwaIcons(svgContent, [64, 192, 512]);

  console.log('\nGenerating Capacitor icons...');
  await generateCapacitorIcons(svgContent);

  console.log('\nGenerating splash screens...');
  await generateSplashScreens(svgContent);

  console.log('\nDone!');
};

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
