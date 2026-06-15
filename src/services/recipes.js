/**
 * Recipe parsing service - converts recipe text to structured shopping list items.
 * Handles common recipe formats with ingredient quantities and units.
 */

import { v4 as uuidv4 } from 'uuid';
import { categorizeItem } from '../utils/categories.js';

/**
 * Common cooking measurements to strip from ingredient names.
 */
const UNITS = [
  'cups?', 'cup', 'tbsp', 'tablespoons?', 'tsp', 'teaspoons?',
  'oz', 'ounces?', 'lbs?', 'pounds?', 'grams?', 'kg',
  'ml', 'liters?', 'quarts?', 'pints?', 'gallons?',
  'cloves?', 'slices?', 'pieces?', 'cans?', 'packages?',
  'bunches?', 'heads?', 'stalks?', 'sprigs?', 'pinch(?:es)?',
  'dash(?:es)?', 'handful(?:s)?',
];

const UNIT_PATTERN = new RegExp(
  `^[\\d./\\s-]+(?:${UNITS.join('|')})\\s+(?:of\\s+)?`,
  'i'
);

/**
 * Strips quantity and unit prefix from an ingredient line.
 * "2 cups flour" -> "flour"
 * "1/2 lb ground beef" -> "ground beef"
 * @param {string} line - A single ingredient line
 * @returns {string} The ingredient name without quantity/unit
 */
const stripQuantity = (line) => {
  let cleaned = line
    .replace(/\(.*?\)/g, '')   // Remove parenthetical notes
    .replace(/,.*$/, '')       // Remove everything after comma (prep instructions)
    .trim();

  // Remove leading numbers and fractions
  cleaned = cleaned.replace(/^[\d./\s-]+/, '').trim();

  // Remove unit words
  cleaned = cleaned.replace(UNIT_PATTERN, '').trim();

  // If stripping removed everything, fall back to original
  if (!cleaned) {
    cleaned = line.replace(/^[\d./\s-]+/, '').trim();
  }

  return cleaned;
};

/**
 * Parses raw recipe text into structured shopping list items.
 * Handles various formats:
 * - "2 cups flour"
 * - "- 1 lb ground beef"
 * - "3 cloves garlic, minced"
 * @param {string} recipeText - Raw recipe text with one ingredient per line
 * @param {string} [listType] - The list type for auto-categorization (e.g., 'grocery', 'packing')
 * @returns {Array<{id: string, name: string, category: string, isChecked: boolean}>}
 */
export const parseRecipeText = (recipeText, listType) => {
  if (!recipeText?.trim()) {
    return [];
  }

  const lines = recipeText
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line.length > 0 && !/^(instructions|directions|steps|method)/i.test(line));

  const items = [];
  const seen = new Set();

  for (const line of lines) {
    const name = stripQuantity(line);
    const key = name.toLowerCase();

    if (key.length < 2 || seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push({
      id: uuidv4(),
      name: name.charAt(0).toUpperCase() + name.slice(1),
      category: categorizeItem(name, undefined, listType),
      isChecked: false,
    });
  }

  return items;
};

/**
 * Builds the structured fallback result from the local line parser.
 * @param {string} recipeText
 * @returns {{ name: string, ingredients: Array<{quantity: string, name: string}>, steps: string[], source: 'local' }}
 */
const localFallbackParse = (recipeText) => ({
  name: '',
  ingredients: parseRecipeText(recipeText).map((item) => ({ quantity: '', name: item.name })),
  steps: [],
  source: 'local',
});

/**
 * Parses freeform recipe text into structured fields (name, ingredients with
 * quantities, and ordered steps) using the parse-recipe Edge Function (Claude).
 * Falls back to the local line parser if the function is unavailable or fails,
 * so import always returns something usable.
 * @param {string} recipeText - Raw pasted recipe text
 * @returns {Promise<{ name: string, ingredients: Array<{quantity: string, name: string}>, steps: string[], source: 'ai' | 'local' }>}
 */
export const parseRecipeFromText = async (recipeText) => {
  const text = recipeText?.trim();
  if (!text) return { name: '', ingredients: [], steps: [], source: 'local' };

  const baseUrl = import.meta.env.VITE_SUPABASE_EDGE_FUNCTION_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    return localFallbackParse(text);
  }

  try {
    const res = await fetch(`${baseUrl}/parse-recipe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      // 503 = key not configured; any other error -> fall back gracefully.
      return localFallbackParse(text);
    }

    const data = await res.json();
    const ingredients = Array.isArray(data.ingredients)
      ? data.ingredients
          .map((ing) => ({
            quantity: typeof ing?.quantity === 'string' ? ing.quantity : '',
            name: typeof ing?.name === 'string' ? ing.name.trim() : '',
          }))
          .filter((ing) => ing.name)
      : [];
    const steps = Array.isArray(data.steps)
      ? data.steps.filter((s) => typeof s === 'string' && s.trim())
      : [];

    // If the model returned nothing useful, fall back rather than import an empty recipe.
    if (ingredients.length === 0 && steps.length === 0) {
      return localFallbackParse(text);
    }

    return {
      name: typeof data.name === 'string' ? data.name.trim() : '',
      ingredients,
      steps,
      source: 'ai',
    };
  } catch (err) {
    console.error('Recipe text parse failed, using local fallback:', err);
    return localFallbackParse(text);
  }
};
