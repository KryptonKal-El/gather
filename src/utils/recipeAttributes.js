/**
 * Recipe attribute vocabulary shared by the web recipe details UI (and, later,
 * the planner). Values match the `recipe_attributes` check constraints and the
 * iOS enums in RecipeAttributes.swift.
 */

export const COURSES = [
  { id: 'main', label: 'Main dish' },
  { id: 'side', label: 'Side' },
  { id: 'dessert', label: 'Dessert' },
  { id: 'snack', label: 'Snack' },
  { id: 'drink', label: 'Drink' },
  { id: 'component', label: 'Sauce / base' },
];

export const PROTEINS = [
  { id: 'chicken', label: 'Chicken' },
  { id: 'beef', label: 'Beef' },
  { id: 'pork', label: 'Pork' },
  { id: 'lamb', label: 'Lamb' },
  { id: 'turkey', label: 'Turkey' },
  { id: 'fish', label: 'Fish' },
  { id: 'shellfish', label: 'Shellfish' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'tofu', label: 'Tofu / tempeh' },
  { id: 'beans', label: 'Beans / lentils' },
  { id: 'dairy', label: 'Cheese / dairy' },
  { id: 'none', label: 'No main protein' },
];

export const CUISINES = [
  'american', 'mexican', 'italian', 'french', 'spanish', 'greek', 'mediterranean',
  'middle_eastern', 'indian', 'chinese', 'japanese', 'korean', 'thai',
  'vietnamese', 'caribbean', 'african', 'other',
].map((id) => ({
  id,
  label: id === 'middle_eastern' ? 'Middle Eastern' : id.charAt(0).toUpperCase() + id.slice(1),
}));

export const EFFORTS = [
  { id: 'quick', label: 'Quick (under 30 min)', chip: 'Quick' },
  { id: 'medium', label: 'Medium', chip: 'Medium effort' },
  { id: 'project', label: 'Project (1 hr+)', chip: 'Project' },
];

export const METHODS = [
  { id: 'stovetop', label: 'Stovetop' },
  { id: 'oven', label: 'Oven' },
  { id: 'grill', label: 'Grill' },
  { id: 'slow_cooker', label: 'Slow cooker' },
  { id: 'pressure_cooker', label: 'Pressure cooker' },
  { id: 'air_fryer', label: 'Air fryer' },
  { id: 'fried', label: 'Fried' },
  { id: 'no_cook', label: 'No cook' },
];

/** Field names recorded in `manualFields` when a person edits them. */
export const ATTRIBUTE_FIELDS = ['course', 'mealTypes', 'protein', 'cuisine', 'effort', 'method', 'kidFriendly'];

/** DB column name for each field, as stored in `manual_fields` (shared with iOS). */
export const FIELD_COLUMNS = {
  course: 'course',
  mealTypes: 'meal_types',
  protein: 'protein',
  cuisine: 'cuisine',
  effort: 'effort',
  method: 'method',
  kidFriendly: 'kid_friendly',
};

const labelOf = (options, id) => options.find((o) => o.id === id)?.label;

/**
 * An empty attributes object for a recipe with none yet.
 * @param {string} recipeId
 */
export const emptyAttributes = (recipeId) => ({
  recipeId,
  course: null,
  mealTypes: [],
  protein: null,
  cuisine: null,
  effort: null,
  method: null,
  kidFriendly: null,
  perishables: [],
  manualFields: [],
  autoSourceHash: null,
  autoTaggedAt: null,
});

/**
 * Short labels for display chips, in the same order as iOS.
 * @param {object|null} attributes
 * @returns {string[]}
 */
export const attributeChips = (attributes) => {
  if (!attributes) return [];
  const chips = ['breakfast', 'lunch', 'dinner']
    .filter((m) => attributes.mealTypes?.includes(m))
    .map((m) => m.charAt(0).toUpperCase() + m.slice(1));
  if (attributes.course && attributes.course !== 'main') chips.push(labelOf(COURSES, attributes.course));
  if (attributes.protein && attributes.protein !== 'none') chips.push(labelOf(PROTEINS, attributes.protein));
  if (attributes.cuisine && attributes.cuisine !== 'other') chips.push(labelOf(CUISINES, attributes.cuisine));
  if (attributes.effort) chips.push(EFFORTS.find((e) => e.id === attributes.effort)?.chip);
  if (attributes.method) chips.push(labelOf(METHODS, attributes.method));
  if (attributes.kidFriendly === true) chips.push('Kid-friendly');
  return chips.filter(Boolean);
};

/**
 * Returns `draft` with `manualFields` extended by every field that differs from `original`,
 * so automatic tagging on iOS never overwrites a person's choice.
 * @param {object} original
 * @param {object} draft
 * @returns {object}
 */
export const markManualEdits = (original, draft) => {
  const manual = new Set(original.manualFields ?? []);
  for (const field of ATTRIBUTE_FIELDS) {
    const before = original[field];
    const after = draft[field];
    const changed = Array.isArray(before) || Array.isArray(after)
      ? JSON.stringify(before ?? []) !== JSON.stringify(after ?? [])
      : (before ?? null) !== (after ?? null);
    if (changed) manual.add(FIELD_COLUMNS[field]);
  }
  return {
    ...draft,
    manualFields: ATTRIBUTE_FIELDS.map((f) => FIELD_COLUMNS[f]).filter((c) => manual.has(c)),
  };
};
