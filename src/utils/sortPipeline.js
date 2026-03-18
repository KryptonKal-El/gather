/**
 * Sort pipeline engine for shopping list items.
 * Provides flexible, composable sorting and grouping of items
 * based on a configurable sort pipeline.
 */

import {
  DEFAULT_CATEGORIES,
  getAllCategoryLabels,
  getAllCategoryColors,
  getAllCategoryKeys,
} from './categories.js';
import { getTypeConfig, PACKING_CATEGORIES, TODO_CATEGORIES } from './listTypes.js';

/** Valid sort level options */
export const SORT_LEVELS = ['store', 'category', 'name', 'date', 'price', 'rsvp'];

/** System default sort configuration */
export const SYSTEM_DEFAULT_SORT_CONFIG = ['store', 'category', 'name'];

/**
 * Returns the default sort config for a given list type.
 * @param {string} [listType='grocery'] - The list type identifier
 * @returns {string[]} Default sort config for the type
 */
export const getDefaultSortConfig = (listType) => {
  const config = getTypeConfig(listType ?? 'grocery');
  return config.defaultSort;
};

/** Levels that create groups (vs just sorting within existing groups) */
const GROUPING_LEVELS = ['store', 'category', 'rsvp'];

/**
 * Validates a sort configuration.
 * @param {unknown} config - The configuration to validate
 * @returns {boolean} True if config is a valid sort configuration
 */
export const isValidSortConfig = (config) => {
  if (!Array.isArray(config) || config.length === 0 || config.length > 3) {
    return false;
  }
  const seen = new Set();
  for (const level of config) {
    if (typeof level !== 'string' || !SORT_LEVELS.includes(level)) {
      return false;
    }
    if (seen.has(level)) {
      return false;
    }
    seen.add(level);
  }
  return true;
};

/**
 * Normalizes any input into a valid sort configuration.
 * Filters invalid values, removes duplicates, truncates to 3,
 * and falls back to system default if empty.
 * @param {unknown} config - The configuration to normalize
 * @returns {string[]} A valid sort configuration array
 */
export const normalizeSortConfig = (config) => {
  if (!Array.isArray(config)) {
    return [...SYSTEM_DEFAULT_SORT_CONFIG];
  }

  const seen = new Set();
  const normalized = [];

  for (const level of config) {
    if (
      typeof level === 'string' &&
      SORT_LEVELS.includes(level) &&
      !seen.has(level)
    ) {
      seen.add(level);
      normalized.push(level);
      if (normalized.length === 3) break;
    }
  }

  return normalized.length > 0 ? normalized : [...SYSTEM_DEFAULT_SORT_CONFIG];
};

/**
 * Sorts items alphabetically by name (case-insensitive).
 * @param {Array<{name: string}>} items - Items to sort
 * @returns {Array} Sorted items (new array)
 */
const sortByName = (items) =>
  [...items].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );

/**
 * Sorts items by added_at date (newest first).
 * @param {Array<{added_at: string}>} items - Items to sort
 * @returns {Array} Sorted items (new array)
 */
const sortByDate = (items) =>
  [...items].sort((a, b) => {
    const dateA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
    const dateB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
    return dateB - dateA;
  });

const sortByPrice = (items) =>
  [...items].sort((a, b) => {
    const priceA = a.price ?? null;
    const priceB = b.price ?? null;
    if (priceA === null && priceB === null) return 0;
    if (priceA === null) return 1;
    if (priceB === null) return -1;
    return priceA - priceB;
  });

/**
 * Applies a sort-only level to items.
 * @param {Array} items - Items to sort
 * @param {string} level - Sort level ('name', 'date', or 'price')
 * @returns {Array} Sorted items
 */
const applySortLevel = (items, level) => {
  if (level === 'name') return sortByName(items);
  if (level === 'date') return sortByDate(items);
  if (level === 'price') return sortByPrice(items);
  return items;
};

/**
 * Applies remaining sort levels to items within a group.
 * @param {Array} items - Items to sort
 * @param {string[]} remainingLevels - Remaining sort levels
 * @param {Array} stores - Store objects
 * @param {string|null} parentStoreId - Store ID if under a store group
 * @param {string} listType - List type identifier
 * @returns {Object} Result with items or groups
 */
