/**
 * AI suggestion engine that recommends items based on shopping history,
 * frequently purchased items, and common pairings.
 */

import { categorizeItem } from '../utils/categories.js';

/**
 * Common item pairings - when one item is added, suggest the other.
 * Each pair is bidirectional.
 */
const ITEM_PAIRINGS = [
  ['bread', 'butter'],
  ['pasta', 'tomato sauce'],
  ['chips', 'salsa'],
  ['hamburger buns', 'ground beef'],
  ['hot dog buns', 'hot dogs'],
  ['cereal', 'milk'],
  ['peanut butter', 'jelly'],
  ['eggs', 'bacon'],
  ['lettuce', 'tomatoes'],
  ['tortillas', 'cheese'],
  ['rice', 'beans'],
  ['spaghetti', 'parmesan'],
  ['coffee', 'cream'],
  ['crackers', 'cheese'],
  ['avocado', 'lime'],
  ['chicken', 'rice'],
  ['salmon', 'lemon'],
  ['steak', 'potatoes'],
];

/**
 * Calculates item frequency from shopping history.
 * @param {Array<{name: string, addedAt: string}>} history - Past items
 * @returns {Map<string, number>} Item name -> purchase count
 */
const getItemFrequency = (history) => {
  const freq = new Map();
  for (const item of history) {
    const key = item.name.toLowerCase();
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  return freq;
};

/**
 * Finds paired item suggestions based on what's currently in the list.
 * @param {Array<{name: string}>} currentItems - Items currently in the list
 * @returns {string[]} Suggested item names from pairings
 */
const getPairingSuggestions = (currentItems) => {
  const currentNames = new Set(currentItems.map((i) => i.name.toLowerCase()));
  const suggestions = [];

  for (const [a, b] of ITEM_PAIRINGS) {
    if (currentNames.has(a) && !currentNames.has(b)) {
      suggestions.push(b);
    }
    if (currentNames.has(b) && !currentNames.has(a)) {
      suggestions.push(a);
    }
  }

  return suggestions;
};

/**
 * Generates AI-powered suggestions based on history and current list.
 * @param {Array<{name: string, addedAt: string}>} history - Past shopping items
 * @param {Array<{name: string}>} currentItems - Items currently in the list
 * @param {number} [maxSuggestions=8] - Maximum number of suggestions to return
 * @param {string} [listType] - The list type for auto-categorization (e.g., 'grocery', 'packing')
 * @returns {Array<{name: string, reason: string, category: string}>} Suggested items
 */
export const getSuggestions = (history, currentItems, maxSuggestions = 8, listType) => {
  const currentNames = new Set(currentItems.map((i) => i.name.toLowerCase()));
  const suggestions = [];
  const seen = new Set();

  const addSuggestion = (name, reason) => {
    const key = name.toLowerCase();
    if (currentNames.has(key) || seen.has(key)) {
      return;
    }
    seen.add(key);
    suggestions.push({
      name,
      reason,
      category: categorizeItem(name, undefined, listType),
    });
  };

  // Pairing-based suggestions
  const pairings = getPairingSuggestions(currentItems);
  for (const name of pairings) {
    addSuggestion(name, 'Often bought together');
  }

  // Frequency-based suggestions (most purchased items not in current list)
  const freq = getItemFrequency(history);
  const sorted = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  for (const [name, count] of sorted) {
    if (count >= 2) {
      addSuggestion(name, `Purchased ${count} times before`);
    }
  }

  // Recently purchased items not in current list
  const recentItems = history
    .slice(-30)
    .reverse()
    .map((i) => i.name);
  const uniqueRecent = [...new Set(recentItems)];

  for (const name of uniqueRecent) {
    addSuggestion(name, 'Recently purchased');
  }

  return suggestions.slice(0, maxSuggestions);
};
