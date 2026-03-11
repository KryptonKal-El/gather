/**
 * Custom hook for managing sort preferences.
 * Fetches user preferences and provides helpers for resolving effective sort mode.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getUserPreferences, getEffectiveSortMode, updateListSortMode } from '../services/preferences.js';

/**
 * Hook that provides sort preference state and actions.
 * @returns {{
 *   userPreferences: object|null,
 *   loading: boolean,
 *   effectiveSortMode: (list: object) => string,
 *   updateListSort: (listId: string, mode: string|null) => Promise<void>
 * }}
 */
export const useSortPreferences = () => {
  const { user } = useAuth();
  const [userPreferences, setUserPreferences] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUserPreferences(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const prefs = await getUserPreferences(user.id);
        if (!cancelled) setUserPreferences(prefs);
      } catch (err) {
        console.error('Failed to load sort preferences:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  const effectiveSortMode = useCallback(
    (list) => {
      if (!list) return 'store-category';
      // getEffectiveSortMode expects { sort_mode } but our list objects use camelCase sortMode
      return getEffectiveSortMode({ sort_mode: list.sortMode }, userPreferences);
    },
    [userPreferences]
  );

  const updateListSort = useCallback(
    async (listId, mode) => {
      await updateListSortMode(listId, mode);
    },
    []
  );

  return { userPreferences, loading, effectiveSortMode, updateListSort };
};
