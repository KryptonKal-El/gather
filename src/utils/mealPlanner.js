/**
 * "Plan my week" suggestion engine. Pure and deterministic given `random`, so it
 * can be unit-tested; the iOS port in MealPlanner.swift mirrors it rule for rule.
 *
 * Variety comes from:
 *  - a per-recipe rest period scaled to how often that recipe is usually made,
 *  - weekly caps on the same protein / cuisine (attribute-level variety),
 *  - one "something new" slot per week,
 *  - resurfacing favourites that haven't been made in a long while,
 *  - quick meals on weeknights, bigger cooks at the weekend,
 *  - nudging recipes that share fresh ingredients onto nearby days,
 *  - a little randomness so equal candidates don't always win in the same order.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GAP_DAYS = 21;
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MAIN_COURSES = new Set([null, undefined, 'main']);

const keyToUtc = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole days from date key `a` to date key `b`. */
export const daysBetween = (a, b) => Math.round((keyToUtc(b) - keyToUtc(a)) / DAY_MS);

/** Monday = 0 … Sunday = 6 for a date key. */
export const weekdayIndex = (key) => (new Date(keyToUtc(key)).getUTCDay() + 6) % 7;

/**
 * Typical days between cooks: the median gap once a recipe has been made twice,
 * clamped to a sensible range; three weeks before that.
 * @param {string[]} cookKeys - Date keys of completed cooks, any order
 */
export const typicalGapDays = (cookKeys) => {
  if (!cookKeys || cookKeys.length < 2) return DEFAULT_GAP_DAYS;
  const sorted = [...cookKeys].sort();
  const gaps = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = daysBetween(sorted[i - 1], sorted[i]);
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return DEFAULT_GAP_DAYS;
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  return Math.min(90, Math.max(7, median));
};

const isEligibleForMeal = (attrs, meal) => {
  if (attrs && !MAIN_COURSES.has(attrs.course) && !(meal === 'breakfast' && attrs.course === 'snack')) return false;
  if (attrs?.mealTypes?.length) return attrs.mealTypes.includes(meal);
  // Untagged (or no meals set): fine for lunch/dinner at reduced confidence, never breakfast.
  return meal !== 'breakfast';
};

const hasMealTag = (attrs, meal) => Boolean(attrs?.mealTypes?.includes(meal));

const weeksText = (days) => {
  const weeks = Math.round(days / 7);
  return weeks <= 1 ? 'over a week' : `${weeks} weeks`;
};

/**
 * Builds suggestions for the empty slots of one week.
 *
 * @param {object} input
 * @param {Array<{date: string, meal: string}>} input.slots - Empty, active slots in day→meal order
 * @param {Array<{date: string, meal: string, recipeId: string|null}>} input.filled - Slots already
 *   holding something this week (manual, kept or locked); their recipes count toward variety
 * @param {Array<{id: string, name: string, cookCount?: number, lastCookedAt?: string|null}>} input.recipes
 * @param {Map<string, object>} input.attributes - recipeId → attributes (camelCase)
 * @param {Map<string, string[]>} input.cookDates - recipeId → date keys of completed cooks
 * @param {Map<string, string>} input.lastPlanned - recipeId → latest date key it was planned before this week
 * @param {Map<string, Set<string>>} [input.excluded] - `date|meal` → recipe ids not to suggest there (swaps)
 * @param {() => number} [input.random] - Returns [0, 1); injectable for tests
 * @returns {{suggestions: Array<{date: string, meal: string, recipeId: string, reason: string}>, libraryNote: string|null}}
 */
