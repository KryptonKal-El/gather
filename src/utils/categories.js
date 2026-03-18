/**
 * Category definitions and auto-categorization for grocery items.
 * Categories are now per-store: each store has its own categories array.
 * Items without a store use DEFAULT_CATEGORIES.
 */

import { PACKING_CATEGORIES, TODO_CATEGORIES, PROJECT_CATEGORIES } from './listTypes.js';

export const CATEGORIES = {
  PRODUCE: 'produce',
  DAIRY: 'dairy',
  MEAT: 'meat',
  BAKERY: 'bakery',
  FROZEN: 'frozen',
  PANTRY: 'pantry',
  BEVERAGES: 'beverages',
  SNACKS: 'snacks',
  CONDIMENTS: 'condiments',
  HOUSEHOLD: 'household',
  PERSONAL_CARE: 'personal_care',
  OTHER: 'other',
};

/**
 * The 12 built-in categories as a serializable array.
 * Used as the starting set when creating a store and as the fallback
 * for items not assigned to any store.
 * @type {Array<{key: string, name: string, color: string, keywords: string[]}>}
 */
export const DEFAULT_CATEGORIES = [
  {
    key: CATEGORIES.PRODUCE,
    name: 'Produce',
    color: '#4caf50',
    keywords: [
      'apple', 'apples', 'banana', 'bananas', 'lettuce', 'tomato', 'tomatoes',
      'onion', 'onions', 'garlic', 'potato', 'potatoes', 'carrot', 'carrots',
      'broccoli', 'spinach', 'avocado', 'avocados', 'cucumber', 'peppers',
      'pepper', 'celery', 'mushroom', 'mushrooms', 'lemon', 'lemons', 'lime',
      'limes', 'orange', 'oranges', 'berries', 'strawberries', 'blueberries',
      'grapes', 'kale', 'zucchini', 'corn', 'ginger', 'cilantro', 'parsley',
      'basil', 'mint', 'jalapeño', 'jalapeno',
    ],
  },
  {
    key: CATEGORIES.DAIRY,
    name: 'Dairy & Eggs',
    color: '#2196f3',
    keywords: [
      'milk', 'cheese', 'yogurt', 'butter', 'cream', 'eggs', 'egg',
      'sour cream', 'cream cheese', 'cottage cheese', 'mozzarella',
      'parmesan', 'cheddar',
    ],
  },
  {
    key: CATEGORIES.MEAT,
    name: 'Meat & Seafood',
    color: '#e53935',
    keywords: [
      'chicken', 'beef', 'pork', 'steak', 'salmon', 'shrimp', 'turkey',
      'bacon', 'sausage', 'ground beef', 'ground turkey', 'fish', 'tuna',
      'lamb', 'ham',
    ],
  },
  {
    key: CATEGORIES.BAKERY,
    name: 'Bakery',
    color: '#ff9800',
    keywords: [
      'bread', 'bagel', 'bagels', 'tortilla', 'tortillas', 'rolls', 'buns',
      'croissant', 'muffin', 'muffins', 'pita',
    ],
  },
  {
    key: CATEGORIES.FROZEN,
    name: 'Frozen',
    color: '#00bcd4',
    keywords: [
      'ice cream', 'frozen pizza', 'frozen vegetables', 'frozen fruit',
      'frozen berries',
    ],
  },
  {
    key: CATEGORIES.PANTRY,
    name: 'Pantry & Dry Goods',
    color: '#795548',
    keywords: [
      'rice', 'pasta', 'flour', 'sugar', 'salt', 'oil', 'olive oil',
      'vegetable oil', 'coconut oil', 'beans', 'lentils', 'oats', 'cereal',
      'peanut butter', 'canned tomatoes', 'tomato paste', 'tomato sauce',
      'chicken broth', 'broth', 'noodles', 'quinoa', 'baking soda',
      'baking powder', 'vanilla', 'honey', 'vinegar', 'nuts', 'almonds',
      'walnuts',
    ],
  },
  {
    key: CATEGORIES.BEVERAGES,
    name: 'Beverages',
    color: '#9c27b0',
    keywords: ['water', 'juice', 'coffee', 'tea', 'soda', 'wine', 'beer'],
  },
  {
    key: CATEGORIES.SNACKS,
    name: 'Snacks',
    color: '#ffc107',
    keywords: [
      'chips', 'crackers', 'cookies', 'popcorn', 'granola', 'granola bars',
      'pretzels', 'chocolate',
    ],
  },
  {
    key: CATEGORIES.CONDIMENTS,
    name: 'Condiments & Sauces',
    color: '#ff5722',
    keywords: [
      'ketchup', 'mustard', 'mayo', 'mayonnaise', 'soy sauce', 'hot sauce',
      'salsa', 'salad dressing', 'bbq sauce', 'sriracha',
    ],
  },
  {
    key: CATEGORIES.HOUSEHOLD,
    name: 'Household',
    color: '#607d8b',
    keywords: [
      'paper towels', 'toilet paper', 'trash bags', 'dish soap',
      'laundry detergent', 'sponge', 'aluminum foil', 'plastic wrap',
    ],
  },
  {
    key: CATEGORIES.PERSONAL_CARE,
    name: 'Personal Care',
    color: '#e91e63',
    keywords: [
      'shampoo', 'conditioner', 'soap', 'toothpaste', 'deodorant', 'lotion',
    ],
  },
  {
    key: CATEGORIES.OTHER,
    name: 'Other',
    color: '#9e9e9e',
    keywords: [],
  },
];

