import { describe, it, expect } from 'vitest';
import { getSuggestions } from './suggestions.js';

describe('getSuggestions', () => {
  it('suggests frequently used items not already on the list', () => {
    const history = [
      { name: 'Milk', addedAt: '2026-06-01' },
      { name: 'Milk', addedAt: '2026-06-02' },
      { name: 'Eggs', addedAt: '2026-06-03' },
    ];
    const suggestions = getSuggestions(history, []);
    const names = suggestions.map((s) => s.name.toLowerCase());
    expect(names).toContain('milk');
  });

  it('excludes items already present in the current list', () => {
    const history = [
      { name: 'Milk', addedAt: '2026-06-01' },
      { name: 'Milk', addedAt: '2026-06-02' },
    ];
    const suggestions = getSuggestions(history, [{ name: 'Milk' }]);
    expect(suggestions.map((s) => s.name.toLowerCase())).not.toContain('milk');
  });

  it('carries the latest known image for a suggested item (Bug 2)', () => {
    const history = [
      { name: 'Apples', addedAt: '2026-06-01', imageUrl: null },
      { name: 'Apples', addedAt: '2026-06-02', imageUrl: 'https://img/apples-old.jpg' },
      { name: 'Apples', addedAt: '2026-06-03', imageUrl: 'https://img/apples-new.jpg' },
    ];
    const suggestions = getSuggestions(history, []);
    const apples = suggestions.find((s) => s.name.toLowerCase() === 'apples');
    expect(apples).toBeDefined();
    expect(apples.imageUrl).toBe('https://img/apples-new.jpg');
  });

  it('returns null image when history has no image for the item', () => {
    const history = [
      { name: 'Bananas', addedAt: '2026-06-01' },
      { name: 'Bananas', addedAt: '2026-06-02' },
    ];
    const suggestions = getSuggestions(history, []);
    const bananas = suggestions.find((s) => s.name.toLowerCase() === 'bananas');
    expect(bananas.imageUrl).toBeNull();
  });
});
