/**
 * Custom hook for managing sort preferences.
 * Fetches user preferences and provides helpers for resolving effective sort config.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../services/supabase.js';
import {
  getUserPreferences,
  getEffectiveSortConfig,
  updateListSortConfig,
  updateShareSortConfig,
  updateDefaultSortConfig,
  SYSTEM_DEFAULT_SORT_CONFIG,
} from '../services/preferences.js';

/**
 * Hook that provides sort preference state and actions.
 * @returns {{
 *   userPreferences: object|null,
 *   loading: boolean,
 *   effectiveSortConfig: (list: object) => string[],
 *   updateListSort: (list: object, config: string[]|null) => Promise<void>,
 *   updateDefaultSort: (config: string[]) => Promise<void>
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

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-preferences-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_preferences',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setUserPreferences({ user_id: user.id, default_sort_config: SYSTEM_DEFAULT_SORT_CONFIG });
          } else {
            setUserPreferences(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const effectiveSortConfig = useCallback(
    (list) => {
      if (!list) return SYSTEM_DEFAULT_SORT_CONFIG;
      return getEffectiveSortConfig(
        { sort_config: list.sortConfig },
        userPreferences,
        list.type,
        list.shareSortConfig ?? null
      );
    },
    [userPreferences]
  );

  const updateListSort = useCallback(
    async (list, config) => {
      if (list._isShared) {
        await updateShareSortConfig(list.id, user?.email, config);
      } else {
        await updateListSortConfig(list.id, config);
      }
    },
    [user]
  );

  const updateDefaultSort = useCallback(
    async (config) => {
      if (!user) return;
      await updateDefaultSortConfig(user.id, config);
      setUserPreferences((prev) => prev
        ? { ...prev, default_sort_config: config }
        : { user_id: user.id, default_sort_config: config }
      );
    },
    [user]
  );

  return { userPreferences, loading, effectiveSortConfig, updateListSort, updateDefaultSort };
};
