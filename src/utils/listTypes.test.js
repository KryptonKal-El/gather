import { describe, expect, it } from 'vitest';

import { LIST_TYPES, LIST_TYPE_IDS, WISH_LIST_CATEGORIES, getTypeConfig } from './listTypes.js';
import { categorizeItem, getSystemDefaultCategories } from './categories.js';

describe('list type store field support', () => {
  it('enables store fields and sorting for packing lists', () => {
    expect(LIST_TYPES.packing.fields.store).toBe(true);
    expect(LIST_TYPES.packing.sortLevels).toContain('store');
  });

  it('enables store fields and sorting for project lists', () => {
    expect(LIST_TYPES.project.fields.store).toBe(true);
    expect(LIST_TYPES.project.sortLevels).toContain('store');
  });
});

describe('wish list type', () => {
  it('is registered and selectable', () => {
    expect(LIST_TYPE_IDS).toContain('wish_list');
    expect(getTypeConfig('wish_list').label).toBe('Wish List');
  });

  it('shows link, priority, image and price but not grocery units or due dates', () => {
    const { fields } = LIST_TYPES.wish_list;
    expect(fields).toMatchObject({ url: true, priority: true, image: true, price: true, unit: false, dueDate: false });
  });

  it('defaults to priority then name, with its own categories', () => {
    expect(LIST_TYPES.wish_list.defaultSort).toEqual(['priority', 'name']);
    expect(getSystemDefaultCategories('wish_list')).toBe(WISH_LIST_CATEGORIES);
    expect(categorizeItem('Noise cancelling headphones', WISH_LIST_CATEGORIES, 'wish_list')).toBe('tech');
  });

  it('keeps url and priority off for every other type', () => {
    for (const id of LIST_TYPE_IDS.filter((t) => t !== 'wish_list')) {
      expect(LIST_TYPES[id].fields.url).toBe(false);
      expect(LIST_TYPES[id].fields.priority).toBe(false);
    }
  });
});
