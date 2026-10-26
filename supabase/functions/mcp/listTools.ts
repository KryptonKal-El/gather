/**
 * Phase 2 write tools for lists, items, categories, and stores.
 *
 * Denormalized counters (lists.item_count) are owned by database triggers and
 * are never written here. Adding items also writes the matching history rows,
 * as both apps do, so the items show up in suggestions afterwards.
 */
import { McpServer } from 'npm:@modelcontextprotocol/server@^2.0.0';
import { z } from 'npm:zod@^4.3.6';
import type { Json } from './database.types.ts';
import { type CategoryDef, chooseCategory, resolveEffectiveCategories } from './categories.ts';
import {
  DESTRUCTIVE,
  IDEMPOTENT_WRITE,
  type GatherClient,
  type ToolContext,
  WRITE,
  capitalizeFirst,
  chunk,
  dateKey,
  definedOnly,
  errorResult,
  jsonResult,
  uuid,
} from './shared.ts';

const LIST_TYPES = ['grocery', 'basic', 'guest_list', 'packing', 'project', 'todo'] as const;
const RSVP_STATUSES = ['invited', 'confirmed', 'declined', 'maybe', 'not_invited'] as const;
const MAX_ITEMS_PER_CALL = 200;
const INSERT_CHUNK = 100;
const ITEM_COLUMNS = 'id, list_id, name, category, is_checked, store_id, quantity, price, unit, note, image_url, due_date, rsvp_status, added_at';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/).describe('Hex color, e.g. #1565c0.');

const itemFieldsShape = {
  quantity: z.number().int().min(1).optional().describe('Quantity (default 1).'),
  unit: z.string().min(1).max(20).optional()
    .describe('Unit: each, cups, tbsp, tsp, oz, lb, g, kg, ml, L, pinch, dozen (default "each").'),
  category: z.string().nullable().optional()
    .describe('Category key from lists_get effective_categories. Omit to auto-categorize like the app does.'),
  store_id: z.string().uuid().nullable().optional().describe('Store id on this list (see lists_get stores).'),
  price: z.number().min(0).nullable().optional().describe('Price.'),
  note: z.string().max(500).nullable().optional().describe('Free-text note.'),
  image_url: z.string().url().nullable().optional().describe('Image URL.'),
  due_date: dateKey('Due date yyyy-MM-dd (todo/project lists).').nullable().optional(),
  rsvp_status: z.enum(RSVP_STATUSES).nullable().optional().describe('RSVP status (guest_list lists).'),
};

