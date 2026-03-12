/**
 * List type configuration registry and category definitions.
 * Defines available list types and their field visibility, categories, and sorting options.
 */

/**
 * Category definitions for packing lists.
 * @type {Array<{key: string, name: string, color: string, keywords: string[]}>}
 */
export const PACKING_CATEGORIES = [
  {
    key: 'clothes',
    name: 'Clothes',
    color: '#5C6BC0',
    keywords: [
      'shirt', 'shirts', 'pants', 'shorts', 'jacket', 'coat', 'dress', 'socks',
      'underwear', 'sweater', 'hoodie', 'jeans', 't-shirt', 'blouse', 'skirt',
    ],
  },
  {
    key: 'toiletries',
    name: 'Toiletries',
    color: '#26A69A',
    keywords: [
      'toothbrush', 'toothpaste', 'shampoo', 'conditioner', 'soap', 'deodorant',
      'razor', 'sunscreen', 'lotion', 'floss', 'mouthwash',
    ],
  },
  {
    key: 'electronics',
    name: 'Electronics',
    color: '#42A5F5',
    keywords: [
      'charger', 'laptop', 'phone', 'tablet', 'headphones', 'earbuds', 'camera',
      'adapter', 'cable', 'power bank', 'kindle',
    ],
  },
  {
    key: 'documents',
    name: 'Documents',
    color: '#78909C',
    keywords: [
      'passport', 'tickets', 'boarding pass', 'id', 'insurance', 'itinerary',
      'visa', 'license', 'reservation',
    ],
  },
  {
    key: 'accessories',
    name: 'Accessories',
    color: '#AB47BC',
    keywords: [
      'hat', 'sunglasses', 'belt', 'watch', 'jewelry', 'wallet', 'umbrella',
      'scarf', 'gloves',
    ],
  },
  {
    key: 'medications',
    name: 'Medications',
    color: '#EF5350',
    keywords: [
      'medicine', 'pills', 'vitamins', 'inhaler', 'prescription', 'band-aids',
      'first aid', 'allergy', 'ibuprofen', 'tylenol',
    ],
  },
  {
    key: 'snacks_food',
    name: 'Snacks & Food',
    color: '#FFA726',
    keywords: [
      'snacks', 'granola bars', 'trail mix', 'nuts', 'crackers', 'water bottle',
      'gum', 'candy',
    ],
  },
  {
    key: 'entertainment',
    name: 'Entertainment',
    color: '#66BB6A',
    keywords: [
      'book', 'books', 'cards', 'games', 'puzzle', 'magazine', 'notebook',
      'journal', 'pen', 'pencil',
    ],
  },
  {
    key: 'miscellaneous',
    name: 'Miscellaneous',
    color: '#9E9E9E',
    keywords: [],
  },
];

/**
 * Category definitions for to-do lists.
 * No keywords since to-do lists don't use auto-categorization.
 * @type {Array<{key: string, name: string, color: string, keywords: string[]}>}
 */
export const TODO_CATEGORIES = [
  { key: 'work', name: 'Work', color: '#42A5F5', keywords: [] },
  { key: 'personal', name: 'Personal', color: '#66BB6A', keywords: [] },
  { key: 'errands', name: 'Errands', color: '#FFA726', keywords: [] },
  { key: 'finance', name: 'Finance', color: '#26A69A', keywords: [] },
  { key: 'health', name: 'Health', color: '#EF5350', keywords: [] },
  { key: 'home', name: 'Home', color: '#AB47BC', keywords: [] },
  { key: 'other', name: 'Other', color: '#9E9E9E', keywords: [] },
];

/**
 * List type configuration registry.
 * Each type defines which fields are visible, available categories, and sorting options.
 * @type {Object<string, {id: string, label: string, icon: string, fields: Object, quantityLabel: string|null, categories: Array|null, sortLevels: string[], defaultSort: string[]}>}
 */
export const LIST_TYPES = {
  grocery: {
    id: 'grocery',
    label: 'Grocery',
    icon: '🛒',
    fields: {
      store: true,
      category: true,
      price: true,
      quantity: true,
      unit: true,
      image: true,
      rsvpStatus: false,
    },
    quantityLabel: 'Qty',
    categories: null,
    sortLevels: ['store', 'category', 'name', 'date'],
    defaultSort: ['store', 'category', 'name'],
  },
  basic: {
    id: 'basic',
    label: 'Basic',
    icon: '📋',
    fields: {
      store: false,
      category: false,
      price: false,
      quantity: false,
      unit: false,
      image: false,
      rsvpStatus: false,
    },
    quantityLabel: null,
    categories: null,
    sortLevels: ['name', 'date'],
    defaultSort: ['name'],
  },
  guest_list: {
    id: 'guest_list',
    label: 'Guest List',
    icon: '🎉',
    fields: {
      store: false,
      category: false,
      price: false,
      quantity: true,
      unit: false,
      image: false,
      rsvpStatus: true,
    },
    quantityLabel: 'Head Count',
    categories: null,
    sortLevels: ['name', 'date'],
    defaultSort: ['name'],
  },
  packing: {
    id: 'packing',
    label: 'Packing',
    icon: '🧳',
    fields: {
      store: false,
      category: true,
      price: false,
      quantity: true,
      unit: false,
      image: false,
      rsvpStatus: false,
    },
    quantityLabel: 'Qty',
    categories: PACKING_CATEGORIES,
    sortLevels: ['category', 'name', 'date'],
    defaultSort: ['category', 'name'],
  },
  project: {
    id: 'project',
    label: 'Project',
    icon: '🏗️',
    fields: {
      store: false,
      category: false,
      price: true,
      quantity: true,
      unit: false,
      image: false,
      rsvpStatus: false,
    },
    quantityLabel: 'Qty',
    categories: null,
    sortLevels: ['name', 'date', 'price'],
    defaultSort: ['name'],
  },
  todo: {
    id: 'todo',
    label: 'To-Do',
    icon: '📝',
    fields: {
      store: false,
      category: true,
      price: false,
      quantity: false,
      unit: false,
      image: false,
      rsvpStatus: false,
    },
    quantityLabel: null,
    categories: TODO_CATEGORIES,
    sortLevels: ['category', 'name', 'date'],
    defaultSort: ['category', 'name'],
  },
};

/**
 * All list type IDs in display order.
 * @type {string[]}
 */
export const LIST_TYPE_IDS = [
  'grocery',
  'basic',
  'guest_list',
  'packing',
  'project',
  'todo',
];

/**
 * Returns the configuration for a given list type ID.
 * Defaults to grocery if the type is unknown.
 * @param {string} typeId - The list type identifier
 * @returns {{id: string, label: string, icon: string, fields: Object, quantityLabel: string|null, categories: Array|null, sortLevels: string[], defaultSort: string[]}}
 */
export const getTypeConfig = (typeId) => {
  return LIST_TYPES[typeId] ?? LIST_TYPES.grocery;
};
