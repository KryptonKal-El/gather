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
 * Category definitions for project lists.
 * @type {Array<{key: string, name: string, color: string, keywords: string[]}>}
 */
export const PROJECT_CATEGORIES = [
  {
    key: 'research',
    name: 'Research',
    color: '#5C6BC0',
    keywords: [
      'research', 'investigate', 'analyze', 'analysis', 'discovery', 'explore',
      'study', 'review', 'audit', 'evaluate', 'assess',
    ],
  },
  {
    key: 'design',
    name: 'Design',
    color: '#AB47BC',
    keywords: [
      'design', 'mockup', 'wireframe', 'prototype', 'ux', 'ui', 'layout',
      'sketch', 'figma', 'visual',
    ],
  },
  {
    key: 'development',
    name: 'Development',
    color: '#26A69A',
    keywords: [
      'develop', 'code', 'implement', 'build', 'feature', 'refactor', 'api',
      'backend', 'frontend', 'deploy', 'fix', 'bug',
    ],
  },
  {
    key: 'testing',
    name: 'Testing',
    color: '#FFA726',
    keywords: [
      'test', 'qa', 'verify', 'validate', 'check', 'regression', 'integration',
      'e2e', 'unit test', 'coverage',
    ],
  },
  {
    key: 'admin',
    name: 'Admin',
    color: '#78909C',
    keywords: [
      'meeting', 'document', 'docs', 'plan', 'coordinate', 'schedule', 'budget',
      'report', 'email', 'organize', 'presentation',
    ],
  },
  {
    key: 'other',
    name: 'Other',
    color: '#9e9e9e',
    keywords: [],
  },
];

/**
 * Category definitions for wish lists.
 * @type {Array<{key: string, name: string, color: string, keywords: string[]}>}
 */
export const WISH_LIST_CATEGORIES = [
  {
    key: 'clothing',
    name: 'Clothing',
    color: '#5C6BC0',
    keywords: [
      'shirt', 'sweater', 'hoodie', 'jacket', 'coat', 'dress', 'jeans', 'shoes',
      'sneakers', 'boots', 'scarf', 'hat', 'pajamas', 'socks',
    ],
  },
  {
    key: 'tech',
    name: 'Tech',
    color: '#42A5F5',
    keywords: [
      'headphones', 'earbuds', 'airpods', 'speaker', 'phone', 'tablet', 'ipad',
      'laptop', 'watch', 'smartwatch', 'camera', 'console', 'kindle', 'charger',
      'keyboard', 'mouse', 'monitor',
    ],
  },
  {
    key: 'home',
    name: 'Home',
    color: '#AB47BC',
    keywords: [
      'candle', 'blanket', 'pillow', 'mug', 'vase', 'lamp', 'plant', 'rug',
      'cookware', 'knife', 'pan', 'frame', 'towels', 'sheets',
    ],
  },
  {
    key: 'books_media',
    name: 'Books & Media',
    color: '#78909C',
    keywords: [
      'book', 'books', 'novel', 'vinyl', 'record', 'album', 'movie', 'film',
      'game', 'video game', 'comic', 'magazine', 'subscription',
    ],
  },
  {
    key: 'experiences',
    name: 'Experiences',
    color: '#FFA726',
    keywords: [
      'tickets', 'concert', 'trip', 'class', 'lesson', 'massage', 'spa',
      'dinner', 'show', 'gift card', 'membership', 'workshop',
    ],
  },
  {
    key: 'hobbies',
    name: 'Hobbies',
    color: '#66BB6A',
    keywords: [
      'lego', 'puzzle', 'paint', 'yarn', 'guitar', 'bike', 'tent', 'skateboard',
      'golf', 'yoga mat', 'board game', 'art supplies', 'drone',
    ],
  },
  {
    key: 'other',
    name: 'Other',
    color: '#9E9E9E',
    keywords: [],
  },
];

/**
 * Wish list priority levels, highest first.
 * @type {Array<{key: string, label: string, color: string}>}
 */