/** Loads the fields of a list needed for category resolution, or null if inaccessible. */
async function loadList(supabase: GatherClient, listId: string) {
  const { data, error } = await supabase
    .from('lists')
    .select('id, name, type, categories, owner_id')
    .eq('id', listId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load list: listId=${listId}`, { cause: error });
  return data;
}

/** Writes `categories` onto a list, returning the saved array. */
async function saveListCategories(supabase: GatherClient, listId: string, categories: CategoryDef[]) {
  const { error } = await supabase.from('lists').update({ categories: categories as unknown as Json }).eq('id', listId);
  if (error) throw new Error(`Failed to save categories: listId=${listId}`, { cause: error });
  return categories;
}

/** Registers list, item, category, and store write tools. */
export function registerListTools(server: McpServer, ctx: ToolContext) {
  const { supabase, userId } = ctx;

  // ---------------------------------------------------------------- lists

  server.registerTool(
    'lists_create',
    {
      title: 'Create a list',
      description: 'Create a new list owned by the user. Returns the new list.',
      annotations: WRITE,
      inputSchema: z.object({
        name: z.string().min(1).max(100).describe('List name.'),
        type: z.enum(LIST_TYPES).optional().describe('List type (default grocery).'),
        emoji: z.string().max(16).nullable().optional().describe('Optional emoji.'),
        color: hexColor.optional(),
      }),
    },
    async ({ name, type = 'grocery', emoji = null, color = '#1565c0' }) => {
      const { data: maxRow, error: maxError } = await supabase
        .from('lists')
        .select('sort_order')
        .eq('owner_id', userId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maxError) return errorResult(maxError.message);
      const { data, error } = await supabase
        .from('lists')
        .insert({
          owner_id: userId,
          name,
          type,
          emoji,
          color,
          sort_order: maxRow?.sort_order != null ? maxRow.sort_order + 1 : 0,
        })
        .select('id, name, emoji, color, type, item_count, sort_order, created_at')
        .single();
      if (error) return errorResult(error.message);
      return jsonResult(data);
    },
  );

  server.registerTool(
    'lists_update',
    {
      title: 'Update a list',
      description: 'Rename a list or change its emoji, color, or type. Only the fields you pass are changed.',
      annotations: IDEMPOTENT_WRITE,
      inputSchema: z.object({
        list_id: uuid('The list id.'),
        name: z.string().min(1).max(100).optional(),
        emoji: z.string().max(16).nullable().optional(),
        color: hexColor.optional(),
        type: z.enum(LIST_TYPES).optional(),
      }),
    },
    async ({ list_id, ...fields }) => {
      const updates = definedOnly(fields);
      if (Object.keys(updates).length === 0) return errorResult('Nothing to update.');
      const { data, error } = await supabase
        .from('lists')
        .update(updates)
        .eq('id', list_id)
        .select('id, name, emoji, color, type, item_count')
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return errorResult('List not found or you cannot edit it.');
      return jsonResult(data);
    },
  );

  server.registerTool(
    'lists_delete',
    {
      title: 'Delete a list',
      description: 'Permanently delete a list and all its items. Only the list owner can do this. Confirm with the user first.',
      annotations: DESTRUCTIVE,
      inputSchema: z.object({ list_id: uuid('The list id.') }),
    },
    async ({ list_id }) => {
      const { data, error } = await supabase.from('lists').delete().eq('id', list_id).select('id, name');
      if (error) return errorResult(error.message);
      if (!data?.length) return errorResult('List not found or only its owner can delete it.');
      return jsonResult({ deleted: data[0] });
    },
  );

  // ---------------------------------------------------------------- items

  server.registerTool(
    'items_add',
    {
      title: 'Add items to a list',
      description:
        `Add up to ${MAX_ITEMS_PER_CALL} items to a list. Names are capitalized and, unless a category is given, auto-categorized the way the app does. Does not merge with existing items — use shopping_add_ingredients for recipe ingredients.`,
      annotations: WRITE,
      inputSchema: z.object({
        list_id: uuid('The list id.'),
        items: z.array(z.object({
          name: z.string().min(1).max(200).describe('Item name.'),
          ...itemFieldsShape,
        })).min(1).max(MAX_ITEMS_PER_CALL),
      }),
    },
    async ({ list_id, items }) => {
      const list = await loadList(supabase, list_id);
      if (!list) return errorResult('List not found or not accessible.');
      const categories = await resolveEffectiveCategories(ctx, list);

      const rows = items.map((item) => {
        const name = capitalizeFirst(item.name);
        return {
          list_id,
          name,
          category: chooseCategory(name, item.category, categories, list.type),
          store_id: item.store_id ?? null,
          quantity: item.quantity ?? 1,
          unit: item.unit ?? 'each',
          price: item.price ?? null,
          note: item.note ?? null,
          image_url: item.image_url ?? null,
          due_date: item.due_date ?? null,
          rsvp_status: item.rsvp_status ?? null,
          is_checked: false,
          created_by: userId,
        };
      });

      const inserted = [];
      for (const batch of chunk(rows, INSERT_CHUNK)) {
        const { data, error } = await supabase.from('items').insert(batch).select(ITEM_COLUMNS);
        if (error) return errorResult(`${error.message} (${inserted.length} of ${rows.length} items were added before the failure)`);
        inserted.push(...data);
      }

      const { error: historyError } = await supabase.from('history').insert(rows.map((r) => ({
        user_id: userId,
        list_id,
        name: r.name,
        image_url: r.image_url,
        category: r.category,
        store_id: r.store_id,
        quantity: r.quantity,
        price: r.price,
        unit: r.unit,
        note: r.note,
      })));
      // History only feeds suggestions; the items themselves were saved.
      if (historyError) console.error('[mcp] items_add history insert failed', historyError);

      return jsonResult({ added: inserted.length, items: inserted });
    },
  );

  server.registerTool(
    'items_update',
    {
      title: 'Update an item',
      description: 'Change fields on one item. Only the fields you pass are changed; pass null to clear a field.',
      annotations: IDEMPOTENT_WRITE,
      inputSchema: z.object({
        item_id: uuid('The item id.'),
        name: z.string().min(1).max(200).optional(),
        is_checked: z.boolean().optional().describe('Cross off (true) or restore (false).'),
        ...itemFieldsShape,
      }),
    },
    async ({ item_id, name, ...fields }) => {
      const updates = definedOnly({ ...fields, name: name === undefined ? undefined : capitalizeFirst(name) });
      if (Object.keys(updates).length === 0) return errorResult('Nothing to update.');
      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', item_id)
        .select(ITEM_COLUMNS)
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return errorResult('Item not found or not accessible.');
      return jsonResult(data);
    },
  );

  server.registerTool(
    'items_set_checked',
    {
      title: 'Check or uncheck items',
      description: 'Cross off (or restore) several items at once.',
      annotations: IDEMPOTENT_WRITE,
      inputSchema: z.object({
        item_ids: z.array(z.string().uuid()).min(1).max(MAX_ITEMS_PER_CALL),
        is_checked: z.boolean().describe('true = crossed off, false = back on the list.'),
      }),
    },
    async ({ item_ids, is_checked }) => {
      const { data, error } = await supabase
        .from('items')
        .update({ is_checked })
        .in('id', item_ids)
        .select('id');
      if (error) return errorResult(error.message);
      return jsonResult({ updated: data.length, not_found: item_ids.length - data.length });
    },
  );

  server.registerTool(
    'items_delete',
    {
      title: 'Delete items',
      description: 'Permanently delete items by id.',
      annotations: DESTRUCTIVE,
      inputSchema: z.object({ item_ids: z.array(z.string().uuid()).min(1).max(MAX_ITEMS_PER_CALL) }),
    },
    async ({ item_ids }) => {
      const { data, error } = await supabase.from('items').delete().in('id', item_ids).select('id');
      if (error) return errorResult(error.message);
      return jsonResult({ deleted: data.length, not_found: item_ids.length - data.length });
    },
  );

  server.registerTool(
    'items_clear_checked',
    {
      title: 'Clear crossed-off items',
      description: 'Delete every crossed-off item in a list (the app\'s "Clear checked").',
      annotations: DESTRUCTIVE,
      inputSchema: z.object({ list_id: uuid('The list id.') }),
    },
    async ({ list_id }) => {
      const { data, error } = await supabase
        .from('items')
        .delete()
        .eq('list_id', list_id)
        .eq('is_checked', true)
        .select('id');
      if (error) return errorResult(error.message);
      return jsonResult({ deleted: data.length });
    },
  );

  // ---------------------------------------------------------------- categories

  server.registerTool(
    'categories_upsert',
    {
      title: 'Add or edit a list category',
      description:
        'Add a category to a list, or edit one by key. The first edit copies the list\'s inherited default categories onto the list, as the app does. Keywords drive auto-categorization of new items.',
      annotations: IDEMPOTENT_WRITE,
      inputSchema: z.object({
        list_id: uuid('The list id.'),
        key: z.string().regex(/^[a-z0-9_]+$/).max(50).optional()
          .describe('Existing category key to edit. Omit to add a new category (key derived from name).'),
        name: z.string().min(1).max(50).describe('Display name.'),
        color: hexColor.optional(),
        keywords: z.array(z.string().min(1).max(50)).max(200).optional()
          .describe('Item-name keywords for auto-categorization (replaces existing keywords when editing).'),
      }),
    },
    async ({ list_id, key, name, color, keywords }) => {
      const list = await loadList(supabase, list_id);
      if (!list) return errorResult('List not found or not accessible.');
      const current = await resolveEffectiveCategories(ctx, list);
      if (!current) return errorResult(`Lists of type "${list.type}" do not use categories.`);

      const categories = current.map((c) => ({ ...c, keywords: [...c.keywords] }));
      if (key) {
        const existing = categories.find((c) => c.key === key);
        if (!existing) return errorResult(`No category with key "${key}" on this list.`);
        existing.name = name;
        if (color) existing.color = color;
        if (keywords) existing.keywords = keywords;
      } else {
        const newKey = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'category';
        if (categories.some((c) => c.key === newKey)) {
          return errorResult(`A category with key "${newKey}" already exists — pass key to edit it.`);
        }
        categories.push({ key: newKey, name, color: color ?? '#9e9e9e', keywords: keywords ?? [] });
      }
      const saved = await saveListCategories(supabase, list_id, categories);
      return jsonResult({ categories: saved.map(({ key: k, name: n, color: c }) => ({ key: k, name: n, color: c })) });
    },
  );

  server.registerTool(
    'categories_delete',
    {
      title: 'Remove a list category',
      description: 'Remove a category from a list by key. Items already in it keep the old key; recategorize them with items_update if needed.',
      annotations: DESTRUCTIVE,
      inputSchema: z.object({
        list_id: uuid('The list id.'),
        key: z.string().describe('Category key to remove.'),
      }),
    },
    async ({ list_id, key }) => {
      const list = await loadList(supabase, list_id);
      if (!list) return errorResult('List not found or not accessible.');
      const current = await resolveEffectiveCategories(ctx, list);
      if (!current) return errorResult(`Lists of type "${list.type}" do not use categories.`);
      const remaining = current.filter((c) => c.key !== key);
      if (remaining.length === current.length) return errorResult(`No category with key "${key}" on this list.`);
      const saved = await saveListCategories(supabase, list_id, remaining);
      return jsonResult({ categories: saved.map(({ key: k, name, color }) => ({ key: k, name, color })) });
    },
  );

  // ---------------------------------------------------------------- stores

  server.registerTool(
    'stores_create',
    {
      title: 'Add a store to a list',
      description: 'Create a store on a list (items can be grouped by store). Appended after existing stores.',
      annotations: WRITE,
      inputSchema: z.object({
        list_id: uuid('The list id.'),
        name: z.string().min(1).max(100),
        color: hexColor.nullable().optional(),
      }),
    },
    async ({ list_id, name, color = null }) => {
      const { data: maxRow, error: maxError } = await supabase
        .from('stores')
        .select('sort_order')
        .eq('list_id', list_id)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maxError) return errorResult(maxError.message);
      const { data, error } = await supabase
        .from('stores')
        .insert({ list_id, name, color, sort_order: (maxRow?.sort_order ?? -1) + 1 })
        .select('id, list_id, name, color, sort_order')
        .single();
      if (error) return errorResult(error.message);
      return jsonResult(data);
    },
  );

  server.registerTool(
    'stores_update',
    {
      title: 'Update a store',
      description: 'Rename a store, change its color, or move it to a position (0 = first).',
      annotations: IDEMPOTENT_WRITE,
      inputSchema: z.object({
        store_id: uuid('The store id.'),
        name: z.string().min(1).max(100).optional(),
        color: hexColor.nullable().optional(),
        sort_order: z.number().int().min(0).optional(),
      }),
    },
    async ({ store_id, ...fields }) => {
      const updates = definedOnly(fields);
      if (Object.keys(updates).length === 0) return errorResult('Nothing to update.');
      const { data, error } = await supabase
        .from('stores')
        .update(updates)
        .eq('id', store_id)
        .select('id, list_id, name, color, sort_order')
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return errorResult('Store not found or not accessible.');
      return jsonResult(data);
    },
  );

  server.registerTool(
    'stores_delete',
    {
      title: 'Delete a store',
      description: 'Delete a store from a list. Its items stay on the list without a store.',
      annotations: DESTRUCTIVE,
      inputSchema: z.object({ store_id: uuid('The store id.') }),
    },
    async ({ store_id }) => {
      const { data, error } = await supabase.from('stores').delete().eq('id', store_id).select('id, name');
      if (error) return errorResult(error.message);
      if (!data?.length) return errorResult('Store not found or not accessible.');
      return jsonResult({ deleted: data[0] });
    },
  );
}
