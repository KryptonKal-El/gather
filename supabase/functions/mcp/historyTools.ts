/**
 * History tools: what the user has added to lists, and what they have cooked.
 *
 * `history` gets one row per item added to a list (the apps' suggestion
 * source), so counting rows by name gives how often something is added.
 * `cook_sessions` gets one row per cook started in cooking mode.
 */
import { McpServer } from 'npm:@modelcontextprotocol/server@^2.0.0';
import { z } from 'npm:zod@^4.3.6';
import {
  DEFAULT_PAGE,
  MAX_PAGE,
  READ_ONLY,
  type ToolContext,
  chunk,
  dateKey,
  errorResult,
  jsonResult,
  paginationShape,
  uuid,
} from './shared.ts';

// Upper bound on history rows scanned per call, so a huge account can't make
// one call page through PostgREST indefinitely.
const MAX_SCAN_ROWS = 20000;

type HistoryRow = {
  name: string;
  list_id: string | null;
  category: string | null;
  store_id: string | null;
  quantity: number | null;
  unit: string | null;
  price: number | null;
  note: string | null;
  added_at: string | null;
};

type HistorySummary = {
  name: string;
  times_added: number;
  first_added_at: string | null;
  last_added_at: string | null;
  category: string | null;
  store_id: string | null;
  store_name?: string | null;
  quantity: number | null;
  unit: string | null;
  price: number | null;
  note: string | null;
  list_ids: string[];
};

/** Escapes LIKE wildcards so a search term matches literally. */
const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Adds one day to a yyyy-MM-dd key, for an exclusive upper bound. */
const nextDay = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Registers the item and cook history tools on a per-request MCP server.
 */
