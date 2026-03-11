/**
 * Preference service layer for Gather.
 * Provides functions for reading/writing user sort preferences.
 */
import { supabase } from './supabase.js';

// ---------------------------------------------------------------------------
// Sort Mode Constants
// ---------------------------------------------------------------------------

export const SORT_MODES = [
  { key: 'store-category', label: 'Store & Category' },
  { key: 'category', label: 'Category' },
  { key: 'alpha', label: 'A–Z' },
  { key: 'date-added', label: 'Date Added' },
];

export const DEFAULT_SORT_MODE = 'store-category';

// ---------------------------------------------------------------------------
// User Preferences
// ---------------------------------------------------------------------------

/**
 * Fetches the user's preferences row. If no row exists, returns a default object.
 * Does NOT auto-insert a row.
 * @param {string} userId - User ID
 * @returns {Promise<{user_id: string, default_sort_mode: string}>}
 */
export const getUserPreferences = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return { user_id: userId, default_sort_mode: DEFAULT_SORT_MODE };
    }

    return data;
  } catch (error) {
    throw new Error(`Failed to fetch user preferences: userId=${userId}`, { cause: error });
  }
};

/**
 * Upserts the user's default sort mode in user_preferences.
 * Uses upsert with onConflict to handle first-time writes.
 * @param {string} userId - User ID
 * @param {string} mode - Sort mode key (e.g., 'store-category', 'alpha')
 */
export const updateDefaultSortMode = async (userId, mode) => {
  try {
    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, default_sort_mode: mode },
        { onConflict: 'user_id' }
      );

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to update default sort mode: userId=${userId}, mode=${mode}`, { cause: error });
  }
};

// ---------------------------------------------------------------------------
// List Sort Mode
// ---------------------------------------------------------------------------

/**
 * Updates the sort_mode column on a list. Pass null to clear the override.
 * @param {string} listId - List ID to update
 * @param {string|null} mode - Sort mode key, or null to clear
 */
export const updateListSortMode = async (listId, mode) => {
  try {
    const { error } = await supabase
      .from('lists')
      .update({ sort_mode: mode })
      .eq('id', listId);

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to update list sort mode: listId=${listId}, mode=${mode}`, { cause: error });
  }
};

// ---------------------------------------------------------------------------
// Sort Mode Resolution
// ---------------------------------------------------------------------------

/**
 * Pure function that resolves the effective sort mode for a list.
 * Returns list.sort_mode if set, otherwise falls back to user preference, then default.
 * @param {object} list - List object (may have sort_mode property)
 * @param {object|null} userPreferences - User preferences object (may have default_sort_mode)
 * @returns {string} The resolved sort mode key
 */
export const getEffectiveSortMode = (list, userPreferences) => {
  return list.sort_mode ?? userPreferences?.default_sort_mode ?? DEFAULT_SORT_MODE;
};
