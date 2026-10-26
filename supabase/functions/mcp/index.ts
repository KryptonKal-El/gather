/**
 * Gather Lists — MCP server (Supabase Edge Function).
 *
 * Exposes Gather Lists operations to MCP clients (e.g. Claude) over the
 * Streamable HTTP transport. Supabase Auth is the OAuth 2.1 authorization
 * server; this function is the resource server. The auth middleware validates
 * the bearer token and hands each request an RLS-scoped Supabase client, so
 * every tool is automatically constrained to what the signed-in user may
 * see and change — the app's existing Row Level Security IS the authorization
 * model here. Tools must never bypass it (no service-role client).
 *
 * Phased rollout (see docs): Phase 1 = read-only tools (this file today),
 * Phase 2 = writes, Phase 3 = meal planning / shopping.
 *
 * NOTE: `withSupabase` is used without its `<Database>` type parameter until
 * generated types are wired in (`supabase gen types typescript --linked`).
 * Queries run correctly RLS-scoped regardless; this only affects compile-time
 * column typing.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@^2.0.0';
import { z } from 'npm:zod@^4.3.6';
import { pipeline } from 'npm:@supabase/middleware@1';
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@1';

// PostgREST caps responses at max_rows = 1000 (see config.toml); every list
// tool paginates within that ceiling.
const MAX_PAGE = 1000;
const DEFAULT_PAGE = 200;

/** Wraps a value as an MCP text result carrying pretty-printed JSON. */
function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

/** Wraps an error message as an MCP error result. */
function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}

/** Shared pagination inputs for list-style tools. */
const paginationShape = {
  limit: z.number().int().min(1).max(MAX_PAGE).optional()
    .describe(`Max rows to return (default ${DEFAULT_PAGE}, max ${MAX_PAGE}).`),
  offset: z.number().int().min(0).optional().describe('Row offset for pagination (default 0).'),
};

/**
 * Registers the Phase 1 read-only tools on a per-request MCP server.
 * `supabase` is the RLS-scoped client for the authenticated user.
 */
function registerReadTools(server: McpServer, supabase: any) {
  server.registerTool(
    'profile_get',
    {
      title: 'Get my profile',
      description: 'Return the signed-in user\'s profile (id, display name, email). Useful as a connectivity check.',
      inputSchema: z.object({}),
    },
    async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email, timezone')
        .maybeSingle();
      if (error) return errorResult(error.message);
      return jsonResult(data);
    },
  );

  server.registerTool(
    'lists_list',
    {
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
      title: 'Get a list',
      description:
        'Fetch one list by id, including its metadata and its custom categories (the `categories` JSON array; null means the list uses the default categories for its type).',
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
      return jsonResult(data);
    },
  );

  server.registerTool(
    'items_list',
    {
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

Deno.serve(
  pipeline(
    [withOAuthProtectedResource(), withSupabase({ auth: 'user' })],
    async (req: Request, { supabase }: { supabase: any }) => {
      const handler = createMcpHandler((server: McpServer) => {
        registerReadTools(server, supabase);
        // Phase 2 (writes) and Phase 3 (meal planning / shopping) tools are
        // registered here as they land.
      });
      return handler.fetch(req);
    },
  ),
);
