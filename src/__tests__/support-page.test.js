import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../../');
const supportPagePath = resolve(projectRoot, 'public/support.html');

let htmlContent;

describe('support page (public/support.html)', () => {
  beforeAll(() => {
    htmlContent = readFileSync(supportPagePath, 'utf-8');
  });

  it('file exists and is non-empty', () => {
    expect(htmlContent).toBeTruthy();
    expect(htmlContent.length).toBeGreaterThan(0);
  });

  it('contains correct page title', () => {
    expect(htmlContent).toContain('<title>Support — Gather Lists</title>');
  });

  it('contains accordion elements (details and summary)', () => {
    expect(htmlContent).toContain('<details>');
    expect(htmlContent).toContain('<summary>');
  });

  it('does not contain script tags', () => {
    expect(htmlContent).not.toContain('<script');
  });

  it('contains all 10 FAQ topics', () => {
    const requiredKeywords = [
      'create',
      'share',
      'add',
      'multiple devices',
      'profile picture',
      'recipe',
      'private',
      'dark mode',
      'delete',
      'contact'
    ];
    requiredKeywords.forEach(keyword => {
      expect(htmlContent.toLowerCase()).toContain(keyword.toLowerCase());
    });
  });

  it('contains support email address', () => {
    expect(htmlContent).toContain('support@gatherlists.com');
  });

  it('contains back link to home page', () => {
    expect(htmlContent).toContain('href="/"');
  });

  it('contains responsive styles with media query', () => {
    expect(htmlContent).toContain('@media');
  });

  it('contains correct brand color #3D7A63 in stylesheet', () => {
    expect(htmlContent).toContain('#3D7A63');
  });

  it('contains semantic heading elements', () => {
    expect(htmlContent).toContain('<h1');
    expect(htmlContent).toContain('<h2');
  });
});
