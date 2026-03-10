/**
 * Unit mapping from Spoonacular API units to Gather Lists units.
 */

const UNIT_MAP = {
  cups: 'cups',
  cup: 'cups',
  tablespoons: 'tbsp',
  tablespoon: 'tbsp',
  tbsp: 'tbsp',
  tbsps: 'tbsp',
  teaspoons: 'tsp',
  teaspoon: 'tsp',
  tsp: 'tsp',
  tsps: 'tsp',
  ounces: 'oz',
  ounce: 'oz',
  oz: 'oz',
  pounds: 'lb',
  pound: 'lb',
  lb: 'lb',
  lbs: 'lb',
  grams: 'g',
  gram: 'g',
  g: 'g',
  kilograms: 'kg',
  kilogram: 'kg',
  kg: 'kg',
  milliliters: 'ml',
  milliliter: 'ml',
  ml: 'ml',
  liters: 'L',
  liter: 'L',
  l: 'L',
  pinch: 'pinch',
  pinches: 'pinch',
  dozen: 'dozen',
};

/**
 * Maps a Spoonacular unit string to a Gather Lists unit.
 * @param {string} unit - The unit from Spoonacular API
 * @returns {string} The mapped unit, or 'each' if unrecognized
 */
export const mapSpoonacularUnit = (unit) => {
  if (!unit) return 'each';
  return UNIT_MAP[unit.toLowerCase()] ?? 'each';
};
