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
