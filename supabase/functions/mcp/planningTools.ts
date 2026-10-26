/**
 * Phase 3 tools: meal plan slots, adding recipe ingredients to a shopping
 * list, and the cook log.
 *
 * A recipe slot may only reference a recipe the user can already read (RLS),
 * so new recipes must be created with recipes_create before they are planned.
 * Finishing a cook marks that day's planned meal as cooked and bumps the
 * recipe's cook_count via database triggers; neither is written here.
 */
import { McpServer } from 'npm:@modelcontextprotocol/server@^2.0.0';
import { z } from 'npm:zod@^4.3.6';
import { type CategoryDef, chooseCategory, resolveEffectiveCategories } from './categories.ts';
import {
  DESTRUCTIVE,
  IDEMPOTENT_WRITE,
  MAX_PAGE,
  type GatherClient,
  type ToolContext,
  WRITE,
  capitalizeFirst,
  dateKey,
  errorResult,
  jsonResult,
  uuid,
} from './shared.ts';

const MEALS = ['breakfast', 'lunch', 'dinner'] as const;
const ENTRY_KINDS = ['recipe', 'eating_out', 'leftovers', 'skip', 'custom'] as const;
const ENTRY_COLUMNS = 'id, meal_plan_id, date, meal, kind, recipe_id, title, note, is_locked, source, cooked_at';
const MAX_ENTRIES_PER_CALL = 63; // three meals a day for three weeks
const MAX_INGREDIENTS_PER_CALL = 200;

/** Reads every item on a list, paging past PostgREST's max_rows cap. */
async function fetchAllItems(supabase: GatherClient, listId: string) {
  const all: Array<{ id: string; name: string; quantity: number | null; unit: string; is_checked: boolean | null }> = [];
  for (let from = 0; ; from += MAX_PAGE) {
    const { data, error } = await supabase
      .from('items')
      .select('id, name, quantity, unit, is_checked')
      .eq('list_id', listId)
      .is('parent_item_id', null)
      .order('added_at', { ascending: true })
      .range(from, from + MAX_PAGE - 1);
    if (error) throw new Error(`Failed to load items: listId=${listId}`, { cause: error });
    all.push(...data);
    if (data.length < MAX_PAGE) return all;
  }
}

/** Fetches a cook session with its step snapshot. */
async function loadCookSession(supabase: GatherClient, sessionId: string) {
  const [sessionRes, stepsRes] = await Promise.all([
    supabase.from('cook_sessions').select('id, recipe_id, started_at, completed_at, current_step').eq('id', sessionId).maybeSingle(),
    supabase.from('cook_session_steps').select('id, sort_order, instruction, completed_at').eq('session_id', sessionId).order('sort_order', { ascending: true }),
  ]);
  if (sessionRes.error) throw new Error(`Failed to load cook session: sessionId=${sessionId}`, { cause: sessionRes.error });
  if (stepsRes.error) throw new Error(`Failed to load cook steps: sessionId=${sessionId}`, { cause: stepsRes.error });
  return sessionRes.data ? { session: sessionRes.data, steps: stepsRes.data } : null;
}