export const planWeek = ({
  slots,
  filled = [],
  recipes,
  attributes,
  cookDates,
  lastPlanned,
  excluded = new Map(),
  random = Math.random,
}) => {
  const chosen = filled
    .filter((f) => f.recipeId)
    .map((f) => ({ date: f.date, meal: f.meal, recipeId: f.recipeId }));
  const suggestions = [];
  let usedFallback = false;

  const profile = new Map(recipes.map((r) => {
    const cooks = cookDates.get(r.id) ?? [];
    const lastCook = r.lastCookedAt ? r.lastCookedAt.slice(0, 10) : cooks.slice().sort().at(-1) ?? null;
    const planned = lastPlanned.get(r.id) ?? null;
    const lastSeen = [lastCook, planned].filter(Boolean).sort().at(-1) ?? null;
    return [r.id, {
      recipe: r,
      attrs: attributes.get(r.id) ?? null,
      gap: typicalGapDays(cooks),
      cookCount: r.cookCount ?? cooks.length,
      lastSeen,
      isNew: !lastCook && !planned && (r.cookCount ?? 0) === 0,
    }];
  }));

  // One "something new" slot when planning a week: the first empty dinner from Wednesday on,
  // else any empty dinner. A single-slot swap never claims it.
  const exploreSlot = slots.length < 2 ? null
    : slots.find((s) => s.meal === 'dinner' && weekdayIndex(s.date) >= 2)
      ?? slots.find((s) => s.meal === 'dinner') ?? null;

  const scoreFor = (p, slot, relaxed) => {
    const { attrs } = p;
    if (!isEligibleForMeal(attrs, slot.meal)) return null;
    const blocked = excluded.get(`${slot.date}|${slot.meal}`);
    if (blocked?.has(p.recipe.id)) return null;

    const weekChosen = chosen.map((c) => ({ ...c, p: profile.get(c.recipeId) })).filter((c) => c.p);
    const alreadyThisWeek = weekChosen.some((c) => c.recipeId === p.recipe.id);
    const sameDay = weekChosen.some((c) => c.recipeId === p.recipe.id && c.date === slot.date);
    if (sameDay || (alreadyThisWeek && !relaxed)) return null;

    const daysSince = p.lastSeen ? daysBetween(p.lastSeen, slot.date) : null;
    const resting = daysSince !== null && daysSince < 0.6 * p.gap;
    if (resting && !relaxed) return null;

    const protein = attrs?.protein;
    const cuisine = attrs?.cuisine;
    const proteinCount = protein && protein !== 'none'
      ? weekChosen.filter((c) => c.p.attrs?.protein === protein).length : 0;
    const cuisineCount = cuisine && cuisine !== 'other'
      ? weekChosen.filter((c) => c.p.attrs?.cuisine === cuisine).length : 0;
    if (!relaxed && (proteinCount >= 2 || cuisineCount >= 3)) return null;

    let score = hasMealTag(attrs, slot.meal) ? 1 : 0.7;
    const reasons = [];

    score *= daysSince === null ? 1 : Math.min(1, daysSince / p.gap);
    score *= 1 + 0.25 * Math.log1p(p.cookCount);

    if (p.cookCount >= 2 && daysSince !== null && daysSince >= 2 * p.gap) {
      score *= 1.35;
      reasons.push({ weight: 3, text: `Haven't made this in ${weeksText(daysSince)}` });
    }

    if (p.isNew) {
      const isExplore = exploreSlot && slot.date === exploreSlot.date && slot.meal === exploreSlot.meal;
      score *= isExplore ? 2.5 : 0.85;
      if (isExplore) reasons.push({ weight: 4, text: 'Something new to try' });
    }

    score *= 0.6 ** proteinCount;
    score *= 0.75 ** cuisineCount;

    const weekday = weekdayIndex(slot.date);
    const isWeeknight = weekday <= 3 && slot.meal !== 'breakfast';
    if (attrs?.effort === 'project') score *= isWeeknight ? 0.4 : (weekday >= 5 ? 1.1 : 1);
    if (attrs?.effort === 'quick' && isWeeknight) {
      score *= 1.15;
      reasons.push({ weight: 1, text: 'Quick for a weeknight' });
    }

    if (attrs?.method) {
      const adjacentSameMethod = weekChosen.some((c) => c.meal === slot.meal
        && Math.abs(daysBetween(c.date, slot.date)) === 1 && c.p.attrs?.method === attrs.method);
      if (adjacentSameMethod) score *= 0.85;
    }

    const fresh = attrs?.perishables ?? [];
    if (fresh.length) {
      const shared = [];
      for (const c of weekChosen) {
        const distance = daysBetween(c.date, slot.date);
        if (distance < 0 || distance > 3) continue;
        for (const item of c.p.attrs?.perishables ?? []) {
          if (fresh.includes(item) && !shared.some((s) => s.item === item)) shared.push({ item, date: c.date });
        }
      }
      if (shared.length) {
        score *= 1 + 0.15 * Math.min(shared.length, 2);
        reasons.push({ weight: 2, text: `Uses the rest of ${WEEKDAY_NAMES[weekdayIndex(shared[0].date)]}'s ${shared[0].item}` });
      }
    }

    if (p.cookCount >= 3) reasons.push({ weight: 0.5, text: `A regular — made ${p.cookCount} times` });
    if (daysSince !== null && daysSince >= 14) reasons.push({ weight: 0.25, text: `Last made ${weeksText(daysSince)} ago` });

    if (relaxed) score *= 0.3;
    score *= 0.85 + 0.3 * random();

    const reason = reasons.sort((a, b) => b.weight - a.weight)[0]?.text ?? `Good for ${slot.meal}`;
    return { score, reason };
  };

  for (const slot of slots) {
    let best = null;
    for (const relaxed of [false, true]) {
      for (const p of profile.values()) {
        const result = scoreFor(p, slot, relaxed);
        if (result && (!best || result.score > best.score)) best = { ...result, recipeId: p.recipe.id };
      }
      if (best) {
        if (relaxed) usedFallback = true;
        break;
      }
    }
    if (!best) continue;
    const suggestion = { date: slot.date, meal: slot.meal, recipeId: best.recipeId, reason: best.reason };
    suggestions.push(suggestion);
    chosen.push(suggestion);
  }

  const dinnerLibrary = [...profile.values()].filter((p) => isEligibleForMeal(p.attrs, 'dinner')).length;
  let libraryNote = null;
  if (dinnerLibrary === 0) {
    libraryNote = 'Add a few recipes to get suggestions.';
  } else if (usedFallback || dinnerLibrary < 8) {
    libraryNote = `You have ${dinnerLibrary} ${dinnerLibrary === 1 ? 'recipe' : 'recipes'} for main meals — enough for about ${Math.max(1, Math.floor(dinnerLibrary / 5))} week${dinnerLibrary >= 10 ? 's' : ''} without repeats. Add more and the plan will repeat less.`;
  }

  return { suggestions, libraryNote };
};
