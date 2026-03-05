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
const STACKED_SVG_PATH = join(PUBLIC, 'logo', 'stacked.svg');

// Brand colors
const GRADIENT_MIDPOINT = '#AEDFD9';
const DARK_BACKGROUND = '#1a1a2e';
const LIGHT_SPLASH_BG = '#FFFFFF';

// Stacked logo viewBox dimensions
const STACKED_VIEWBOX = { x: 310, y: 410, width: 280, height: 210 };

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
 * Read the stacked logo SVG content.
 * @returns {string} SVG content
 */
const readStackedSvg = () => readFileSync(STACKED_SVG_PATH, 'utf-8');

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
 * Fetch Google Fonts CSS and extract woff2 URLs.
 * @param {string} fontUrl - Google Fonts CSS URL
 * @returns {Promise<{css: string, fontUrls: string[]}>} CSS content and extracted woff2 URLs
 */
const fetchGoogleFontsCss = async (fontUrl) => {
  const response = await fetch(fontUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  const css = await response.text();
  const fontUrls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g)].map((m) => m[1]);
  return { css, fontUrls };
};

/**
 * Download font file and convert to base64 data URI.
 * @param {string} url - Font file URL
 * @returns {Promise<string>} Base64 data URI
 */
const downloadFontAsBase64 = async (url) => {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:font/woff2;base64,${base64}`;
};

/**
 * Embed Google Fonts into SVG by replacing @import with base64 @font-face declarations.
 * @param {string} svgContent - SVG content with @import url()
 * @returns {Promise<string>} SVG with embedded fonts
 */
const embedFontsInSvg = async (svgContent) => {
  const importMatch = svgContent.match(/@import\s+url\(['"]?(https:\/\/fonts\.googleapis\.com\/[^'")\s]+)['"]?\)/);
  if (!importMatch) {
    return svgContent;
  }

  const fontUrl = importMatch[1].replace(/&amp;/g, '&');
  const { css, fontUrls } = await fetchGoogleFontsCss(fontUrl);

  // Download all fonts and build a map of URL -> base64
  const fontDataMap = new Map();
  await Promise.all(
    fontUrls.map(async (url) => {
      const dataUri = await downloadFontAsBase64(url);
      fontDataMap.set(url, dataUri);
    })
  );

  // Replace woff2 URLs with base64 data URIs in the CSS
  let embeddedCss = css;
  for (const [url, dataUri] of fontDataMap) {
    embeddedCss = embeddedCss.replace(url, dataUri);
  }

  // Replace the @import line with the embedded @font-face declarations
  const updatedSvg = svgContent.replace(importMatch[0], embeddedCss);
  return updatedSvg;
};

/**
 * Create stacked logo splash SVG with background and centered logo.
 * @param {string} stackedInner - Inner content of stacked SVG
 * @param {number} canvasSize - Canvas size (2732)
 * @param {number} targetHeight - Desired height of the logo
 * @param {string} background - Background color
 * @param {boolean} darkMode - Whether to adjust text colors for dark background
 * @returns {string} Complete SVG for splash screen
 */
const createStackedSplashSvg = (stackedInner, canvasSize, targetHeight, background, darkMode) => {
  let inner = stackedInner;

  // For dark mode, override text fills for readability
  if (darkMode) {
    inner = inner.replace(/fill="#3D7A63"/g, 'fill="#FFFFFF"');
    inner = inner.replace(/fill="#85BFA8"/g, 'fill="#E0E0E0"');
  }

  // Calculate scale and translation
  const scale = targetHeight / STACKED_VIEWBOX.height;
  const scaledWidth = STACKED_VIEWBOX.width * scale;
  const translateX = (canvasSize - scaledWidth) / 2 - STACKED_VIEWBOX.x * scale;
  const translateY = (canvasSize - targetHeight) / 2 - STACKED_VIEWBOX.y * scale;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasSize} ${canvasSize}" width="${canvasSize}" height="${canvasSize}">
  <rect width="${canvasSize}" height="${canvasSize}" fill="${background}"/>
  <g transform="translate(${translateX}, ${translateY}) scale(${scale})">
    ${inner}
  </g>
</svg>`;
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
 * Generate splash screens for Capacitor using stacked logo with embedded fonts.
 */
const generateSplashScreens = async () => {
  const canvasSize = 2732;
  const logoHeight = 700;

  console.log('Fetching and embedding fonts for stacked logo...');
  const stackedSvgRaw = readStackedSvg();
  const stackedSvgWithFonts = await embedFontsInSvg(stackedSvgRaw);
  const stackedInner = extractSvgInner(stackedSvgWithFonts);

  // Light splash with white background
  const lightSplashSvg = createStackedSplashSvg(stackedInner, canvasSize, logoHeight, LIGHT_SPLASH_BG, false);
  const splashPath = join(ASSETS, 'splash.png');
  await sharp(Buffer.from(lightSplashSvg))
    .png()
    .toFile(splashPath);
  console.log(`Generated ${splashPath} (2732x2732, light)`);

  // Dark splash with dark background
  const darkSplashSvg = createStackedSplashSvg(stackedInner, canvasSize, logoHeight, DARK_BACKGROUND, true);
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
  await generateSplashScreens();

  console.log('\nDone!');
};

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
