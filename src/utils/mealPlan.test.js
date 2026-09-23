import { describe, it, expect } from 'vitest';
import {
  toDateKey,
  fromDateKey,
  startOfWeek,
  weekDays,
  shiftWeek,
  mergeWeekIngredients,
  entryDisplayTitle,
} from './mealPlan.js';

describe('meal plan week math', () => {
  it('starts weeks on Monday', () => {
    expect(toDateKey(startOfWeek(new Date(2026, 8, 23)))).toBe('2026-09-21'); // Wednesday
    expect(toDateKey(startOfWeek(new Date(2026, 8, 21)))).toBe('2026-09-21'); // Monday
    expect(toDateKey(startOfWeek(new Date(2026, 8, 27)))).toBe('2026-09-21'); // Sunday
  });

  it('builds seven days across a month boundary', () => {
    const days = weekDays(fromDateKey('2026-09-28')).map(toDateKey);
    expect(days).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30',
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    ]);
  });

  it('shifts by whole weeks', () => {
    expect(toDateKey(shiftWeek(fromDateKey('2026-09-21'), 1))).toBe('2026-09-28');
    expect(toDateKey(shiftWeek(fromDateKey('2026-09-21'), -1))).toBe('2026-09-14');
  });

  it('round-trips date keys as local days', () => {
    expect(toDateKey(fromDateKey('2026-01-05'))).toBe('2026-01-05');
  });
});

describe('mergeWeekIngredients', () => {
  const ingredients = [
    { recipeId: 'a', name: 'Onion', quantity: '1' },
    { recipeId: 'a', name: 'Rice', quantity: '2 cups' },
    { recipeId: 'b', name: 'onion ', quantity: '2' },
  ];

  it('merges by name and counts each planned slot', () => {
    expect(mergeWeekIngredients(['a', 'b', 'a'], ingredients)).toEqual([
      { name: 'Onion', quantity: '1', amount: 3, unit: null },
      { name: 'Rice', quantity: '2 cups', amount: 2, unit: null },
    ]);
  });

  it('returns nothing when no recipes are planned', () => {
    expect(mergeWeekIngredients([], ingredients)).toEqual([]);
  });
});

describe('entryDisplayTitle', () => {
  it('prefers the title and falls back to the kind label', () => {
    expect(entryDisplayTitle({ kind: 'recipe', title: 'Tacos' })).toBe('Tacos');
    expect(entryDisplayTitle({ kind: 'eating_out', title: null })).toBe('Eating out');
  });
});
