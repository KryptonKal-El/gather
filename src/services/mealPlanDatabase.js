/**
 * Supabase database service layer for household meal plans.
 * A plan is owned by one user and shared by email (meal_plan_shares); every
 * member reads and writes the same meal_plan_entries (one row per date + meal).
 */
import { supabase } from './supabase.js';

const mapPlan = (row) => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name,
  enabledMeals: row.enabled_meals ?? ['breakfast', 'lunch', 'dinner'],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapEntry = (row) => ({
  id: row.id,
  mealPlanId: row.meal_plan_id,
  date: row.date,
  meal: row.meal,
  kind: row.kind,
  recipeId: row.recipe_id,
  title: row.title,
  note: row.note,
  isLocked: row.is_locked,
  source: row.source,
  cookedAt: row.cooked_at,
  suggestionReason: row.suggestion_reason,
  createdBy: row.created_by,
  updatedAt: row.updated_at,
});

const mapRecipe = (row) => ({
  id: row.id,
  name: row.name,
  imageUrl: row.image_url,
  ownerId: row.owner_id,
  collectionId: row.collection_id,
  cookCount: row.cook_count,
  lastCookedAt: row.last_cooked_at,
});

const fail = (action, error) => {
  throw new Error(`Failed to ${action}: ${error.message}`, { cause: error });
};

/**
 * Fetches every plan the user can see (owned and shared), oldest first.
 * @returns {Promise<Array<object>>}
 */
export const fetchMealPlans = async () => {
  const { data, error } = await supabase
    .from('meal_plans')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) fail('load meal plans', error);
  return data.map(mapPlan);
};

/**
 * Creates a plan owned by the user.
 * @param {string} userId
 * @returns {Promise<object>}
 */
export const createMealPlan = async (userId) => {
  const { data, error } = await supabase
    .from('meal_plans')
    .insert({ owner_id: userId })
    .select()
    .single();
  if (error) fail('create meal plan', error);
  return mapPlan(data);
};

/**
 * Replaces which meals the plan shows.
 * @param {string} planId
 * @param {string[]} meals
 */
export const updateEnabledMeals = async (planId, meals) => {
  const { error } = await supabase
    .from('meal_plans')
    .update({ enabled_meals: meals, updated_at: new Date().toISOString() })
    .eq('id', planId);
  if (error) fail('update meals shown', error);
};

/**
 * Fetches a plan's slots between two date keys, inclusive.
 * @param {string} planId
 * @param {string} fromKey - `YYYY-MM-DD`
 * @param {string} toKey - `YYYY-MM-DD`
 * @returns {Promise<Array<object>>}
 */
export const fetchMealPlanEntries = async (planId, fromKey, toKey) => {
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .select('*')
    .eq('meal_plan_id', planId)
    .gte('date', fromKey)
    .lte('date', toKey);
  if (error) fail('load the week', error);
  return data.map(mapEntry);
};

/**
 * Creates or replaces the slot for (plan, date, meal) as set by a person: it becomes a
 * manual entry and loses any suggestion reason.
 * @param {object} slot
 * @param {string} slot.planId
 * @param {string} slot.date - `YYYY-MM-DD`
 * @param {string} slot.meal
 * @param {string} slot.kind
 * @param {string|null} slot.recipeId
 * @param {string|null} slot.title
 * @param {string|null} slot.note
 * @param {string|null} slot.cookedAt - Kept only when the recipe is unchanged
 * @param {string} slot.userId
 * @returns {Promise<object>}
 */
export const upsertMealPlanEntry = async ({ planId, date, meal, kind, recipeId, title, note, cookedAt, userId }) => {
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .upsert(
      {
        meal_plan_id: planId,
        date,
        meal,
        kind,
        recipe_id: recipeId,
        title,
        note,
        cooked_at: cookedAt,
        source: 'manual',
        suggestion_reason: null,
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'meal_plan_id,date,meal' },
    )
    .select()
    .single();
  if (error) fail('save that meal', error);
  return mapEntry(data);
};

/**
 * Saves planner suggestions in one request. Each replaces whatever was in its slot.
 * @param {string} planId
 * @param {Array<{date: string, meal: string, recipeId: string, title: string, reason: string}>} suggestions
 * @param {string} userId
 * @returns {Promise<Array<object>>}
 */
