import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase.js', () => ({ supabase: {} }));

const { getEffectiveSortConfig } = await import('./preferences.js');

const userPrefs = { default_sort_config: ['store', 'category', 'name'] };

describe('getEffectiveSortConfig', () => {
  it('uses the account default for store-style list types', () => {
    expect(getEffectiveSortConfig({}, { default_sort_config: ['category', 'name'] }, 'grocery'))
      .toEqual(['category', 'name']);
  });

  it('uses the type default for types with their own default sort', () => {
    expect(getEffectiveSortConfig({}, userPrefs, 'wish_list')).toEqual(['priority', 'name']);
    expect(getEffectiveSortConfig({}, userPrefs, 'todo')).toEqual(['category', 'name']);
    expect(getEffectiveSortConfig({}, userPrefs, 'guest_list')).toEqual(['rsvp', 'name']);
  });

  it('still prefers a per-list override and then a share override', () => {
    expect(getEffectiveSortConfig({ sort_config: ['name'] }, userPrefs, 'wish_list')).toEqual(['name']);
    expect(getEffectiveSortConfig({ sort_config: ['name'] }, userPrefs, 'wish_list', ['price'])).toEqual(['price']);
  });
});
