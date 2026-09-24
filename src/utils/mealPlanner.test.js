import { describe, it, expect } from 'vitest';
import { planWeek, typicalGapDays, daysBetween, weekdayIndex, buildPreferences, learnQuickWeekdays } from './mealPlanner.js';

const WEEK = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
const dinners = WEEK.map((date) => ({ date, meal: 'dinner' }));
const fixedRandom = () => 0.5;

const recipe = (id, extra = {}) => ({ id, name: id, cookCount: 0, lastCookedAt: null, ...extra });
const tags = (extra = {}) => ({ course: 'main', mealTypes: ['dinner'], perishables: [], ...extra });

const baseInput = (recipes, attrs = {}, extra = {}) => ({
  slots: dinners,
  recipes,
  attributes: new Map(Object.entries(attrs)),
  cookDates: new Map(),
  lastPlanned: new Map(),
  random: fixedRandom,
  ...extra,
});

describe('date helpers', () => {
  it('counts days and weekdays on date keys', () => {
    expect(daysBetween('2026-09-28', '2026-10-04')).toBe(6);
    expect(weekdayIndex('2026-09-28')).toBe(0);
    expect(weekdayIndex('2026-10-04')).toBe(6);
  });

  it('uses the median cooking gap, with a three-week default', () => {
    expect(typicalGapDays([])).toBe(21);
    expect(typicalGapDays(['2026-01-01', '2026-01-15', '2026-01-29', '2026-03-01'])).toBe(14);
    expect(typicalGapDays(['2026-01-01', '2026-01-02'])).toBe(7);
  });
});