export const saveSuggestedEntries = async (planId, suggestions, userId) => {
  if (suggestions.length === 0) return [];
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .upsert(
      suggestions.map((s) => ({
        meal_plan_id: planId,
        date: s.date,
        meal: s.meal,
        kind: 'recipe',
        recipe_id: s.recipeId,
        title: s.title,
        note: null,
        cooked_at: null,
        is_locked: false,
        source: 'suggested',
        suggestion_reason: s.reason,
        created_by: userId,
        updated_at: now,
      })),
      { onConflict: 'meal_plan_id,date,meal' },
    )
    .select();
  if (error) fail('save suggestions', error);
  return data.map(mapEntry);
};

/**
 * Removes several slots at once (used by Regenerate).
 * @param {string[]} entryIds
 */
export const deleteMealPlanEntries = async (entryIds) => {
  if (entryIds.length === 0) return;
  const { error } = await supabase.from('meal_plan_entries').delete().in('id', entryIds);
  if (error) fail('clear suggestions', error);
};

/**
 * Locks or unlocks a slot so Regenerate leaves it alone.
 * @param {string} entryId
 * @param {boolean} isLocked
 * @returns {Promise<object>}
 */
export const setMealPlanEntryLocked = async (entryId, isLocked) => {
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
    .eq('id', entryId)
    .select()
    .single();
  if (error) fail(isLocked ? 'lock that meal' : 'unlock that meal', error);
  return mapEntry(data);
};

/**
 * Fetches recipe slots planned in a date range (the planner's recency and "planned but not
 * cooked" signals).
 * @param {string} planId
 * @param {string} fromKey
 * @param {string} toKey
 * @returns {Promise<Array<{recipeId: string, date: string, cooked: boolean}>>}
 */
export const fetchPlannedRecipeDates = async (planId, fromKey, toKey) => {
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .select('recipe_id, date, cooked_at')
    .eq('meal_plan_id', planId)
    .eq('kind', 'recipe')
    .not('recipe_id', 'is', null)
    .gte('date', fromKey)
    .lte('date', toKey);
  if (error) fail('load recent plans', error);
  return data.map((row) => ({ recipeId: row.recipe_id, date: row.date, cooked: Boolean(row.cooked_at) }));
};

/**
 * Fetches completed cook dates (local-agnostic `YYYY-MM-DD` of completed_at) since a date.
 * RLS limits rows to recipes the user can see.
 * @param {string} sinceIso
 * @returns {Promise<Array<{recipeId: string, date: string, startedAt: string, completedAt: string}>>}
 */
export const fetchCookDates = async (sinceIso) => {
  const { data, error } = await supabase
    .from('cook_sessions')
    .select('recipe_id, started_at, completed_at')
    .not('completed_at', 'is', null)
    .gte('completed_at', sinceIso);
  if (error) fail('load cook history', error);
  return data.map((row) => ({
    recipeId: row.recipe_id,
    date: row.completed_at.slice(0, 10),
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }));
};

/**
 * Fetches the household's reactions to suggestions since a date.
 * @param {string} planId
 * @param {string} sinceIso
 * @returns {Promise<Array<{recipeId: string, event: string, date: string}>>}
 */
export const fetchMealPlanFeedback = async (planId, sinceIso) => {
  const { data, error } = await supabase
    .from('meal_plan_feedback')
    .select('recipe_id, event, created_at')
    .eq('meal_plan_id', planId)
    .gte('created_at', sinceIso);
  if (error) fail('load plan history', error);
  return data.map((row) => ({ recipeId: row.recipe_id, event: row.event, date: row.created_at.slice(0, 10) }));
};

/**
 * Records reactions to suggestions (kept / swapped / regenerated). Best-effort: a failure is
 * logged, never shown, because the user's action itself already succeeded.
 * @param {string} planId
 * @param {Array<{recipeId: string, event: 'kept'|'swapped'|'regenerated'}>} events
 * @param {string} userId
 */
