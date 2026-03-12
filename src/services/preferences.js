/**
 * Preference service layer for Gather.
 * Provides functions for reading/writing user sort preferences (v2 pipeline).
 */
import { supabase } from './supabase.js';
import { SYSTEM_DEFAULT_SORT_CONFIG, isValidSortConfig, getDefaultSortConfig } from '../utils/sortPipeline.js';

export { SYSTEM_DEFAULT_SORT_CONFIG };

// ---------------------------------------------------------------------------
// V1 Compatibility (for UI components not yet migrated to v2 pipeline)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use SYSTEM_DEFAULT_SORT_CONFIG and config arrays instead.
 * Retained for backward compatibility with SortPicker and MobileSettings.
 */
export const SORT_MODES = [
  { key: 'store-category', label: 'Store & Category', config: ['store', 'category', 'name'] },
  { key: 'category', label: 'Category', config: ['category', 'name'] },
  { key: 'alpha', label: 'A–Z', config: ['name'] },
  { key: 'date-added', label: 'Date Added', config: ['date'] },
];

/** @deprecated Use SYSTEM_DEFAULT_SORT_CONFIG instead */
export const DEFAULT_SORT_MODE = 'store-category';

/**
 * Converts a v1 mode key to v2 config array.
 * @param {string} modeKey - v1 mode key (e.g., 'store-category')
 * @returns {string[]} v2 config array
 */
export const modeKeyToConfig = (modeKey) => {
  const mode = SORT_MODES.find((m) => m.key === modeKey);
  return mode?.config ?? SYSTEM_DEFAULT_SORT_CONFIG;
};

/**
 * Converts a v2 config array to v1 mode key (best match).
 * @param {string[]} config - v2 config array
 * @returns {string} v1 mode key
 */
export const configToModeKey = (config) => {
  if (!Array.isArray(config)) return DEFAULT_SORT_MODE;
  const configStr = config.join(',');
  const mode = SORT_MODES.find((m) => m.config.join(',') === configStr);
  return mode?.key ?? DEFAULT_SORT_MODE;
};

// ---------------------------------------------------------------------------
// User Preferences
// ---------------------------------------------------------------------------

/**
 * Fetches the user's preferences row. If no row exists, returns a default object.
 * Does NOT auto-insert a row.
 * @param {string} userId - User ID
 * @returns {Promise<{user_id: string, default_sort_config: string[]}>}
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
      return { user_id: userId, default_sort_config: SYSTEM_DEFAULT_SORT_CONFIG };
    }

    return data;
  } catch (error) {
    throw new Error(`Failed to fetch user preferences: userId=${userId}`, { cause: error });
  }
};

/**
 * Upserts the user's default sort config in user_preferences.
 * Validates config before writing.
 * @param {string} userId - User ID
 * @param {string[]} config - Sort config array (e.g., ['store', 'category', 'name'])
 */
export const updateDefaultSortConfig = async (userId, config) => {
  if (!isValidSortConfig(config)) {
    throw new Error(`Invalid sort config: ${JSON.stringify(config)}`);
  }

  try {
    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, default_sort_config: config },
        { onConflict: 'user_id' }
      );

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to update default sort config: userId=${userId}`, { cause: error });
  }
};

// ---------------------------------------------------------------------------
// List Sort Config
// ---------------------------------------------------------------------------

/**
 * Updates the sort_config column on a list. Pass null to clear the override.
 * @param {string} listId - List ID to update
 * @param {string[]|null} config - Sort config array, or null to clear
 */
export const updateListSortConfig = async (listId, config) => {
  if (config !== null && !isValidSortConfig(config)) {
    throw new Error(`Invalid sort config: ${JSON.stringify(config)}`);
  }

  try {
    const { error } = await supabase
      .from('lists')
      .update({ sort_config: config })
      .eq('id', listId);

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to update list sort config: listId=${listId}`, { cause: error });
  }
};

// ---------------------------------------------------------------------------
// Sort Config Resolution
// ---------------------------------------------------------------------------

/**
 * Pure function that resolves the effective sort config for a list.
 * Returns list.sort_config if set, otherwise falls back to user preference, then type default.
 * @param {object} list - List object (may have sort_config property, snake_case)
 * @param {object|null} userPreferences - User preferences object (may have default_sort_config)
 * @param {string} listType - List type identifier
 * @returns {string[]} The resolved sort config array
 */
export const getEffectiveSortConfig = (list, userPreferences, listType) => {
  return list.sort_config ?? userPreferences?.default_sort_config ?? getDefaultSortConfig(listType);
};
