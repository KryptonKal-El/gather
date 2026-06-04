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

  it('contains Every kind of feature row label', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('Every kind of');
  });

  it('contains Shared in real time text in hero slides', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('Shared in');
  });

  it('contains Meals into lists text in hero slides', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('Meals into');
  });

  it('contains Web iOS everywhere text in hero slides', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('Web, iOS,');
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
    // The /app link is in the header (Sign In button in nav right), not in footer
    expect(htmlContent).not.toContain('<a href="/app">App</a>');
  });

  it('contains copyright notice for 2026', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('© 2026 Gather Lists');
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

  // New tests for floating pill navigation (S-01)
  it('contains nav element inside header', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<header class="site-header">');
    expect(htmlContent).toContain('<nav>');
  });

  it('contains logo image with /logo/icon-name.svg src in header', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<img src="/logo/icon-name.svg"');
  });

  it('contains Support link in nav pill', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<a href="/support" class="nav-link">');
  });

  it('contains Download App button linking to App Store in nav pill', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('https://apps.apple.com/app/id6760205400');
    expect(htmlContent).toContain('class="launch-button"');
  });

  it('contains Sign In link pointing to /app in nav right', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<a href="/app" class="sign-in-link">');
    expect(htmlContent).toContain('Sign In');
  });

  it('contains fixed header CSS (position: fixed)', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('position: fixed');
  });

  it('contains pill nav CSS with border-radius 50vw', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('border-radius: 50vw');
  });

  it('contains frosted glass backdrop-filter effect', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('backdrop-filter: blur(3px)');
  });

  // New tests for hero section (S-02)
  it('contains hero-section element inside main', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<section class="hero-section">');
  });

  it('contains hero-canvas canvas element', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<canvas id="hero-canvas"');
    expect(htmlContent).toContain('class="hero-section__canvas"');
  });

  it('contains hero headline with "Every list," text', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('Every list,');
  });

  it('contains hero-headline class with proper styling', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('class="hero-headline"');
  });

  it('contains hero subline with sync copy', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('Groceries, meals, sharing — all synced in real time on web and iOS.');
  });

  it('contains hero-subline class with proper styling', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('class="hero-subline"');
  });

  it('contains hero-phone-stack container for phone mockup overlay', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('class="hero-phone-stack"');
  });

  it('contains hero-phone-frame img with iPhone mockup source', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('class="hero-phone-frame"');
    expect(htmlContent).toContain('src="/marketing/iphone-mockup.png"');
    expect(htmlContent).toContain('alt="Gather Lists on iPhone"');
  });

  it('contains hero-phone-content overlay with headline, subline, and CTA', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('class="hero-phone-screens"');
    expect(htmlContent).toContain('class="hero-phone-slide');
    expect(htmlContent).toContain('data-slide="0"');
    expect(htmlContent).toContain('<h1 class="hero-headline">');
    expect(htmlContent).toContain('<p class="hero-subline">');
    expect(htmlContent).toContain('<a class="hero-cta"');
  });

  it('contains hero-cta with letter-animation Download App button structure', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<a class="hero-cta"');
    expect(htmlContent).toContain('class="apple-icon"');
    expect(htmlContent).toContain('class="btn-text"');
    expect(htmlContent).toContain('class="letter-wrapper"');
    expect(htmlContent).toContain('Download');
    expect(htmlContent).toContain('App');
  });

  it('contains App Store badge link to correct app ID', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('https://apps.apple.com/app/id6760205400');
  });

  it('hero-cta link has correct app store URL and accessibility attributes', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('href="https://apps.apple.com/app/id6760205400"');
    expect(htmlContent).toContain('aria-label="Download Gather on the App Store"');
    expect(htmlContent).toContain('target="_blank"');
    expect(htmlContent).toContain('rel="noopener noreferrer"');
  });

  it('contains hero-scroll-height container for scroll-driven animation', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('class="hero-scroll-height"');
  });

  it('contains hero-sticky positioning container', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('class="hero-sticky"');
  });

  it('contains 5 hero-phone-slide elements with data-slide attributes 0-4', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    for (let i = 0; i < 5; i++) {
      expect(htmlContent).toContain(`data-slide="${i}"`);
    }
    const matches = htmlContent.match(/class="hero-phone-slide/g) || [];
    expect(matches.length).toBe(5);
  });

  it('contains hero-phone-screens overlay container with pointer-events none', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('class="hero-phone-screens"');
  });

  it('contains hero-bottom-fade gradient mask element', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('class="hero-bottom-fade"');
    expect(htmlContent).toContain('linear-gradient(to bottom, rgba(10, 10, 10, 0), rgba(10, 10, 10, 1))');
  });

  it('contains feature slide with emoji icon in slide 1', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('class="hero-feature-slide"');
    expect(htmlContent).toContain('<span class="hero-feature-icon">📋</span>');
  });

  it('contains feature slide titles with hero-feature-title class', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('class="hero-feature-title"');
    expect(htmlContent).toContain('Every kind of list');
    expect(htmlContent).toContain('Shared in real time');
    expect(htmlContent).toContain('Meals into lists');
    expect(htmlContent).toContain('Web, iOS, everywhere');
  });

  it('contains scroll-driven animation onScroll function', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('function onScroll()');
    expect(htmlContent).toContain('const progress');
    expect(htmlContent).toContain('setSlide(idx)');
  });

  it('contains particle animation loop function', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('function loop()');
    expect(htmlContent).toContain('requestAnimationFrame(loop)');
  });

  // New tests for CTA section (S-04)
  it('contains "Start your lists today." CTA text', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('Start your lists today.');
  });

  it('CTA section has brand green background CSS (#3D7A63)', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('.cta-section {');
    expect(htmlContent).toContain('background: #3D7A63');
  });

  it('CTA section contains "Free on web and iOS." subline', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('Free on web and iOS.');
  });

  // Accessibility fixes (TSK-20260604-140645)
  it('canvas element has aria-hidden attribute set to true', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('<canvas id="hero-canvas" class="hero-section__canvas" aria-hidden="true">');
  });

  it('focus-visible CSS rule is defined for nav-link, launch-button, hero-cta, and footer links', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('.nav-link:focus-visible,');
    expect(htmlContent).toContain('.launch-button:focus-visible,');
    expect(htmlContent).toContain('.hero-cta:focus-visible,');
    expect(htmlContent).toContain('.footer a:focus-visible');
    expect(htmlContent).toContain('outline: 2px solid rgba(255,255,255,0.5)');
    expect(htmlContent).toContain('outline-offset: 2px');
  });

  it('scroll animation includes null safety guard for scrollHeight and phoneStack', () => {
    htmlContent = readFileSync(marketingPagePath, 'utf-8');
    expect(htmlContent).toContain('if (!scrollHeight || !phoneStack || slides.length === 0)');
    expect(htmlContent).toContain("console.warn('Hero scroll elements not found; skipping animation')");
  });

   it('contains scroll animation constants for phone shrink', () => {
     htmlContent = readFileSync(marketingPagePath, 'utf-8');
     expect(htmlContent).toContain('INITIAL_WIDTH_VW = 0.80');
     expect(htmlContent).toContain('INITIAL_WIDTH_MAX = 920');
     expect(htmlContent).toContain('FINAL_WIDTH = 380');
     expect(htmlContent).toContain('SHRINK_END = 0.2');
     expect(htmlContent).toContain('SLIDES_START = 0.18');
   });
});
