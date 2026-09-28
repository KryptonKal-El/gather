/**
 * Matches a cooking step's instruction text to the recipe ingredients it
 * mentions, so cook mode can show those ingredients' amounts under the step.
 * Mirrors `[RecipeIngredient].mentioned(in:)` on iOS — keep the two in sync.
 */

// Preparation and size words that describe an ingredient without naming it,
// so "large eggs, beaten" still matches a step that says "eggs".
const DESCRIPTOR_WORDS = new Set([
  'to', 'taste', 'optional', 'divided', 'plus', 'more', 'extra', 'for', 'serving',
  'large', 'medium', 'small', 'whole', 'fresh', 'freshly', 'chopped', 'minced',
  'sliced', 'diced', 'grated', 'shredded', 'softened', 'melted', 'packed',
  'finely', 'roughly', 'thinly', 'beaten', 'peeled', 'cubed', 'crushed', 'room',
  'temperature', 'cold', 'warm', 'hot', 'about',
]);

const MIN_HEAD_LENGTH = 3;

/**
 * Reduces a word to a rough singular form. Both the step and the ingredient
 * go through this, so it only needs to be consistent, not grammatical.
 * @param {string} word
 * @returns {string}
 */
const singularize = (word) => {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(oes|ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('ss')) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
};

/**
 * Lowercases, strips everything but letters, and singularizes each word.
 * @param {string} text
 * @returns {string[]}
 */
const tokenize = (text) =>
  (text ?? '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(singularize);

/**
 * The name variants to look for: the part before any comma or parenthesis,
 * split on "and"/"or"/"&"/"/" so "salt and pepper" matches a step naming either.
 * @param {string} name
 * @returns {string[][]} token lists, descriptor words removed
 */
const nameVariants = (name) =>
  (name ?? '')
    .replace(/\(.*?\)/g, ' ')
    .split(',')[0]
    .split(/\s+(?:and|or)\s+|&|\//i)
    .map((part) => tokenize(part).filter((token) => !DESCRIPTOR_WORDS.has(token)))
    .filter((tokens) => tokens.length > 0);

/**
 * Returns the ingredients a step's instruction mentions, in ingredient-list order.
 * An ingredient matches when its whole name appears in the step, or when its
 * last word does (so "all-purpose flour" matches "add the flour") — unless
 * another ingredient ends in the same word, where only the full name counts
 * ("brown sugar" vs "white sugar").
 * @param {string} instruction
 * @param {Array<{ id: string, name: string, quantity?: string }>} ingredients
 * @returns {Array<{ id: string, name: string, quantity?: string }>}
 */
export const ingredientsForStep = (instruction, ingredients) => {
  const stepText = ` ${tokenize(instruction).join(' ')} `;
  const stepWords = new Set(stepText.trim().split(' '));

  const variantsById = new Map(
    (ingredients ?? []).map((ingredient) => [ingredient.id, nameVariants(ingredient.name)])
  );
  const headCounts = new Map();
  for (const variants of variantsById.values()) {
    for (const head of new Set(variants.map((tokens) => tokens[tokens.length - 1]))) {
      headCounts.set(head, (headCounts.get(head) ?? 0) + 1);
    }
  }

  return (ingredients ?? []).filter((ingredient) =>
    variantsById.get(ingredient.id).some((tokens) => {
      if (stepText.includes(` ${tokens.join(' ')} `)) return true;
      const head = tokens[tokens.length - 1];
      return head.length >= MIN_HEAD_LENGTH && headCounts.get(head) === 1 && stepWords.has(head);
    })
  );
};
