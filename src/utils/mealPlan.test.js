import { describe, it, expect } from 'vitest';
import {
  toDateKey,
  fromDateKey,
  startOfWeek,
  startOfDay,
  weekDays,
  shiftWeek,
  shiftDays,
  mergeWeekIngredients,
  entryDisplayTitle,
  dealWeekday,
  dealsForSlot,
  dealBadgeText,
  dealWeekdaysText,
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

  it('builds an arbitrary-length range for custom windows', () => {
    expect(weekDays(fromDateKey('2026-09-30'), 1).map(toDateKey)).toEqual(['2026-09-30']);
    expect(weekDays(fromDateKey('2026-09-30'), 3).map(toDateKey)).toEqual([
      '2026-09-30', '2026-10-01', '2026-10-02',
    ]);
    // A ten-day range crosses the month boundary.
    expect(weekDays(fromDateKey('2026-09-28'), 10)).toHaveLength(10);
    expect(toDateKey(weekDays(fromDateKey('2026-09-28'), 10)[9])).toBe('2026-10-07');
  });

  it('shifts by a run of days and snaps to local midnight', () => {
    expect(toDateKey(shiftDays(fromDateKey('2026-09-28'), 9))).toBe('2026-10-07');
    expect(toDateKey(shiftDays(fromDateKey('2026-09-28'), -3))).toBe('2026-09-25');
    const noon = new Date(2026, 8, 28, 12, 30);
    expect(toDateKey(startOfDay(noon))).toBe('2026-09-28');
    expect(startOfDay(noon).getHours()).toBe(0);
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

describe('eat-out deals', () => {
  const tuesdayDinner = { id: 'a', restaurant: "Chili's", details: 'Kids eat free', weekdays: [1], meals: ['dinner'], isActive: true };
  const weekendBreakfast = { id: 'b', restaurant: 'IHOP', details: null, weekdays: [5, 6], meals: ['breakfast', 'lunch'], isActive: true };
  const switchedOff = { ...tuesdayDinner, id: 'c', isActive: false };
  const deals = [tuesdayDinner, weekendBreakfast, switchedOff];

  it('numbers weekdays from Monday', () => {
    expect(dealWeekday('2026-10-12')).toBe(0); // Monday
    expect(dealWeekday('2026-10-13')).toBe(1); // Tuesday
    expect(dealWeekday('2026-10-18')).toBe(6); // Sunday
  });

  it('matches only switched-on deals for the day and meal', () => {
    expect(dealsForSlot(deals, '2026-10-13', 'dinner').map((d) => d.id)).toEqual(['a']);
    expect(dealsForSlot(deals, '2026-10-13', 'lunch')).toEqual([]);
    expect(dealsForSlot(deals, '2026-10-17', 'breakfast').map((d) => d.id)).toEqual(['b']);
    expect(dealsForSlot(deals, '2026-10-18', 'lunch').map((d) => d.id)).toEqual(['b']);
    expect(dealsForSlot(deals, '2026-10-14', 'dinner')).toEqual([]);
  });

  it('describes deals for badges and lists', () => {
    expect(dealBadgeText(tuesdayDinner)).toBe("Kids eat free at Chili's");
    expect(dealBadgeText(weekendBreakfast)).toBe('Deal at IHOP');
    expect(dealWeekdaysText([6, 5])).toBe('Sat, Sun');
    expect(dealWeekdaysText([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
  });
});