export const WISH_PRIORITIES = [
  { key: 'must', label: 'Must-have', color: '#E57373' },
  { key: 'want', label: 'Would like', color: '#FFB74D' },
  { key: 'nice', label: 'Nice to have', color: '#81C784' },
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
    icon: 'grocery',
    fields: {
      store: true,
      category: true,
      price: true,
      quantity: true,
      unit: true,
      image: true,
      rsvpStatus: false,
      dueDate: false,
      recurrence: false,
      reminder: false,
      url: false,
      priority: false,
    },
    quantityLabel: 'Qty',
    categories: null,
    sortLevels: ['store', 'category', 'name', 'date'],
    defaultSort: ['store', 'category', 'name'],
  },
  basic: {
    id: 'basic',
    label: 'Basic',
    icon: 'basic',
    fields: {
      store: false,
      category: false,
      price: false,
      quantity: false,
      unit: false,
      image: false,
      rsvpStatus: false,
      dueDate: true,
      recurrence: true,
      reminder: true,
      url: false,
      priority: false,
    },
    quantityLabel: null,
    categories: null,
    sortLevels: ['name', 'date', 'dueDate'],
    defaultSort: ['name'],
  },
  guest_list: {
    id: 'guest_list',
    label: 'Guest List',
    icon: 'guest_list',
    fields: {
      store: false,
      category: false,
      price: false,
      quantity: true,
      unit: false,
      image: false,
      rsvpStatus: true,
      dueDate: false,
      recurrence: false,
      reminder: false,
      url: false,
      priority: false,
    },
    quantityLabel: 'Head Count',
    categories: null,
    sortLevels: ['rsvp', 'name', 'date'],
    defaultSort: ['rsvp', 'name'],
  },
   packing: {
     id: 'packing',
     label: 'Packing',
     icon: 'packing',
     fields: {
       store: true,
       category: true,
       price: false,
       quantity: true,
       unit: false,
       image: false,
       rsvpStatus: false,
       dueDate: false,
       recurrence: false,
       reminder: false,
       url: false,
       priority: false,
     },
     quantityLabel: 'Qty',
     categories: PACKING_CATEGORIES,
     sortLevels: ['store', 'category', 'name', 'date'],
     defaultSort: ['store', 'category', 'name'],
   },
   project: {
     id: 'project',
     label: 'Project',
     icon: 'project',
     fields: {
       store: true,
       category: true,
       price: true,
       quantity: true,
       unit: false,
       image: false,
       rsvpStatus: false,
       dueDate: true,
       recurrence: true,
       reminder: true,
       url: false,
       priority: false,
     },
     quantityLabel: 'Qty',
     categories: PROJECT_CATEGORIES,
     sortLevels: ['store', 'category', 'name', 'date', 'price', 'dueDate'],
     defaultSort: ['store', 'category', 'name'],
   },
  todo: {
    id: 'todo',
    label: 'To-Do',
    icon: 'todo',
    fields: {
      store: false,
      category: true,
      price: false,
      quantity: false,
      unit: false,
      image: false,
      rsvpStatus: false,
      dueDate: true,
      recurrence: true,
      reminder: true,
      url: false,
      priority: false,
    },
    quantityLabel: null,
    categories: TODO_CATEGORIES,
    sortLevels: ['category', 'name', 'date', 'dueDate'],
    defaultSort: ['category', 'name'],
  },
  wish_list: {
    id: 'wish_list',
    label: 'Wish List',
    icon: 'wish_list',
    fields: {
      store: true,
      category: true,
      price: true,
      quantity: true,
      unit: false,
      image: true,
      rsvpStatus: false,
      dueDate: false,
      recurrence: false,
      reminder: false,
      url: true,
      priority: true,
    },
    quantityLabel: 'Qty',
    categories: WISH_LIST_CATEGORIES,
    sortLevels: ['priority', 'category', 'store', 'name', 'date', 'price'],
    defaultSort: ['priority', 'name'],
  },
};

/**
 * All list type IDs in display order.
 * @type {string[]}
 */
export const LIST_TYPE_IDS = [
  'grocery',
  'todo',
  'basic',
  'packing',
  'guest_list',
  'project',
  'wish_list',
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
