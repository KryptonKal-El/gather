/**
 * Phase 1 read-only tools.
 */
import { McpServer } from 'npm:@modelcontextprotocol/server@^2.0.0';
import { z } from 'npm:zod@^4.3.6';
import { resolveEffectiveCategories } from './categories.ts';
import {
  DEFAULT_PAGE,
  READ_ONLY,
  type ToolContext,
  errorResult,
  jsonResult,
  paginationShape,
} from './shared.ts';

/**
 * Registers the Phase 1 read-only tools on a per-request MCP server.
 */
export function registerReadTools(server: McpServer, ctx: ToolContext) {
  const { supabase } = ctx;

  server.registerTool(
    'profile_get',
    {
      annotations: READ_ONLY,
      title: 'Get my profile',
      description: 'Return the signed-in user\'s profile (id, display name, email). Useful as a connectivity check.',
      inputSchema: z.object({}),
    },
    async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email, timezone')
        .eq('id', ctx.userId)
        .maybeSingle();
      if (error) return errorResult(error.message);
      return jsonResult(data);
    },
  );

  server.registerTool(
    'lists_list',
    {
      annotations: READ_ONLY,
      title: 'List your lists',
      description:
        'List the user\'s Gather lists (both owned and shared with them), ordered by the user\'s manual sort order. Returns id, name, emoji, color, type, and item_count.',
      inputSchema: z.object({ ...paginationShape }),
    },
    async ({ limit = DEFAULT_PAGE, offset = 0 }) => {
      const { data, error } = await supabase
        .from('lists')
        .select('id, name, emoji, color, type, item_count, sort_order, created_at')
        .order('sort_order', { ascending: true })
        .range(offset, offset + limit - 1);
      if (error) return errorResult(error.message);
      return jsonResult(data);
    },
  );

  server.registerTool(
    'lists_get',
    {
      annotations: READ_ONLY,
      title: 'Get a list',
      description:
        'Fetch one list by id with its metadata, its stores, and `effective_categories` — the category keys items on this list can use (null for list types without categories). `categories` is the list\'s own override (null = inherits defaults).',
      inputSchema: z.object({ list_id: z.string().uuid().describe('The list id.') }),
    },
    async ({ list_id }) => {
      const { data, error } = await supabase
        .from('lists')
        .select('id, name, emoji, color, type, item_count, categories, sort_order, created_at')
        .eq('id', list_id)
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return errorResult('List not found or not accessible.');
      const [effectiveCategories, storesRes] = await Promise.all([
        resolveEffectiveCategories(ctx, data),
        supabase.from('stores').select('id, name, color, sort_order').eq('list_id', list_id).order('sort_order', { ascending: true }),
      ]);
      if (storesRes.error) return errorResult(storesRes.error.message);
      return jsonResult({
        ...data,
        effective_categories: effectiveCategories?.map(({ key, name, color }) => ({ key, name, color })) ?? null,
        stores: storesRes.data,
      });
    },
  );

  server.registerTool(
    'items_list',
    {
      annotations: READ_ONLY,
      title: 'List items in a list',
      description:
        'List the items in a list, oldest first. By default returns only unchecked items; set include_checked to also return crossed-off items.',
      inputSchema: z.object({
        list_id: z.string().uuid().describe('The list id.'),
        include_checked: z.boolean().optional().describe('Include crossed-off items (default false).'),
        ...paginationShape,
      }),
    },
    async ({ list_id, include_checked = false, limit = DEFAULT_PAGE, offset = 0 }) => {
      let query = supabase
        .from('items')
        .select('id, name, category, is_checked, store_id, quantity, price, unit, note, image_url, added_at')
        .eq('list_id', list_id);
      if (!include_checked) query = query.eq('is_checked', false);
      const { data, error } = await query
        .order('added_at', { ascending: true })
        .range(offset, offset + limit - 1);
      if (error) return errorResult(error.message);
      return jsonResult(data);
    },
  );

  server.registerTool(
    'collections_list',
    {
      annotations: READ_ONLY,
      title: 'List recipe collections',
      description: 'List the user\'s recipe collections (owned and shared), ordered by sort order.',
      inputSchema: z.object({ ...paginationShape }),
    },
    async ({ limit = DEFAULT_PAGE, offset = 0 }) => {
      const { data, error } = await supabase
        .from('collections')
        .select('id, name, emoji, description, is_default, sort_order, created_at')
        .order('sort_order', { ascending: true })
        .range(offset, offset + limit - 1);
      if (error) return errorResult(error.message);
      return jsonResult(data);
    },
  );

  server.registerTool(
    'recipes_list',
    {
      annotations: READ_ONLY,
      title: 'List recipes',
      description:
        'List recipes the user can see (owned, in shared collections, or planned in a shared meal plan). Optionally filter to one collection. Newest first.',
      inputSchema: z.object({
        collection_id: z.string().uuid().optional().describe('Only recipes in this collection.'),
        ...paginationShape,
      }),
    },
    async ({ collection_id, limit = DEFAULT_PAGE, offset = 0 }) => {
      let query = supabase
        .from('recipes')
        .select('id, name, description, image_url, collection_id, cook_count, last_cooked_at, prep_time, cook_time, servings, source_name, source_url, created_at');
      if (collection_id) query = query.eq('collection_id', collection_id);
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) return errorResult(error.message);
      return jsonResult(data);
    },
  );

  server.registerTool(
    'recipes_get',
    {
      annotations: READ_ONLY,
      title: 'Get a recipe',
      description: 'Fetch one recipe with its ingredients, steps, and meal-plan tags (course, meal types, protein, cuisine, effort, method).',
      inputSchema: z.object({ recipe_id: z.string().uuid().describe('The recipe id.') }),
    },
    async ({ recipe_id }) => {
      const [recipeRes, ingredientsRes, stepsRes, attributesRes] = await Promise.all([
        supabase.from('recipes').select('*').eq('id', recipe_id).maybeSingle(),
        supabase.from('recipe_ingredients').select('name, quantity, sort_order').eq('recipe_id', recipe_id).order('sort_order', { ascending: true }),
        supabase.from('recipe_steps').select('instruction, sort_order').eq('recipe_id', recipe_id).order('sort_order', { ascending: true }),
        supabase.from('recipe_attributes').select('course, meal_types, protein, cuisine, effort, method, kid_friendly, perishables').eq('recipe_id', recipe_id).maybeSingle(),
      ]);
      if (recipeRes.error) return errorResult(recipeRes.error.message);
      if (!recipeRes.data) return errorResult('Recipe not found or not accessible.');
      return jsonResult({
        recipe: recipeRes.data,
        ingredients: ingredientsRes.data ?? [],
        steps: stepsRes.data ?? [],
        tags: attributesRes.data ?? null,
      });
    },
  );

  server.registerTool(
    'mealplan_get',
    {
      annotations: READ_ONLY,
      title: 'Get my meal plan',
      description:
        'Return the user\'s meal plan(s) they own or are a member of, with the meals enabled for each (breakfast/lunch/dinner).',
      inputSchema: z.object({}),
    },
    async () => {
      const { data, error } = await supabase
        .from('meal_plans')
        .select('id, name, enabled_meals, owner_id, created_at, updated_at');
      if (error) return errorResult(error.message);
      return jsonResult(data);
    },
  );

  server.registerTool(
    'mealplan_get_entries',
    {
      annotations: READ_ONLY,
      title: 'Get meal plan entries',
      description:
        'List the slots of a meal plan within a date range (inclusive). Dates are yyyy-MM-dd; weeks start Monday. Each entry has a meal (breakfast/lunch/dinner) and a kind (recipe/eating_out/leftovers/skip/custom).',
      inputSchema: z.object({
        meal_plan_id: z.string().uuid().describe('The meal plan id.'),
        from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Start date, yyyy-MM-dd (inclusive).'),
        to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('End date, yyyy-MM-dd (inclusive).'),
      }),
    },
    async ({ meal_plan_id, from_date, to_date }) => {
      const { data, error } = await supabase
        .from('meal_plan_entries')
        .select('id, date, meal, kind, recipe_id, title, note, is_locked, source, suggestion_reason, cooked_at')
        .eq('meal_plan_id', meal_plan_id)
        .gte('date', from_date)
        .lte('date', to_date)
        .order('date', { ascending: true });
      if (error) return errorResult(error.message);
      return jsonResult(data);
    },
  );
}
