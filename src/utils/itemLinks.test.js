import { describe, it, expect } from 'vitest';
import { normalizeItemUrl, getUrlHostLabel } from './itemLinks.js';

describe('normalizeItemUrl', () => {
  it('returns null for empty input', () => {
    expect(normalizeItemUrl('')).toBeNull();
    expect(normalizeItemUrl('   ')).toBeNull();
    expect(normalizeItemUrl(null)).toBeNull();
  });

  it('adds https:// when the scheme is missing', () => {
    expect(normalizeItemUrl('amazon.com/dp/123')).toBe('https://amazon.com/dp/123');
  });

  it('keeps http and https links', () => {
    expect(normalizeItemUrl('http://example.com/a')).toBe('http://example.com/a');
    expect(normalizeItemUrl(' https://shop.example.com/x?y=1 ')).toBe('https://shop.example.com/x?y=1');
  });

  it('rejects non-web schemes and bare words', () => {
    expect(normalizeItemUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeItemUrl('mailto:a@b.com')).toBeNull();
    expect(normalizeItemUrl('headphones')).toBeNull();
  });
});

describe('getUrlHostLabel', () => {
  it('strips www.', () => {
    expect(getUrlHostLabel('https://www.etsy.com/listing/1')).toBe('etsy.com');
  });
});
