/**
 * Category resolution for MCP item writes. Reuses the web app's category
 * definitions and keyword auto-categorizer so items added through MCP land in
 * the same aisles they would if typed into the app.
 */
import { categorizeItem, getEffectiveCategories } from '../../../src/utils/categories.js';
import type { ToolContext } from './shared.ts';

export interface CategoryDef {
  key: string;
  name: string;
  color: string;
  keywords: string[];
}

/** `categories` is the list's raw jsonb column: a CategoryDef array or null. */
export interface ListForCategories {
  id: string;
  type: string;
  categories: unknown;
}

/**
 * Resolves a list's effective categories using the app's chain:
 * list.categories → the caller's user_category_defaults for the list type →
 * system defaults. Returns null for list types that don't use categories.
 */
export async function resolveEffectiveCategories(
  { supabase, userId }: ToolContext,
  list: ListForCategories,
): Promise<CategoryDef[] | null> {
  const own = list.categories as CategoryDef[] | null;
  if (own?.length) return own;
  const { data, error } = await supabase
    .from('user_category_defaults')
    .select('list_type, categories')
    .eq('user_id', userId)
    .eq('list_type', list.type)
    .maybeSingle();
  if (error) throw new Error(`Failed to load category defaults: listType=${list.type}`, { cause: error });
  const userDefaults = data ? [{ listType: data.list_type, categories: data.categories }] : [];
  return getEffectiveCategories(list, userDefaults);
}

/**
 * Picks a category key for an item: the caller's explicit choice when given,
 * otherwise the app's keyword auto-categorizer. Null for uncategorized types.
 */
export function chooseCategory(
  name: string,
  explicit: string | null | undefined,
  categories: CategoryDef[] | null,
  listType: string,
): string | null {
  if (explicit !== undefined) return explicit;
  if (!categories) return null;
  return categorizeItem(name, categories, listType);
}
