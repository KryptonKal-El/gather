/**
 * Meal plan helpers shared by the web Plan tab: meal/slot vocabularies,
 * Monday-start week math on local calendar days, and week ingredient merging.
 * Plan dates are local calendar days stored as `YYYY-MM-DD` strings.
 */

export const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
];

export const ENTRY_KINDS = [
  { id: 'recipe', label: 'Recipe', icon: '📖' },
  { id: 'custom', label: 'Other meal', icon: '✏️' },
  { id: 'leftovers', label: 'Leftovers', icon: '🥡' },
  { id: 'eating_out', label: 'Eating out', icon: '🍽️' },
  { id: 'skip', label: 'Skip', icon: '⊘' },
];

const KIND_LABELS = Object.fromEntries(ENTRY_KINDS.map((k) => [k.id, k.label]));

/**
 * Text shown for a planned slot: the recipe name snapshot / custom title, or the kind's label.
 * @param {{kind: string, title?: string|null}} entry
 * @returns {string}
 */
export const entryDisplayTitle = (entry) => entry?.title || KIND_LABELS[entry?.kind] || '';

/**
 * Formats a Date as a local `YYYY-MM-DD` key.
 * @param {Date} date
 * @returns {string}
 */
export const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Parses a `YYYY-MM-DD` key as local midnight (not UTC, which `new Date(key)` would use).
 * @param {string} key
 * @returns {Date}
 */
export const fromDateKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * The Monday starting the week that contains `date`, at local midnight.
 * @param {Date} date
 * @returns {Date}
 */
export const startOfWeek = (date) => {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - offset);
  return day;
};

/**
 * The seven days of the week starting at `weekStart`.
 * @param {Date} weekStart
 * @returns {Date[]}
 */
export const weekDays = (weekStart) =>
  Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));

/**
 * Moves a week start by a number of weeks.
 * @param {Date} weekStart
 * @param {number} weeks
 * @returns {Date}
 */
export const shiftWeek = (weekStart, weeks) =>
  new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + weeks * 7);

/**
 * Key for a slot in an entries map.
 * @param {string} dateKey
 * @param {string} meal
 * @returns {string}
 */
export const slotKey = (dateKey, meal) => `${dateKey}|${meal}`;

/**
 * Merges ingredients across the week's planned recipes for the add-to-list flow.
 * Each distinct ingredient (case-insensitive name) appears once; its `amount` is the
 * number of planned recipe slots that use it, so a twice-planned recipe counts twice.
 * @param {string[]} plannedRecipeIds - Recipe id per planned slot, in week order (may repeat)
 * @param {Array<{recipeId: string, name: string, quantity?: string|null}>} ingredients
 * @returns {Array<{name: string, quantity: string|null, amount: number, unit: null}>}
 */
export const mergeWeekIngredients = (plannedRecipeIds, ingredients) => {
  const byRecipe = new Map();
  for (const ingredient of ingredients) {
    const list = byRecipe.get(ingredient.recipeId) ?? [];
    list.push(ingredient);
    byRecipe.set(ingredient.recipeId, list);
  }

  const merged = new Map();
  for (const recipeId of plannedRecipeIds) {
    for (const ingredient of byRecipe.get(recipeId) ?? []) {
      const key = ingredient.name.trim().toLowerCase();
      if (!key) continue;
      const existing = merged.get(key);
      if (existing) {
        existing.amount += 1;
      } else {
        merged.set(key, { name: ingredient.name.trim(), quantity: ingredient.quantity ?? null, amount: 1, unit: null });
      }
    }
  }
  return [...merged.values()];
};