const applyRemainingLevels = (items, remainingLevels, stores, parentStoreId, listType) => {
  if (remainingLevels.length === 0) {
    return { items };
  }

  const [currentLevel, ...nextLevels] = remainingLevels;

  if (!GROUPING_LEVELS.includes(currentLevel)) {
    let sorted = items;
    for (const level of remainingLevels) {
      sorted = applySortLevel(sorted, level);
    }
    return { items: sorted };
  }

  if (currentLevel === 'store') {
    return groupByStore(items, stores, nextLevels, listType);
  }

  if (currentLevel === 'category') {
    return groupByCategory(items, stores, nextLevels, parentStoreId, listType);
  }

  if (currentLevel === 'rsvp') {
    return groupByRsvp(items, stores, nextLevels, listType);
  }

  return { items };
};

/**
 * Groups items by store.
 * @param {Array} items - Items to group
 * @param {Array} stores - Store objects
 * @param {string[]} remainingLevels - Remaining sort levels after store
 * @param {string} listType - List type identifier
 * @returns {Object} Result with groups and ungrouped
 */
const groupByStore = (items, stores, remainingLevels, listType) => {
  const storeMap = new Map();
  for (const store of stores) {
    storeMap.set(store.id, store);
  }

  const grouped = new Map();
  const ungrouped = [];

  for (const item of items) {
    if (item.store && storeMap.has(item.store)) {
      if (!grouped.has(item.store)) {
        grouped.set(item.store, []);
      }
      grouped.get(item.store).push(item);
    } else {
      ungrouped.push(item);
    }
  }

  const sortedStores = [...stores].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  const groups = [];
  for (const store of sortedStores) {
    const storeItems = grouped.get(store.id);
    if (!storeItems || storeItems.length === 0) continue;

    const subResult = applyRemainingLevels(
      storeItems,
      remainingLevels,
      stores,
      store.id,
      listType
    );

    const group = {
      key: `store-${store.id}`,
      label: store.name,
      color: store.color,
      type: 'store',
    };

    if (subResult.groups) {
      group.subGroups = subResult.groups;
      if (subResult.ungrouped?.length > 0) {
        group.subGroups.push({
          key: `store-${store.id}-other`,
          label: 'Other',
          color: '#9e9e9e',
          type: 'category',
          items: subResult.ungrouped,
        });
      }
    } else {
      group.items = subResult.items;
    }

    groups.push(group);
  }

  let processedUngrouped = ungrouped;
  if (ungrouped.length > 0 && remainingLevels.length > 0) {
    const subResult = applyRemainingLevels(
      ungrouped,
      remainingLevels,
      stores,
      null,
      listType
    );
    processedUngrouped = subResult.items ?? ungrouped;
  }

  return { groups, ungrouped: processedUngrouped };
};

/**
 * Gets category info for grouping.
 * @param {Array} stores - Store objects
 * @param {string|null} parentStoreId - Parent store ID or null
 * @param {string} listType - List type identifier
 * @returns {Object} Category labels, colors, and ordered keys
 */
const getCategoryInfo = (stores, parentStoreId, listType) => {
  if (listType === 'packing') {
    return {
      labels: Object.fromEntries(PACKING_CATEGORIES.map((c) => [c.key, c.name])),
      colors: Object.fromEntries(PACKING_CATEGORIES.map((c) => [c.key, c.color])),
      orderedKeys: PACKING_CATEGORIES.map((c) => c.key),
    };
  }
  if (listType === 'todo') {
    return {
      labels: Object.fromEntries(TODO_CATEGORIES.map((c) => [c.key, c.name])),
      colors: Object.fromEntries(TODO_CATEGORIES.map((c) => [c.key, c.color])),
      orderedKeys: TODO_CATEGORIES.map((c) => c.key),
    };
  }

  let categories = DEFAULT_CATEGORIES;

  if (parentStoreId) {
    const store = stores.find((s) => s.id === parentStoreId);
    if (store?.categories?.length > 0) {
      categories = store.categories;
    }
  }

  return {
    labels: getAllCategoryLabels(categories),
    colors: getAllCategoryColors(categories),
    orderedKeys: getAllCategoryKeys(categories),
  };
};

/**
 * Groups items by category.
 * @param {Array} items - Items to group
 * @param {Array} stores - Store objects
 * @param {string[]} remainingLevels - Remaining sort levels after category
 * @param {string|null} parentStoreId - Store ID if under a store group
 * @param {string} listType - List type identifier
 * @returns {Object} Result with groups and ungrouped (items with no/unknown category)
 */
