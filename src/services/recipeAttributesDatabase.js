/**
 * Supabase database service layer for `recipe_attributes` — the planner-facing
 * details of a recipe (meals, course, protein, cuisine, effort, method, kid-friendly).
 */
import { supabase } from './supabase.js';

const mapAttributes = (row) => ({
  recipeId: row.recipe_id,
  course: row.course,
  mealTypes: row.meal_types ?? [],
  protein: row.protein,
  cuisine: row.cuisine,
  effort: row.effort,
  method: row.method,
  kidFriendly: row.kid_friendly,
  perishables: row.perishables ?? [],
  manualFields: row.manual_fields ?? [],
  autoSourceHash: row.auto_source_hash,
  autoTaggedAt: row.auto_tagged_at,
});

/**
 * Fetches one recipe's attributes, or null when it has none yet.
 * @param {string} recipeId
 * @returns {Promise<object|null>}
 */
export const fetchRecipeAttributes = async (recipeId) => {
  const { data, error } = await supabase
    .from('recipe_attributes')
    .select('*')
    .eq('recipe_id', recipeId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load recipe details: ${error.message}`, { cause: error });
  return data ? mapAttributes(data) : null;
};

/**
 * Fetches attributes for every recipe the user can see, keyed by recipe id.
 * @returns {Promise<Map<string, object>>}
 */
export const fetchAllRecipeAttributes = async () => {
  const { data, error } = await supabase.from('recipe_attributes').select('*');
  if (error) throw new Error(`Failed to load recipe details: ${error.message}`, { cause: error });
  return new Map(data.map((row) => [row.recipe_id, mapAttributes(row)]));
};

/**
 * Creates or replaces a recipe's attributes.
 * @param {object} attributes - Camel-cased attributes (see mapAttributes)
 * @param {string} userId - The editor
 * @returns {Promise<object>}
 */
export const saveRecipeAttributes = async (attributes, userId) => {
  const { data, error } = await supabase
    .from('recipe_attributes')
    .upsert(
      {
        recipe_id: attributes.recipeId,
        course: attributes.course,
        meal_types: attributes.mealTypes,
        protein: attributes.protein,
        cuisine: attributes.cuisine,
        effort: attributes.effort,
        method: attributes.method,
        kid_friendly: attributes.kidFriendly,
        perishables: attributes.perishables,
        manual_fields: attributes.manualFields,
        auto_source_hash: attributes.autoSourceHash,
        auto_tagged_at: attributes.autoTaggedAt,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'recipe_id' },
    )
    .select()
    .single();
  if (error) throw new Error(`Failed to save recipe details: ${error.message}`, { cause: error });
  return mapAttributes(data);
};