export function registerHistoryTools(server: McpServer, ctx: ToolContext) {
  const { supabase, userId } = ctx;

  server.registerTool(
    'history_summary',
    {
      annotations: READ_ONLY,
      title: 'Summarize item history',
      description:
        'Summarize what has been added to the user\'s lists over time, one row per item name: how many times it was added, when it was first and last added, which lists, and its latest saved details (category, store, quantity, unit, price, note). Covers the user\'s own lists and lists shared with them, including items collaborators added. Use it for "what do I usually buy", "when did I last get X", or building a list from staples. Being added to a list does not prove an item was bought.',
      inputSchema: z.object({
        list_id: uuid('Only history from this list.').optional(),
        name_contains: z.string().trim().min(1).optional()
          .describe('Only items whose name contains this text (case-insensitive).'),
        since: dateKey('Only adds on or after this date, yyyy-MM-dd (UTC).').optional(),
        sort: z.enum(['frequent', 'recent']).optional()
          .describe('"frequent" (default): most-added first. "recent": most recently added first.'),
        min_count: z.number().int().min(1).optional()
          .describe('Only items added at least this many times (default 1).'),
        limit: z.number().int().min(1).max(500).optional()
          .describe('Max items to return (default 50, max 500).'),
      }),
    },
    async ({ list_id, name_contains, since, sort = 'frequent', min_count = 1, limit = 50 }) => {
      const rows: HistoryRow[] = [];
      let isTruncated = false;
      for (let offset = 0; ; offset += MAX_PAGE) {
        if (offset >= MAX_SCAN_ROWS) {
          isTruncated = true;
          break;
        }
        let query = supabase
          .from('history')
          .select('name, list_id, category, store_id, quantity, unit, price, note, added_at');
        if (list_id) query = query.eq('list_id', list_id);
        if (name_contains) query = query.ilike('name', `%${escapeLike(name_contains)}%`);
        if (since) query = query.gte('added_at', `${since}T00:00:00Z`);
        const { data, error } = await query
          .order('added_at', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + MAX_PAGE - 1);
        if (error) return errorResult(error.message);
        rows.push(...data);
        if (data.length < MAX_PAGE) break;
      }

      // Rows are oldest-first, so the last row seen for a name carries its
      // latest saved details (the same template the apps restore on re-add).
      const byName = new Map<string, HistorySummary>();
      for (const row of rows) {
        const key = row.name.trim().toLowerCase();
        const existing = byName.get(key);
        const listIds = new Set(existing?.list_ids ?? []);
        if (row.list_id) listIds.add(row.list_id);
        byName.set(key, {
          name: row.name,
          times_added: (existing?.times_added ?? 0) + 1,
          first_added_at: existing?.first_added_at ?? row.added_at,
          last_added_at: row.added_at ?? existing?.last_added_at ?? null,
          category: row.category,
          store_id: row.store_id,
          quantity: row.quantity,
          unit: row.unit,
          price: row.price,
          note: row.note,
          list_ids: [...listIds],
        });
      }

      const items = [...byName.values()]
        .filter((item) => item.times_added >= min_count)
        .sort((a, b) =>
          sort === 'recent'
            ? (b.last_added_at ?? '').localeCompare(a.last_added_at ?? '')
            : b.times_added - a.times_added || (b.last_added_at ?? '').localeCompare(a.last_added_at ?? ''),
        )
        .slice(0, limit);

      const storeIds = [...new Set(items.map((item) => item.store_id).filter((id): id is string => id !== null))];
      const storeNames = new Map<string, string>();
      for (const ids of chunk(storeIds, 200)) {
        const { data, error } = await supabase.from('stores').select('id, name').in('id', ids);
        if (error) return errorResult(error.message);
        for (const store of data) storeNames.set(store.id, store.name);
      }
      for (const item of items) {
        item.store_name = item.store_id ? storeNames.get(item.store_id) ?? null : null;
      }

      return jsonResult({
        distinct_items: byName.size,
        rows_scanned: rows.length,
        truncated: isTruncated,
        items,
      });
    },
  );

  server.registerTool(
    'items_suggest',
    {
      annotations: READ_ONLY,
      title: 'Suggest a previous item to reuse',
      description:
        'Find previously-added items matching a name so you can reuse one instead of creating a generic new item. Returns past matches ranked by how often and how recently they were added, each with its reusable details (category, store, unit, quantity, note) restored from the last time it was added — so reusing "Bread" brings back its Bakery category, not Other. Draws from the user\'s full item history across all their lists; pass list_id to prefer and correctly attach stores from the list you are adding to. Call this before items_add, then pass the chosen match\'s details into items_add.',
      inputSchema: z.object({
        name: z.string().trim().min(1).describe('The item name to find previous matches for.'),
        list_id: uuid('The list you are adding to. Matches on it rank higher, and store ids are returned valid for this list.').optional(),
        limit: z.number().int().min(1).max(50).optional().describe('Max matches to return (default 8, max 50).'),
      }),
    },
    async ({ name, list_id, limit = 8 }) => {
      const query = name.trim().toLowerCase();

      // Scan the full accessible history for name matches (RLS already limits
      // this to the user's own and shared lists). Name-filtered, so it's small.
      const rows: HistoryRow[] = [];
      for (let offset = 0; offset < MAX_SCAN_ROWS; offset += MAX_PAGE) {
        const { data, error } = await supabase
          .from('history')
          .select('name, list_id, category, store_id, quantity, unit, price, note, added_at')
          .ilike('name', `%${escapeLike(name.trim())}%`)
          .order('added_at', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + MAX_PAGE - 1);
        if (error) return errorResult(error.message);
        rows.push(...data);
        if (data.length < MAX_PAGE) break;
      }

      // Oldest-first, so the last row seen for a name carries its latest saved
      // details — the template both apps restore when the item is re-added.
      const byName = new Map<string, HistorySummary & { in_current_list: boolean }>();
      for (const row of rows) {
        const key = row.name.trim().toLowerCase();
        const existing = byName.get(key);
        const listIds = new Set(existing?.list_ids ?? []);
        if (row.list_id) listIds.add(row.list_id);
        byName.set(key, {
          name: row.name,
          times_added: (existing?.times_added ?? 0) + 1,
          first_added_at: existing?.first_added_at ?? row.added_at,
          last_added_at: row.added_at ?? existing?.last_added_at ?? null,
          category: row.category,
          store_id: row.store_id,
          quantity: row.quantity,
          unit: row.unit,
          price: row.price,
          note: row.note,
          list_ids: [...listIds],
          in_current_list: (existing?.in_current_list ?? false) || (!!list_id && row.list_id === list_id),
        });
      }

      // Rank by frequency + recency, nudging exact-name and current-list
      // matches up so the most reusable candidate comes first.
      const now = Date.now();
      const recencyWeight = (iso: string | null) => {
        if (!iso) return 0;
        const days = (now - Date.parse(iso)) / 86_400_000;
        if (days <= 7) return 3;
        if (days <= 30) return 2;
        if (days <= 90) return 1;
        return 0;
      };
      const matchWeight = (candidate: string) => {
        const lower = candidate.trim().toLowerCase();
        if (lower === query) return 2;
        if (lower.startsWith(query)) return 1;
        return 0;
      };
      const score = (item: HistorySummary & { in_current_list: boolean }) =>
        item.times_added + recencyWeight(item.last_added_at) + (item.in_current_list ? 2 : 0) + matchWeight(item.name);

      const ranked = [...byName.values()]
        .sort((a, b) =>
          score(b) - score(a)
          || b.times_added - a.times_added
          || (b.last_added_at ?? '').localeCompare(a.last_added_at ?? ''),
        )
        .slice(0, limit);

      // Resolve store names for the matched store ids (which may belong to any
      // list), and map them to a store on the current list so the returned
      // store_id is valid to pass straight into items_add (stores are per-list).
      const storeNameById = new Map<string, string>();
      const matchedStoreIds = [...new Set(ranked.map((i) => i.store_id).filter((id): id is string => id !== null))];
      for (const ids of chunk(matchedStoreIds, 200)) {
        const { data, error } = await supabase.from('stores').select('id, name').in('id', ids);
        if (error) return errorResult(error.message);
        for (const store of data) storeNameById.set(store.id, store.name);
      }
      const currentListStoreByName = new Map<string, string>();
      if (list_id) {
        const { data, error } = await supabase.from('stores').select('id, name').eq('list_id', list_id);
        if (error) return errorResult(error.message);
        for (const store of data) currentListStoreByName.set(store.name.trim().toLowerCase(), store.id);
      }

      const matches = ranked.map((item) => {
        const storeName = item.store_id ? storeNameById.get(item.store_id) ?? null : null;
        const storeIdForList = storeName
          ? currentListStoreByName.get(storeName.trim().toLowerCase()) ?? null
          : null;
        return {
          name: item.name,
          category: item.category,
          store_id: storeIdForList,
          store_name: storeName,
          store_needs_creating: storeName !== null && storeIdForList === null,
          unit: item.unit,
          quantity: item.quantity,
          note: item.note,
          price: item.price,
          times_added: item.times_added,
          last_added_at: item.last_added_at,
          in_current_list: item.in_current_list,
        };
      });

      return jsonResult({ query: name, match_count: matches.length, matches });
    },
  );

  server.registerTool(
    'cook_history',
    {
      annotations: READ_ONLY,
      title: 'List cook history',
      description:
        'List cooks logged in cooking mode, newest first: recipe, when it was started and finished, the notes saved, and whether the user or a collaborator cooked it. Covers recipes the user can see, so collaborators\' cooks on shared recipes are included unless mine_only is set. For totals per recipe, cook_count and last_cooked_at on recipes_list are quicker.',
      inputSchema: z.object({
        recipe_id: uuid('Only cooks of this recipe.').optional(),
        from_date: dateKey('Only cooks finished on or after this date, yyyy-MM-dd (UTC).').optional(),
        to_date: dateKey('Only cooks finished on or before this date, yyyy-MM-dd (UTC).').optional(),
        include_in_progress: z.boolean().optional()
          .describe('Also return cooks started but not finished, listed first (default false).'),
        mine_only: z.boolean().optional().describe('Only cooks by the signed-in user (default false).'),
        ...paginationShape,
      }),
    },
    async ({ recipe_id, from_date, to_date, include_in_progress = false, mine_only = false, limit = DEFAULT_PAGE, offset = 0 }) => {
      let query = supabase
        .from('cook_sessions')
        .select('id, recipe_id, user_id, started_at, completed_at, notes, recipes(name)');
      if (recipe_id) query = query.eq('recipe_id', recipe_id);
      if (mine_only) query = query.eq('user_id', userId);

      const finishedFilters = [
        'completed_at.not.is.null',
        ...(from_date ? [`completed_at.gte.${from_date}T00:00:00Z`] : []),
        ...(to_date ? [`completed_at.lt.${nextDay(to_date)}T00:00:00Z`] : []),
      ];
      // Date bounds apply to finished cooks only; in-progress ones have no
      // finish date, so they're OR'd in rather than filtered out.
      query = include_in_progress
        ? query.or(`completed_at.is.null,and(${finishedFilters.join(',')})`)
        : query.or(`and(${finishedFilters.join(',')})`);

      const { data, error } = await query
        .order('completed_at', { ascending: false, nullsFirst: true })
        .order('started_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) return errorResult(error.message);
      return jsonResult(data.map(({ recipes, user_id, ...cook }) => ({
        ...cook,
        recipe_name: recipes?.name ?? null,
        cooked_by_me: user_id === userId,
        in_progress: cook.completed_at === null,
      })));
    },
  );
}