/**
 * Categorizes an item name by matching against keywords in a categories array.
 * @param {string} itemName - The name of the grocery item
 * @param {Array<{key: string, keywords: string[]}>} [categories] - Categories to match against (defaults to DEFAULT_CATEGORIES)
 * @param {string} [listType] - The list type ('grocery', 'packing', 'basic', 'guest_list', 'project', 'todo')
 * @returns {string|null} The matched category key, 'other'/'miscellaneous' if no match, or null for types without auto-categorization
 */
export const categorizeItem = (itemName, categories = DEFAULT_CATEGORIES, listType) => {
  if (listType === 'basic' || listType === 'guest_list' || listType === 'todo') {
    return null;
  }

  const normalized = itemName.toLowerCase().trim();

  // Exact match against all category keywords
  for (const cat of categories) {
    for (const keyword of cat.keywords) {
      const kw = keyword.toLowerCase();
      if (normalized === kw) return cat.key;
    }
  }

  // Multi-word phrase match
  for (const cat of categories) {
    for (const keyword of cat.keywords) {
      const kw = keyword.toLowerCase();
      if (kw.includes(' ') && normalized.includes(kw)) return cat.key;
    }
  }

  // Single-word fallback
  const words = normalized.split(/\s+/);
  for (const word of words) {
    for (const cat of categories) {
      for (const keyword of cat.keywords) {
        if (word === keyword.toLowerCase()) return cat.key;
      }
    }
  }

  // Default fallback — use packing's fallback category for packing lists
  if (listType === 'packing') return 'miscellaneous';
  return CATEGORIES.OTHER;
};

/**
 * Builds a label map from a categories array.
 * @param {Array<{key: string, name: string}>} [categories] - Defaults to DEFAULT_CATEGORIES
 * @returns {Object} Map of category key -> display name
 */
export const getAllCategoryLabels = (categories = DEFAULT_CATEGORIES) => {
  const labels = {};
  for (const cat of categories) {
    labels[cat.key] = cat.name;
  }
  return labels;
};

/**
 * Builds a color map from a categories array.
 * @param {Array<{key: string, color: string}>} [categories] - Defaults to DEFAULT_CATEGORIES
 * @returns {Object} Map of category key -> hex color
 */
export const getAllCategoryColors = (categories = DEFAULT_CATEGORIES) => {
  const colors = {};
  for (const cat of categories) {
    colors[cat.key] = cat.color;
  }
  return colors;
};

/**
 * Returns ordered category keys from a categories array.
 * @param {Array<{key: string}>} [categories] - Defaults to DEFAULT_CATEGORIES
 * @returns {string[]} Category keys in array order
 */
export const getAllCategoryKeys = (categories = DEFAULT_CATEGORIES) =>
  categories.map((cat) => cat.key);

/**
 * Returns the system default categories for a given list type.
 * @param {string} listType - The list type identifier
 * @returns {Array|null} Category array or null if type doesn't have categories
 */
export const getSystemDefaultCategories = (listType) => {
  switch (listType) {
    case 'grocery': return DEFAULT_CATEGORIES;
    case 'packing': return PACKING_CATEGORIES;
    case 'todo': return TODO_CATEGORIES;
    case 'project': return PROJECT_CATEGORIES;
    default: return null;
  }
};

/**
 * Returns the effective categories for a list using the resolution chain:
 * list.categories -> user_category_defaults for list type -> system defaults.
 * @param {Object} list - List object with type and optional categories
 * @param {Array} [userCategoryDefaults=[]] - User's category defaults by list type
 * @returns {Array|null} Categories array or null if type doesn't use categories
 */
export const getEffectiveCategories = (list, userCategoryDefaults = []) => {
  if (!list?.type || list.type === 'basic' || list.type === 'guest_list') return null;
  if (list.categories?.length > 0) return list.categories;
  const userDefault = userCategoryDefaults.find(d => d.listType === list.type);
  if (userDefault?.categories?.length > 0) return userDefault.categories;
  return getSystemDefaultCategories(list.type);
};