describe('planWeek', () => {
  const many = Array.from({ length: 12 }, (_, i) => recipe(`r${i}`, { cookCount: 1, lastCookedAt: '2026-06-01' }));

  it('fills every empty slot without repeating a recipe in the week', () => {
    const { suggestions, libraryNote } = planWeek(baseInput(many));
    expect(suggestions).toHaveLength(7);
    expect(new Set(suggestions.map((s) => s.recipeId)).size).toBe(7);
    expect(libraryNote).toBeNull();
  });

  it('rests a recipe made recently', () => {
    const recipes = [recipe('recent', { cookCount: 5, lastCookedAt: '2026-09-26' }), ...many];
    const { suggestions } = planWeek(baseInput(recipes));
    expect(suggestions.map((s) => s.recipeId)).not.toContain('recent');
  });

  it('treats last week\'s planned meals as recent too', () => {
    const recipes = [recipe('planned'), ...many];
    const input = baseInput(recipes, {}, { lastPlanned: new Map([['planned', '2026-09-25']]) });
    expect(planWeek(input).suggestions.map((s) => s.recipeId)).not.toContain('planned');
  });

  it('caps the same protein at two per week', () => {
    const proteins = ['chicken', 'chicken', 'chicken', 'chicken', 'chicken', 'beef', 'beef', 'beef', 'pork', 'pork', 'tofu', 'tofu'];
    const recipes = proteins.map((_, i) => recipe(`p${i}`, { cookCount: 1, lastCookedAt: '2026-06-01' }));
    const attrs = Object.fromEntries(recipes.map((r, i) => [r.id, tags({ protein: proteins[i] })]));
    const { suggestions } = planWeek(baseInput(recipes, attrs));
    expect(suggestions).toHaveLength(7);
    const counts = suggestions.reduce((acc, s) => {
      const protein = attrs[s.recipeId].protein;
      return { ...acc, [protein]: (acc[protein] ?? 0) + 1 };
    }, {});
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
  });

  it('only suggests breakfast recipes for breakfast', () => {
    const recipes = [recipe('pancakes'), recipe('stew')];
    const attrs = { pancakes: tags({ mealTypes: ['breakfast'] }), stew: tags({ mealTypes: ['dinner'] }) };
    const input = baseInput(recipes, attrs, { slots: [{ date: WEEK[0], meal: 'breakfast' }, { date: WEEK[0], meal: 'dinner' }] });
    const { suggestions } = planWeek(input);
    expect(suggestions).toEqual([
      expect.objectContaining({ meal: 'breakfast', recipeId: 'pancakes' }),
      expect.objectContaining({ meal: 'dinner', recipeId: 'stew' }),
    ]);
  });

  it('never suggests sauces, sides or drinks as a meal', () => {
    const recipes = [recipe('salsa'), recipe('rice'), recipe('tacos')];
    const attrs = {
      salsa: tags({ course: 'component' }),
      rice: tags({ course: 'side' }),
      tacos: tags(),
    };
    const input = baseInput(recipes, attrs, { slots: [{ date: WEEK[0], meal: 'dinner' }] });
    expect(planWeek(input).suggestions[0].recipeId).toBe('tacos');
  });

  it('brings back a long-forgotten favourite with a reason', () => {
    const recipes = [
      recipe('fav', { cookCount: 6, lastCookedAt: '2026-06-01' }),
      recipe('other', { cookCount: 1, lastCookedAt: '2026-08-01' }),
    ];
    const cookDates = new Map([['fav', ['2026-04-01', '2026-04-15', '2026-04-29', '2026-05-13', '2026-05-27', '2026-06-01']]]);
    const input = baseInput(recipes, { fav: tags(), other: tags() }, { cookDates, slots: [{ date: WEEK[0], meal: 'dinner' }] });
    const [first] = planWeek(input).suggestions;
    expect(first.recipeId).toBe('fav');
    expect(first.reason).toMatch(/Haven't made this in \d+ weeks/);
  });

  it('keeps one mid-week dinner for something new', () => {
    const recipes = [recipe('brandNew'), ...many];
    const { suggestions } = planWeek(baseInput(recipes));
    const pick = suggestions.find((s) => s.recipeId === 'brandNew');
    expect(pick).toEqual(expect.objectContaining({ date: WEEK[2], reason: 'Something new to try' }));
  });

  it('does not label a single-slot swap as something new', () => {
    const recipes = [recipe('brandNew'), recipe('old', { cookCount: 1, lastCookedAt: '2026-06-01' })];
    const input = baseInput(recipes, {}, { slots: [{ date: WEEK[2], meal: 'dinner' }] });
    const [pick] = planWeek(input).suggestions;
    expect(pick.reason).not.toBe('Something new to try');
  });

  it('prefers quick meals on weeknights', () => {
    const recipes = [recipe('quick', { cookCount: 1, lastCookedAt: '2026-06-01' }), recipe('project', { cookCount: 1, lastCookedAt: '2026-06-01' })];
    const attrs = { quick: tags({ effort: 'quick' }), project: tags({ effort: 'project' }) };
    const input = baseInput(recipes, attrs, { slots: [{ date: WEEK[1], meal: 'dinner' }] });
    const [pick] = planWeek(input).suggestions;
    expect(pick).toEqual(expect.objectContaining({ recipeId: 'quick', reason: 'Quick for a busy day' }));
  });

  it('nudges recipes that share fresh ingredients onto nearby days', () => {
    const recipes = ['a', 'b', 'c'].map((id) => recipe(id, { cookCount: 1, lastCookedAt: '2026-06-01' }));
    const attrs = { a: tags({ perishables: ['cilantro'] }), b: tags({ perishables: ['cilantro'] }), c: tags() };
    const input = baseInput(recipes, attrs, {
      slots: [{ date: WEEK[1], meal: 'dinner' }],
      filled: [{ date: WEEK[0], meal: 'dinner', recipeId: 'a' }],
    });
    const [pick] = planWeek(input).suggestions;
    expect(pick).toEqual(expect.objectContaining({ recipeId: 'b', reason: "Uses the rest of Monday's cilantro" }));
  });

  it('skips recipes excluded for a slot (swap)', () => {
    const input = baseInput(many, {}, {
      slots: [{ date: WEEK[0], meal: 'dinner' }],
      excluded: new Map([[`${WEEK[0]}|dinner`, new Set(many.slice(0, 11).map((r) => r.id))]]),
    });
    expect(planWeek(input).suggestions[0].recipeId).toBe('r11');
  });

  it('says so when the library is too small instead of silently repeating', () => {
    const few = [recipe('x', { cookCount: 1, lastCookedAt: '2026-06-01' }), recipe('y', { cookCount: 1, lastCookedAt: '2026-06-01' })];
    const { suggestions, libraryNote } = planWeek(baseInput(few));
    expect(suggestions.length).toBeGreaterThan(0);
    expect(libraryNote).toMatch(/You have 2 recipes for main meals/);
  });

  it('suggests a recipe the household keeps swapping away less often', () => {
    const recipes = [recipe('swapped', { cookCount: 1, lastCookedAt: '2026-06-01' }), recipe('neutral', { cookCount: 1, lastCookedAt: '2026-06-01' })];
    const feedback = ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-20']
      .map((date) => ({ recipeId: 'swapped', event: 'swapped', date }));
    const preferences = buildPreferences({ todayKey: '2026-09-27', feedback });
    const winsFor = (prefs) => {
      let wins = 0;
      for (let i = 0; i < 20; i += 1) {
        for (let j = 0; j < 20; j += 1) {
          const draws = [(i + 0.5) / 20, (j + 0.5) / 20];
          let n = 0;
          const random = () => draws[n++ % 2];
          const input = baseInput(recipes, {}, { slots: [{ date: WEEK[5], meal: 'dinner' }], preferences: prefs, random });
          if (planWeek(input).suggestions[0].recipeId === 'swapped') wins += 1;
        }
      }
      return wins;
    };
    const baseline = winsFor(new Map());
    const learned = winsFor(preferences);
    expect(baseline).toBeGreaterThan(150);
    expect(learned).toBeLessThan(baseline / 2);
  });

  it('favours a recipe the household keeps and cooks, but still rests it', () => {
    const recipes = [recipe('loved', { cookCount: 3, lastCookedAt: '2026-09-01' }), recipe('neutral', { cookCount: 1, lastCookedAt: '2026-06-01' })];
    const cooks = ['2026-07-06', '2026-08-03', '2026-09-01'].map((date) => ({ recipeId: 'loved', date }));
    const feedback = [{ recipeId: 'loved', event: 'kept', date: '2026-09-10' }];
    const preferences = buildPreferences({ todayKey: '2026-09-27', cooks, feedback });
    const cookDates = new Map([['loved', cooks.map((c) => c.date)]]);
    const input = baseInput(recipes, {}, { slots: [{ date: WEEK[5], meal: 'dinner' }], preferences, cookDates });
    const [pick] = planWeek(input).suggestions;
    expect(pick.recipeId).toBe('loved');
    expect(pick.reason).toBe('A household favourite');

    const resting = baseInput([recipe('loved', { cookCount: 4, lastCookedAt: '2026-09-25' }), recipes[1]], {}, {
      slots: [{ date: WEEK[0], meal: 'dinner' }],
      preferences,
      cookDates,
    });
    expect(planWeek(resting).suggestions[0].recipeId).toBe('neutral');
  });

  it('fades old reactions', () => {
    const recent = buildPreferences({ todayKey: '2026-09-27', feedback: [{ recipeId: 'x', event: 'swapped', date: '2026-09-27' }] });
    const old = buildPreferences({ todayKey: '2026-09-27', feedback: [{ recipeId: 'x', event: 'swapped', date: '2026-05-30' }] });
    expect(recent.get('x').negative).toBeCloseTo(1);
    expect(old.get('x').negative).toBeLessThan(0.3);
  });

  it('counts planned meals that were never cooked gently against a recipe', () => {
    const prefs = buildPreferences({
      todayKey: '2026-09-27',
      planned: [
        { recipeId: 'a', date: '2026-09-20', cooked: false },
        { recipeId: 'b', date: '2026-09-20', cooked: true },
        { recipeId: 'c', date: '2026-09-30', cooked: false },
      ],
    });
    expect(prefs.get('a').negative).toBeGreaterThan(0);
    expect(prefs.has('b')).toBe(false);
    expect(prefs.has('c')).toBe(false);
  });
});

describe('learnQuickWeekdays', () => {
  it('uses Monday–Thursday until there is enough history', () => {
    expect([...learnQuickWeekdays([])].sort()).toEqual([0, 1, 2, 3]);
  });

  it('learns busy days from how long cooks take', () => {
    const sessions = [
      ...[0, 0, 0].map((weekday) => ({ weekday, minutes: 25 })),
      ...[2, 2, 2].map((weekday) => ({ weekday, minutes: 75 })),
      ...[5, 5, 6, 6].map((weekday) => ({ weekday, minutes: 90 })),
    ];
    const quick = learnQuickWeekdays(sessions);
    expect(quick.has(0)).toBe(true);
    expect(quick.has(2)).toBe(false);
    expect(quick.has(1)).toBe(true);
    expect(quick.has(5)).toBe(false);
  });
});

describe('week note adjustments', () => {
  const recipes = ['a', 'b', 'c'].map((id) => recipe(id, { cookCount: 1, lastCookedAt: '2026-06-01' }));

  it('boosts recipes from the note and explains why', () => {
    const input = baseInput(recipes, {}, {
      slots: [{ date: WEEK[5], meal: 'dinner' }],
      boosts: new Map([['c', { factor: 2, reason: 'Uses up your spinach' }]]),
    });
    expect(planWeek(input).suggestions[0]).toEqual(expect.objectContaining({ recipeId: 'c', reason: 'Uses up your spinach' }));
  });

  it('never suggests avoided recipes, even when short of options', () => {
    const input = baseInput(recipes, {}, { avoided: new Set(['a', 'b']) });
    const ids = planWeek(input).suggestions.map((s) => s.recipeId);
    expect(ids.every((id) => id === 'c')).toBe(true);
  });
});

