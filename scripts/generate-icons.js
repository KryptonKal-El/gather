/**
 * Generate PNG icons and splash screens for PWA and Capacitor (iOS/Android).
 * Uses sharp to rasterize the Gather Lists logo SVG.
 *
 * Run: node scripts/generate-icons.js            → regular brand icon
 *      node scripts/generate-icons.js --holiday  → seasonal holiday icon
 *
 * The flag swaps the icon-tile source SVGs (and public/icon.svg), copies the
 * seasonal wordmark logos into public/logo/active/ — the paths the web app
 * references — and renders the splash screens and iOS launch logos from the
 * seasonal stacked logo.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PUBLIC = join(PROJECT_ROOT, 'public');
const ASSETS = join(PROJECT_ROOT, 'assets');
const HOLIDAY = process.argv.includes('--holiday');
const LOGO_SVG_PATH = join(PUBLIC, 'logo', HOLIDAY ? 'icon-only-full-bleed-holiday.svg' : 'icon-only-full-bleed.svg');
const FAVICON_SRC_PATH = join(PUBLIC, 'logo', HOLIDAY ? 'icon-only-holiday.svg' : 'icon-only.svg');
const STACKED_SVG_PATH = join(PUBLIC, 'logo', HOLIDAY ? 'stacked-holiday.svg' : 'stacked.svg');

// Brand colors
const DARK_BACKGROUND = '#1a1a2e';
const LIGHT_SPLASH_BG = '#FFFFFF';

// Frame of the stacked logo rasterized for splash screens and launch logos. The size is
// fixed (the iOS launch storyboard lays the image out at this aspect ratio); the holiday
// frame sits 8 units higher so the Santa hat clears the top edge at the same scale.
const STACKED_VIEWBOX = { x: 0, y: HOLIDAY ? -8 : 0, width: 400, height: 225 };

// iOS asset catalog targets (written directly so Xcode picks up regenerated art)
const IOS_ASSETS = join(PROJECT_ROOT, 'ios-native', 'GatherLists', 'GatherLists', 'Assets.xcassets');
const IOS_APPICON = join(IOS_ASSETS, 'AppIcon.appiconset', 'icon-foreground.png');
const IOS_LAUNCH_LOGO_DIR = join(IOS_ASSETS, 'LaunchLogo.imageset');

// Served logo SVGs that carry <text>: fonts must be embedded because SVG-in-<img> cannot load external fonts
const TEXT_LOGO_SVGS = [
  'icon-name.svg', 'icon-name-dark.svg', 'icon-name-tagline.svg', 'stacked.svg', 'gather-logo-all-variants.svg',
  'icon-name-dark-holiday.svg', 'icon-name-tagline-holiday.svg', 'stacked-holiday.svg',
];

// Wordmark logos the web app references via public/logo/active/<name>; the active
// copy comes from the regular source, or the -holiday variant in holiday mode
const WEB_LOGO_VARIANTS = ['stacked.svg', 'icon-name-dark.svg', 'icon-name-tagline.svg'];

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
 * Reads from icon-only.svg and rasterizes at 1024x1024.
 * iOS applies its own rounded corner mask.
 * @param {string} svgContent - SVG content from icon-only.svg
 */
const generateCapacitorIcons = async (svgContent) => {
  const size = 1024;

  const iconBuffer = await sharp(Buffer.from(svgContent))
    .resize(size, size)
    .png()
    .toBuffer();

  const iconOnlyPath = join(ASSETS, 'icon-only.png');
  const iconFgPath = join(ASSETS, 'icon-foreground.png');

  await sharp(iconBuffer).toFile(iconOnlyPath);
  console.log(`Generated ${iconOnlyPath} (1024x1024, full-bleed)`);

  await sharp(iconBuffer).toFile(iconFgPath);
  console.log(`Generated ${iconFgPath} (1024x1024, full-bleed)`);

  await sharp(iconBuffer).toFile(IOS_APPICON);
  console.log(`Generated ${IOS_APPICON} (1024x1024, iOS AppIcon)`);
}

/**
 * Generate the 180x180 opaque apple-touch-icon (iOS applies its own corner mask).
 * @param {string} svgContent - SVG content from icon-only-full-bleed.svg
 */