const groupByCategory = (items, stores, remainingLevels, parentStoreId, listType) => {
  const { labels, colors, orderedKeys } = getCategoryInfo(stores, parentStoreId, listType);
  const validCategories = new Set(orderedKeys);

  const grouped = new Map();
  const other = [];

  for (const item of items) {
    if (item.category && validCategories.has(item.category)) {
      if (!grouped.has(item.category)) {
        grouped.set(item.category, []);
      }
      grouped.get(item.category).push(item);
    } else {
      other.push(item);
    }
  }

  const groups = [];
  for (const categoryKey of orderedKeys) {
    const categoryItems = grouped.get(categoryKey);
    if (!categoryItems || categoryItems.length === 0) continue;

    const subResult = applyRemainingLevels(
      categoryItems,
      remainingLevels,
      stores,
      parentStoreId,
      listType
    );

    const group = {
      key: `category-${categoryKey}`,
      label: labels[categoryKey] || categoryKey,
      color: colors[categoryKey] || '#9e9e9e',
      type: 'category',
    };

    if (subResult.groups) {
      group.subGroups = subResult.groups;
    } else {
      group.items = subResult.items;
    }

    groups.push(group);
  }

  let processedOther = other;
  if (other.length > 0 && remainingLevels.length > 0) {
    const subResult = applyRemainingLevels(
      other,
      remainingLevels,
      stores,
      parentStoreId,
      listType
    );
    processedOther = subResult.items ?? other;
  }

  if (processedOther.length > 0) {
    groups.push({
      key: 'category-other',
      label: 'Other',
      color: '#9e9e9e',
      type: 'category',
      items: processedOther,
    });
  }

  return { groups, ungrouped: [] };
};

/** RSVP status order and display configuration */
const RSVP_ORDER = [
  { status: 'confirmed', label: 'Confirmed', color: '#4caf50' },
  { status: 'maybe', label: 'Maybe', color: '#ff9800' },
  { status: 'invited', label: 'Invited', color: '#42a5f5' },
  { status: 'declined', label: 'Declined', color: '#f44336' },
  { status: 'not_invited', label: 'Not Yet Invited', color: '#9e9e9e' },
];

/**
 * Groups items by RSVP status.
 * @param {Array} items - Items to group
 * @param {Array} stores - Store objects
 * @param {string[]} remainingLevels - Remaining sort levels after rsvp
 * @param {string} listType - List type identifier
 * @returns {Object} Result with groups
 */
const groupByRsvp = (items, stores, remainingLevels, listType) => {
  const grouped = new Map();

  for (const item of items) {
    const status = item.rsvpStatus ?? 'invited';
    if (!grouped.has(status)) {
      grouped.set(status, []);
    }
    grouped.get(status).push(item);
  }

  const groups = [];
  for (const rsvp of RSVP_ORDER) {
    const rsvpItems = grouped.get(rsvp.status);
    if (!rsvpItems || rsvpItems.length === 0) continue;

    const subResult = applyRemainingLevels(
      rsvpItems,
      remainingLevels,
      stores,
      null,
      listType
    );

    const group = {
      key: `rsvp-${rsvp.status}`,
      label: rsvp.label,
      color: rsvp.color,
      type: 'rsvp',
    };

    if (subResult.groups) {
      group.subGroups = subResult.groups;
    } else {
      group.items = subResult.items;
    }

    groups.push(group);
  }

  return { groups, ungrouped: [] };
};

/**
 * Applies a sort pipeline to items, returning a nested group structure.
 *
 * @param {Array} items - Array of item objects with at least: { id, name, category, store, added_at, isChecked }
 * @param {Array} sortConfig - Array of 1-3 sort level strings (e.g. ['store', 'category', 'name'])
 * @param {Array} stores - Array of store objects with: { id, name, color, categories, sort_order }
 * @param {string} listType - List type identifier (e.g. 'grocery', 'packing', 'todo')
 * @returns {Object} Nested structure with groups, subGroups, and items
 *
 * @example
 * // With grouping levels:
 * {
 *   groups: [
 *     { key: 'store-123', label: 'Walmart', type: 'store', subGroups: [...] }
 *   ],
 *   ungrouped: [...]
 * }
 *
 * @example
 * // With only sort levels:
 * {
 *   groups: [],
 *   items: [...]
 * }
 */
export const applySortPipeline = (items, sortConfig, stores = [], listType = 'grocery') => {
  const config = normalizeSortConfig(sortConfig);
  const safeStores = Array.isArray(stores) ? stores : [];

  if (!items || items.length === 0) {
    return { groups: [], items: [], ungrouped: [] };
  }

  const hasGroupingLevel = config.some((level) =>
    GROUPING_LEVELS.includes(level)
  );

  if (!hasGroupingLevel) {
    let sorted = [...items];
    for (const level of config) {
      sorted = applySortLevel(sorted, level);
    }
    return { groups: [], items: sorted };
  }

  const result = applyRemainingLevels(items, config, safeStores, null, listType);

  return {
    groups: result.groups ?? [],
    ungrouped: result.ungrouped ?? [],
  };
};