/** Registers meal-plan, shopping, and cook tools. */
export function registerPlanningTools(server: McpServer, ctx: ToolContext) {
  const { supabase, userId } = ctx;

  // ---------------------------------------------------------------- meal plan

  server.registerTool(
    'mealplan_ensure',
    {
      title: 'Get or create my meal plan',
      description:
        'Return the meal plans the user can use, creating their own plan first if they have access to none (as the apps do on first open). Call before planning meals to get a meal_plan_id.',
      annotations: IDEMPOTENT_WRITE,
      inputSchema: z.object({}),
    },
    async () => {
      const fetchPlans = () => supabase
        .from('meal_plans')
        .select('id, name, enabled_meals, owner_id, created_at')
        .order('created_at', { ascending: true });
      let { data, error } = await fetchPlans();
      if (error) return errorResult(error.message);
      let created = false;
      if (!data?.length) {
        const { error: insertError } = await supabase.from('meal_plans').insert({ owner_id: userId });
        // A unique index allows one owned plan; a concurrent create from another device is fine.
        if (insertError && insertError.code !== '23505') return errorResult(insertError.message);
        created = !insertError;
        ({ data, error } = await fetchPlans());
        if (error) return errorResult(error.message);
      }
      return jsonResult({
        created,
        plans: (data ?? []).map((p) => ({ ...p, is_owner: p.owner_id === userId })),
      });
    },
  );

  server.registerTool(
    'mealplan_upsert_entries',
    {
      title: 'Plan meals',
      description:
        `Set up to ${MAX_ENTRIES_PER_CALL} meal-plan slots (one per date + meal; an existing slot is replaced). kind=recipe needs a recipe_id the user can see — create new recipes with recipes_create first. kind=custom needs a title; eating_out may carry the restaurant as title.`,
      annotations: IDEMPOTENT_WRITE,
      inputSchema: z.object({
        meal_plan_id: uuid('The meal plan id (from mealplan_ensure).'),
        entries: z.array(z.object({
          date: dateKey('Date yyyy-MM-dd.'),
          meal: z.enum(MEALS),
          kind: z.enum(ENTRY_KINDS),
          recipe_id: z.string().uuid().nullable().optional().describe('Required for kind=recipe.'),
          title: z.string().max(200).nullable().optional().describe('Defaults to the recipe name for kind=recipe.'),
          note: z.string().max(1000).nullable().optional(),
        })).min(1).max(MAX_ENTRIES_PER_CALL),
      }),
    },
    async ({ meal_plan_id, entries }) => {
      const slotKey = (date: string, meal: string) => `${date}|${meal}`;
      const seen = new Set<string>();
      for (const e of entries) {
        const key = slotKey(e.date, e.meal);
        if (seen.has(key)) return errorResult(`Duplicate slot ${e.date} ${e.meal} in one call.`);
        seen.add(key);
        if (e.kind === 'recipe' && !e.recipe_id) return errorResult(`${e.date} ${e.meal}: kind=recipe needs recipe_id.`);
        if (e.kind !== 'recipe' && e.recipe_id) return errorResult(`${e.date} ${e.meal}: only kind=recipe takes a recipe_id.`);
        if (e.kind === 'custom' && !e.title?.trim()) return errorResult(`${e.date} ${e.meal}: kind=custom needs a title.`);
      }

      const recipeIds = [...new Set(entries.flatMap((e) => (e.recipe_id ? [e.recipe_id] : [])))];
      const recipeNames = new Map<string, string>();
      if (recipeIds.length) {
        const { data, error } = await supabase.from('recipes').select('id, name').in('id', recipeIds);
        if (error) return errorResult(error.message);
        for (const r of data) recipeNames.set(r.id, r.name);
        const missing = recipeIds.filter((id) => !recipeNames.has(id));
        if (missing.length) return errorResult(`Recipes not found or not accessible: ${missing.join(', ')}. Create them with recipes_create first.`);
      }

      const dates = entries.map((e) => e.date).sort();
      const { data: existing, error: existingError } = await supabase
        .from('meal_plan_entries')
        .select('date, meal, recipe_id, cooked_at')
        .eq('meal_plan_id', meal_plan_id)
        .gte('date', dates[0])
        .lte('date', dates[dates.length - 1]);
      if (existingError) return errorResult(existingError.message);
      const existingBySlot = new Map(existing.map((e: { date: string; meal: string }) => [slotKey(e.date, e.meal), e]));

      const now = new Date().toISOString();
      const rows = entries.map((e) => {
        const prior = existingBySlot.get(slotKey(e.date, e.meal)) as { recipe_id: string | null; cooked_at: string | null } | undefined;
        const recipeId = e.recipe_id ?? null;
        return {
          meal_plan_id,
          date: e.date,
          meal: e.meal,
          kind: e.kind,
          recipe_id: recipeId,
          title: e.title ?? (recipeId ? recipeNames.get(recipeId) : null) ?? null,
          note: e.note ?? null,
          // A slot keeps its "cooked" mark only while it still holds the same recipe.
          cooked_at: recipeId && prior?.recipe_id === recipeId ? prior.cooked_at : null,
          source: 'manual',
          suggestion_reason: null,
          created_by: userId,
          updated_at: now,
        };
      });
      const { data, error } = await supabase
        .from('meal_plan_entries')
        .upsert(rows, { onConflict: 'meal_plan_id,date,meal' })
        .select(ENTRY_COLUMNS);
      if (error) return errorResult(error.message);
      return jsonResult({ saved: data.length, entries: data });
    },
  );

  server.registerTool(
    'mealplan_delete_entries',
    {
      title: 'Clear planned meals',
      description: 'Clear meal-plan slots, by entry id or by date + meal.',
      annotations: DESTRUCTIVE,
      inputSchema: z.object({
        meal_plan_id: uuid('The meal plan id.'),
        entry_ids: z.array(z.string().uuid()).max(MAX_ENTRIES_PER_CALL).optional(),
        slots: z.array(z.object({ date: dateKey('Date yyyy-MM-dd.'), meal: z.enum(MEALS) }))
          .max(MAX_ENTRIES_PER_CALL).optional(),
      }),
    },
    async ({ meal_plan_id, entry_ids = [], slots = [] }) => {
      if (!entry_ids.length && !slots.length) return errorResult('Pass entry_ids or slots.');
      let deleted = 0;
      if (entry_ids.length) {
        const { data, error } = await supabase
          .from('meal_plan_entries').delete().eq('meal_plan_id', meal_plan_id).in('id', entry_ids).select('id');
        if (error) return errorResult(error.message);
        deleted += data.length;
      }
      for (const { date, meal } of slots) {
        const { data, error } = await supabase
          .from('meal_plan_entries').delete().eq('meal_plan_id', meal_plan_id).eq('date', date).eq('meal', meal).select('id');
        if (error) return errorResult(`${error.message} (${deleted} slot(s) were cleared before the failure)`);
        deleted += data.length;
      }
      return jsonResult({ deleted });
    },
  );

  // ---------------------------------------------------------------- shopping

  server.registerTool(
    'shopping_add_ingredients',
    {
      title: 'Add ingredients to a shopping list',
      description:
        'Add recipe ingredients to a list the way the app\'s "Add to list" does: an ingredient whose name matches an item already on the list (case-insensitive) increases that item\'s quantity instead of duplicating it; others are added and auto-categorized. Repeated names in one call are combined. Use preview=true to show the user the result before writing.',
      annotations: WRITE,
      inputSchema: z.object({
        list_id: uuid('The shopping list id.'),
        ingredients: z.array(z.object({
          name: z.string().min(1).max(200).describe('Shopping item name, e.g. "Yellow onion" (not "1 onion, diced").'),
          quantity: z.number().positive().optional().describe('How many to buy (rounded, minimum 1; default 1).'),
          unit: z.string().min(1).max(20).optional().describe('Unit for new items (default "each").'),
          category: z.string().nullable().optional().describe('Category key; omit to auto-categorize.'),
        })).min(1).max(MAX_INGREDIENTS_PER_CALL),
        preview: z.boolean().optional().describe('Return what would change without writing (default false).'),
      }),
    },
    async ({ list_id, ingredients, preview = false }) => {
      const { data: list, error: listError } = await supabase
        .from('lists').select('id, name, type, categories').eq('id', list_id).maybeSingle();
      if (listError) return errorResult(listError.message);
      if (!list) return errorResult('List not found or not accessible.');

      let existingItems;
      let categories: CategoryDef[] | null;
      try {
        [existingItems, categories] = await Promise.all([fetchAllItems(supabase, list_id), resolveEffectiveCategories(ctx, list)]);
      } catch (err) {
        return errorResult((err as Error).message);
      }

      // Unchecked items win the name match; a crossed-off match is put back on the list.
      const existingByName = new Map<string, (typeof existingItems)[number]>();
      for (const item of existingItems) {
        const key = item.name.toLowerCase();
        const current = existingByName.get(key);
        if (!current || (current.is_checked && !item.is_checked)) existingByName.set(key, item);
      }

      const combined = new Map<string, { name: string; quantity: number; unit: string; category: string | null | undefined }>();
      for (const ing of ingredients) {
        const name = capitalizeFirst(ing.name);
        const key = name.toLowerCase();
        const qty = Math.max(1, Math.round(ing.quantity ?? 1));
        const prior = combined.get(key);
        if (prior) prior.quantity += qty;
        else combined.set(key, { name, quantity: qty, unit: ing.unit ?? 'each', category: ing.category });
      }

      const toAdd = [];
      const toUpdate = [];
      for (const [key, ing] of combined) {
        const existing = existingByName.get(key);
        if (existing) {
          toUpdate.push({
            id: existing.id,
            name: existing.name,
            unit: existing.unit,
            was_checked: !!existing.is_checked,
            current_quantity: existing.is_checked ? 0 : existing.quantity ?? 1,
            new_quantity: existing.is_checked ? ing.quantity : (existing.quantity ?? 1) + ing.quantity,
          });
        } else {
          toAdd.push({
            list_id,
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            category: chooseCategory(ing.name, ing.category, categories, list.type),
            is_checked: false,
            created_by: userId,
          });
        }
      }

      const summary = {
        list: { id: list.id, name: list.name },
        new_items: toAdd.map(({ name, quantity, unit, category }) => ({ name, quantity, unit, category })),
        updated_items: toUpdate,
      };
      if (preview) return jsonResult({ preview: true, ...summary });

      if (toAdd.length) {
        const { error } = await supabase.from('items').insert(toAdd);
        if (error) return errorResult(`Failed to add items: ${error.message}`);
      }
      const failed: string[] = [];
      for (const u of toUpdate) {
        const updates = u.was_checked ? { quantity: u.new_quantity, is_checked: false } : { quantity: u.new_quantity };
        const { error } = await supabase.from('items').update(updates).eq('id', u.id);
        if (error) failed.push(`${u.name}: ${error.message}`);
      }
      if (failed.length) {
        return errorResult(`Added ${toAdd.length} item(s), but some quantity updates failed: ${failed.join('; ')}`);
      }
      return jsonResult({ added: toAdd.length, updated: toUpdate.length, ...summary });
    },
  );

  // ---------------------------------------------------------------- cook log

  server.registerTool(
    'cook_start',
    {
      title: 'Start cooking a recipe',
      description:
        'Start a cook session for a recipe (snapshots its current steps), or return the user\'s in-progress session for that recipe if one exists.',
      annotations: IDEMPOTENT_WRITE,
      inputSchema: z.object({ recipe_id: uuid('The recipe id.') }),
    },
    async ({ recipe_id }) => {
      const findActive = () => supabase
        .from('cook_sessions').select('id').eq('recipe_id', recipe_id).eq('user_id', userId).is('completed_at', null).maybeSingle();
      try {
        const { data: active, error: activeError } = await findActive();
        if (activeError) return errorResult(activeError.message);
        if (active) return jsonResult({ resumed: true, ...(await loadCookSession(supabase, active.id)) });

        const { data: steps, error: stepsError } = await supabase
          .from('recipe_steps').select('instruction, sort_order').eq('recipe_id', recipe_id).order('sort_order', { ascending: true });
        if (stepsError) return errorResult(stepsError.message);

        const { data: session, error } = await supabase
          .from('cook_sessions').insert({ recipe_id, user_id: userId }).select('id').single();
        if (error?.code === '23505') {
          // Another device started one in the meantime (one active cook per recipe).
          const { data: raced } = await findActive();
          if (raced) return jsonResult({ resumed: true, ...(await loadCookSession(supabase, raced.id)) });
        }
        if (error) return errorResult(error.message);

        if (steps.length) {
          const { error: snapError } = await supabase.from('cook_session_steps').insert(
            steps.map((s: { instruction: string }, i: number) => ({ session_id: session.id, sort_order: i, instruction: s.instruction })),
          );
          if (snapError) {
            await supabase.from('cook_sessions').delete().eq('id', session.id);
            return errorResult(`Failed to snapshot steps: ${snapError.message}`);
          }
        }
        return jsonResult({ resumed: false, ...(await loadCookSession(supabase, session.id)) });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.registerTool(
    'cook_complete',
    {
      title: 'Finish cooking',
      description:
        'Mark a cook session finished. This logs the cook on the recipe and marks today\'s planned meal for that recipe as cooked.',
      annotations: WRITE,
      inputSchema: z.object({ session_id: uuid('The cook session id (from cook_start).') }),
    },
    async ({ session_id }) => {
      const { data, error } = await supabase
        .from('cook_sessions')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', session_id)
        .eq('user_id', userId)
        .is('completed_at', null)
        .select('id, recipe_id, started_at, completed_at')
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return errorResult('No in-progress cook session with that id.');
      return jsonResult(data);
    },
  );

  server.registerTool(
    'cook_discard',
    {
      title: 'Discard a cook in progress',
      description: 'Throw away an unfinished cook session without logging it.',
      annotations: DESTRUCTIVE,
      inputSchema: z.object({ session_id: uuid('The cook session id.') }),
    },
    async ({ session_id }) => {
      const { data, error } = await supabase
        .from('cook_sessions')
        .delete()
        .eq('id', session_id)
        .eq('user_id', userId)
        .is('completed_at', null)
        .select('id');
      if (error) return errorResult(error.message);
      if (!data?.length) return errorResult('No in-progress cook session with that id.');
      return jsonResult({ discarded: session_id });
    },
  );
}