export const recordMealPlanFeedback = async (planId, events, userId) => {
  if (events.length === 0) return;
  const { error } = await supabase.from('meal_plan_feedback').insert(
    events.map((e) => ({ meal_plan_id: planId, recipe_id: e.recipeId, event: e.event, created_by: userId })),
  );
  if (error) console.error('[recordMealPlanFeedback] Failed to record feedback:', error);
};

/**
 * Clears a slot.
 * @param {string} entryId
 */
export const deleteMealPlanEntry = async (entryId) => {
  const { error } = await supabase.from('meal_plan_entries').delete().eq('id', entryId);
  if (error) fail('clear that meal', error);
};

/**
 * Fetches every recipe the user can see (own, shared collections, planned in their plans).
 * @returns {Promise<Array<object>>}
 */
export const fetchPlannableRecipes = async () => {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, image_url, owner_id, collection_id, cook_count, last_cooked_at')
    .order('name', { ascending: true });
  if (error) fail('load recipes', error);
  return data.map(mapRecipe);
};

/**
 * Fetches ingredients for a set of recipes.
 * @param {string[]} recipeIds
 * @returns {Promise<Array<{recipeId: string, name: string, quantity: string|null}>>}
 */
export const fetchIngredientsForRecipes = async (recipeIds) => {
  if (recipeIds.length === 0) return [];
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id, name, quantity, sort_order')
    .in('recipe_id', recipeIds)
    .order('sort_order', { ascending: true });
  if (error) fail('load ingredients', error);
  return data.map((row) => ({ recipeId: row.recipe_id, name: row.name, quantity: row.quantity }));
};

/**
 * Fetches a plan's shares, shaped for ShareCollectionModal (`{id, email}`).
 * @param {string} planId
 * @returns {Promise<Array<{id: string, email: string}>>}
 */
export const getMealPlanShares = async (planId) => {
  const { data, error } = await supabase
    .from('meal_plan_shares')
    .select('id, shared_with_email')
    .eq('meal_plan_id', planId)
    .order('added_at', { ascending: true });
  if (error) fail('load plan members', error);
  return data.map((row) => ({ id: row.id, email: row.shared_with_email }));
};

/**
 * Shares a plan with someone by email (write access).
 * @param {string} planId
 * @param {string} email
 * @param {string} userId - The sharer (must own the plan)
 */
export const shareMealPlan = async (planId, email, userId) => {
  const { error } = await supabase.from('meal_plan_shares').insert({
    meal_plan_id: planId,
    shared_with_email: email.trim().toLowerCase(),
    shared_by: userId,
    permission: 'write',
  });
  if (error) {
    if (error.code === '23505') throw new Error('This person already has access', { cause: error });
    fail('share the plan', error);
  }
};

/**
 * Removes a share. Owners remove members; members remove themselves to leave.
 * @param {string} planId
 * @param {string} email
 */
export const unshareMealPlan = async (planId, email) => {
  const { error } = await supabase
    .from('meal_plan_shares')
    .delete()
    .eq('meal_plan_id', planId)
    .eq('shared_with_email', email.trim().toLowerCase());
  if (error) fail('remove that person', error);
};

/**
 * Fetches the other members of a plan (owner + recipients, excluding the caller).
 * @param {string} planId
 * Rows keep the RPC's snake_case keys, which is the shape AvatarGroup expects.
 * @returns {Promise<Array<{user_id: string, display_name: string, avatar_url: string|null}>>}
 */
export const getMealPlanCollaborators = async (planId) => {
  const { data, error } = await supabase.rpc('get_meal_plan_collaborators', { p_meal_plan_id: planId });
  if (error) fail('load plan members', error);
  return data ?? [];
};

/**
 * Subscribes to any change on plans, shares, or slots. No row filters: filters on
 * non-PK columns drop UPDATE/DELETE events (docs/memory/supabase-realtime-replica-identity.md),
 * and RLS already limits delivery to the user's plans.
 * @param {string} userId
 * @param {{onEntries: Function, onPlans: Function}} handlers
 * @returns {Function} Unsubscribe
 */
export const subscribeMealPlans = (userId, { onEntries, onPlans }) => {
  const channel = supabase
    .channel(`meal-plans-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_plan_entries' }, () => onEntries())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_plans' }, () => onPlans())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_plan_shares' }, () => onPlans())
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[subscribeMealPlans] Realtime subscription error:', err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};
