import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../../');
const marketingPagePath = resolve(projectRoot, 'public/index-marketing.html');

let htmlContent;

describe('marketing page (public/index-marketing.html)', () => {
  it('file exists and is non-empty', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toBeTruthy();
    expect(htmlContent.length).toBeGreaterThan(0);
  });

  it('contains Apple iTunes app meta tag with correct app ID', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<meta name="apple-itunes-app" content="app-id=6760205400">');
  });

  it('contains og:title meta tag', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<meta property="og:title"');
  });

  it('contains og:description meta tag', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<meta property="og:description"');
  });

  it('contains og:image meta tag', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<meta property="og:image"');
  });

  it('contains og:url meta tag', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<meta property="og:url"');
  });

  it('contains description meta tag', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<meta name="description"');
  });

  it('contains Smart Lists feature card label', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('Smart Lists');
  });

  it('contains Real-Time Sharing feature card label', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('Real-Time Sharing');
  });

  it('contains Recipes & Meal Planning feature card label', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('Recipes & Meal Planning');
  });

  it('contains Works Everywhere feature card label', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('Works Everywhere');
  });

  it('contains support footer link', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<a href="/support">');
  });

  it('contains privacy policy footer link', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<a href="/privacy.html">');
  });

  it('contains app footer link', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<a href="/app">');
  });

  it('contains copyright notice for 2026', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('© 2026 Gather Lists');
  });

  it('does not contain script tags', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).not.toContain('<script');
  });

  it('contains header semantic element', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<header');
  });

  it('contains main semantic element', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<main');
  });

  it('contains footer semantic element', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<footer');
  });

  it('contains correct brand color #3D7A63 in stylesheet', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('#3D7A63');
  });

  // New tests for sticky navigation bar (S-01)
  it('contains nav element inside header', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<header class="site-header">');
    expect(htmlContent).toContain('<nav>');
  });

  it('contains logo image with /logo/icon-name.svg src in header', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<img src="/logo/icon-name.svg"');
  });

  it('contains Features anchor link to #features in header nav', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<a href="#features"');
    expect(htmlContent).toContain('Features');
  });

  it('contains Launch App link with href /app in header', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<a href="/app"');
    expect(htmlContent).toContain('Launch App');
  });

  it('contains sticky header CSS (position: sticky)', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('position: sticky');
  });
});
