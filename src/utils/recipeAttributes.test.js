import { describe, it, expect } from 'vitest';
import { attributeChips, markManualEdits, emptyAttributes } from './recipeAttributes.js';

describe('attributeChips', () => {
  it('lists meals, then notable attributes, skipping defaults', () => {
    expect(attributeChips({
      ...emptyAttributes('r1'),
      mealTypes: ['dinner', 'lunch'],
      course: 'main',
      protein: 'chicken',
      cuisine: 'middle_eastern',
      effort: 'quick',
      method: 'air_fryer',
      kidFriendly: true,
    })).toEqual(['Lunch', 'Dinner', 'Chicken', 'Middle Eastern', 'Quick', 'Air fryer', 'Kid-friendly']);
  });

  it('returns nothing for missing attributes', () => {
    expect(attributeChips(null)).toEqual([]);
  });
});

describe('markManualEdits', () => {
  it('records only the changed fields, keeping earlier manual ones', () => {
    const original = { ...emptyAttributes('r1'), protein: 'beef', mealTypes: ['dinner'], manualFields: ['cuisine'] };
    const draft = { ...original, protein: 'pork', mealTypes: ['dinner'] };
    expect(markManualEdits(original, draft).manualFields).toEqual(['protein', 'cuisine']);
  });

  it('records meal type changes', () => {
    const original = { ...emptyAttributes('r1'), mealTypes: ['dinner'] };
    const draft = { ...original, mealTypes: ['lunch', 'dinner'] };
    expect(markManualEdits(original, draft).manualFields).toEqual(['meal_types']);
  });
});