const generateAppleTouchIcon = async (svgContent) => {
  const outputPath = join(PUBLIC, 'apple-touch-icon.png');
  await sharp(Buffer.from(svgContent))
    .resize(180, 180)
    .png()
    .toFile(outputPath);
  console.log(`Generated ${outputPath} (180x180)`);
};

/**
 * Replace an SVG's root frame (viewBox and intrinsic size) with the given one.
 * @param {string} svgContent - Full SVG content
 * @param {{x: number, y: number, width: number, height: number}} frame - New frame
 * @returns {string} SVG content with the new root tag
 */
const reframeSvg = (svgContent, { x, y, width, height }) =>
  svgContent.replace(
    /<svg[^>]*>/i,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" width="${width}" height="${height}">`
  );

/**
 * Generate the iOS launch-screen logo imageset (@1x/@2x/@3x) from the stacked logo.
 */
const generateLaunchLogos = async () => {
  const stackedSvgRaw = readStackedSvg();
  const stackedSvgWithFonts = reframeSvg(await embedFontsInSvg(stackedSvgRaw), STACKED_VIEWBOX);
  for (const scale of [1, 2, 3]) {
    const width = STACKED_VIEWBOX.width * scale;
    const height = STACKED_VIEWBOX.height * scale;
    const outputPath = join(IOS_LAUNCH_LOGO_DIR, `stacked-logo@${scale}x.png`);
    await sharp(Buffer.from(stackedSvgWithFonts))
      .resize(width, height)
      .png()
      .toFile(outputPath);
    console.log(`Generated ${outputPath} (${width}x${height})`);
  }
};

/**
 * Embed Google Fonts into the served logo SVGs in place (idempotent: a file with no
 * remaining Google Fonts import is left unchanged).
 */
const embedFontsIntoLogoSvgs = async () => {
  for (const name of TEXT_LOGO_SVGS) {
    const path = join(PUBLIC, 'logo', name);
    const original = readFileSync(path, 'utf-8');
    const embedded = await embedFontsInSvg(original);
    if (embedded !== original) {
      writeFileSync(path, embedded);
      console.log(`Embedded fonts into ${path}`);
    } else {
      console.log(`No font import to embed in ${path} (already embedded)`);
    }
  }
};;

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
/**
 * Copy the active rounded-tile SVG over the served favicon.
 */
const writeFavicon = () => {
  const outputPath = join(PUBLIC, 'icon.svg');
  writeFileSync(outputPath, readFileSync(FAVICON_SRC_PATH, 'utf-8'));
  console.log(`Wrote ${outputPath} from ${FAVICON_SRC_PATH}`);
};

/**
 * Copy the season's wordmark logos to public/logo/active/, the paths the web app serves.
 */
const writeActiveWebLogos = () => {
  const activeDir = join(PUBLIC, 'logo', 'active');
  if (!existsSync(activeDir)) {
    mkdirSync(activeDir, { recursive: true });
  }
  for (const name of WEB_LOGO_VARIANTS) {
    const srcName = HOLIDAY ? name.replace(/\.svg$/, '-holiday.svg') : name;
    const srcPath = join(PUBLIC, 'logo', srcName);
    const outputPath = join(activeDir, name);
    writeFileSync(outputPath, readFileSync(srcPath, 'utf-8'));
    console.log(`Wrote ${outputPath} from ${srcPath}`);
  }
};

const main = async () => {
  console.log(HOLIDAY ? 'Holiday mode: seasonal icon sources.' : 'Regular brand icon sources.');
  console.log('Reading logo SVG...');
  const svgContent = readLogoSvg();

  console.log('\nWriting favicon SVG...');
  writeFavicon();

  console.log('\nGenerating PWA icons...');
  await generatePwaIcons(svgContent, [64, 192, 512]);

  console.log('\nGenerating Capacitor icons...');
  await generateCapacitorIcons(svgContent);

  console.log('\nGenerating apple-touch-icon...');
  await generateAppleTouchIcon(svgContent);

  console.log('\nEmbedding fonts into served logo SVGs...');
  await embedFontsIntoLogoSvgs();

  console.log('\nWriting active web logos...');
  writeActiveWebLogos();

  console.log('\nGenerating splash screens...');
  await generateSplashScreens();

  console.log('\nGenerating iOS launch logos...');
  await generateLaunchLogos();

  console.log('\nDone!');
};

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
