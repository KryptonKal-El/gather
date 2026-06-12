/**
 * Shopping list state management backed by Supabase.
 * Real-time listeners push data into state. Actions call Supabase directly.
 * Supports both owned lists and lists shared by other users.
 */
import { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { categorizeItem, getEffectiveCategories, getSystemDefaultCategories } from '../utils/categories.js';
import { LIST_TYPES } from '../utils/listTypes.js';
import { useAuth } from './AuthContext.jsx';
import {
  subscribeLists,
  subscribeItems,
  subscribeHistory,
  subscribeStores,
  subscribeSharedListRefs,
  subscribeList,
  subscribeSharedItems,
  subscribeUserCategoryDefaults,
  createList as dbCreateList,
  updateList as dbUpdateList,
  deleteList as dbDeleteList,
  duplicateList as dbDuplicateList,
  addItem as dbAddItem,
  addItems as dbAddItems,
  updateItem as dbUpdateItem,
  removeItem as dbRemoveItem,
  clearCheckedItems,
  resetGuestListRsvp,
  addHistoryEntry,
  addHistoryEntries,
  createStore as dbCreateStore,
  updateStore as dbUpdateStore,
  deleteStore as dbDeleteStore,
  saveStoreOrder,
  fetchUserStoreDefaults,
  createUserStoreDefault as dbCreateUserStoreDefault,
  updateUserStoreDefault as dbUpdateUserStoreDefault,
  deleteUserStoreDefault as dbDeleteUserStoreDefault,
  saveUserStoreDefaultOrder,
  shareList as dbShareList,
  unshareList as dbUnshareList,
  upsertUserCategoryDefault,
  fetchListCollaborators,
} from '../services/database.js';
import { updateLastListId, updateListOrder, getUserPreferences } from '../services/preferences.js';
import { supabase } from '../services/supabase.js';

const LAST_LIST_ID_KEY = 'gather_last_list_id';

/** Capitalizes the first letter of a string. */
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

export const ShoppingListContext = createContext(null); // eslint-disable-line react-refresh/only-export-components

/**
 * Provides shopping list state and actions to the component tree.
 * Subscribes to Supabase Realtime listeners scoped to the current user,
 * plus shared list references from other users.
 */
export const ShoppingListProvider = ({ children }) => {
  const { user, sessionVersion } = useAuth();
  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

  const [lists, setLists] = useState([]);
  const [sharedListRefs, setSharedListRefs] = useState([]);
  const [sharedListMetas, setSharedListMetas] = useState({});
  const [activeListId, setActiveListId] = useState(() => {
    // Read from localStorage for instant startup (before Supabase call)
    try {
      return localStorage.getItem(LAST_LIST_ID_KEY);
    } catch {
      return null;
    }
  });
  const [activeItems, setActiveItems] = useState([]);
  const [activeItemsLoading, setActiveItemsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [stores, setStores] = useState([]);
  const [userCategoryDefaults, setUserCategoryDefaults] = useState([]);
  const [userStoreDefaults, setUserStoreDefaults] = useState([]);
  const [listOrderVersion, setListOrderVersion] = useState(0);

  // Track whether we've auto-selected a list on initial load
  const hasAutoSelected = useRef(false);
  // Track whether we've loaded and validated preferences from server
  const hasValidatedFromServer = useRef(false);
  // Track if owned lists have loaded at least once
  const hasLoadedOwnedLists = useRef(false);
  // Track if shared lists have loaded at least once
  const hasLoadedSharedLists = useRef(false);
  // Track if user was previously signed in (to distinguish initial mount from sign-out)
  const wasPreviouslySignedIn = useRef(false);
  // Debounce timer for syncing list order to Supabase
  const listOrderDebounceRef = useRef(null);

  // Subscribe to owned lists
  // Re-subscribes when sessionVersion changes (token refresh after long idle)
  useEffect(() => {
    if (!userId) {
      setLists([]);
      if (wasPreviouslySignedIn.current) {
        setActiveListId(null);
      }
      hasAutoSelected.current = false;
      hasValidatedFromServer.current = false;
      hasLoadedOwnedLists.current = false;
      hasLoadedSharedLists.current = false;
      return;
    }
    wasPreviouslySignedIn.current = true;
    return subscribeLists(userId, (newLists) => {
      setLists(newLists);
      hasLoadedOwnedLists.current = true;
    });
  }, [userId, sessionVersion]);

  // Load preferences from Supabase and sync localStorage (server wins)
  useEffect(() => {
    if (!userId || hasValidatedFromServer.current) return;

    const loadServerPreferences = async () => {
      try {
        const prefs = await getUserPreferences(userId);
        const serverListId = prefs.last_list_id;

        if (serverListId) {
          // Update localStorage with server value (server wins)
          try {
            localStorage.setItem(LAST_LIST_ID_KEY, serverListId);
          } catch {
            // Ignore localStorage errors
          }

          // If we haven't auto-selected yet, use server value as activeListId
          // (validation will happen in the allLists effect below)
          if (!hasAutoSelected.current) {
            setActiveListId(serverListId);
          }
        }
        hasValidatedFromServer.current = true;
      } catch {
        // Silent failure — preference loading is non-critical
        hasValidatedFromServer.current = true;
      }
    };

    loadServerPreferences();
  }, [userId]);

  // Subscribe to realtime changes on user_preferences (for cross-device sync)
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`last-list-sync-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_preferences',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newLastListId = payload.new?.last_list_id ?? null;
          // Update localStorage cache for next app launch (do NOT change activeListId mid-session)
          try {
            if (newLastListId) {
              localStorage.setItem(LAST_LIST_ID_KEY, newLastListId);
            } else {
              localStorage.removeItem(LAST_LIST_ID_KEY);
            }
          } catch {
            // Ignore localStorage errors
          }
          
          // Sync list_order from other devices
          const incomingListOrder = payload.new?.list_order;
          if (incomingListOrder && Array.isArray(incomingListOrder)) {
            localStorage.setItem('gather_list_order', JSON.stringify(incomingListOrder));
            setListOrderVersion(v => v + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Subscribe to shared list refs (lists others shared with me)
  // Re-subscribes when sessionVersion changes (token refresh after long idle)
  useEffect(() => {
    if (!userEmail) {
      setSharedListRefs([]);
      setSharedListMetas({});
      return;
    }
    return subscribeSharedListRefs(userEmail, (refs) => {
      setSharedListRefs(refs);
      if (refs.length === 0) {
        hasLoadedSharedLists.current = true;
      }
    });
  }, [userEmail, sessionVersion]);

  // Subscribe to metadata for each shared list
  // Re-subscribes when sessionVersion changes (token refresh after long idle)
  useEffect(() => {
    if (sharedListRefs.length === 0) {
      return;
    }

    const unsubs = {};
    let loadedCount = 0;
    const totalCount = sharedListRefs.length;

    for (const ref of sharedListRefs) {
      const key = `${ref.ownerUid}_${ref.listId}`;
      unsubs[key] = subscribeList(ref.ownerUid, ref.listId, (listData) => {
        loadedCount++;
        if (loadedCount >= totalCount) {
          hasLoadedSharedLists.current = true;
        }

        if (listData) {
          setSharedListMetas((prev) => ({
            ...prev,
            [key]: {
              ...listData,
              _ownerUid: ref.ownerUid,
              _isShared: true,
              shareSortConfig: ref.shareSortConfig ?? null,
            },
          }));
        } else {
          // List was deleted by owner or auth error (fail-closed)
          setSharedListMetas((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
      });
    }

    return () => {
      for (const unsub of Object.values(unsubs)) {
        unsub();
      }
      setSharedListMetas({});
    };
  }, [sharedListRefs, sessionVersion]);

  // Fetch collaborators for all lists
  const [collaboratorsByListId, setCollaboratorsByListId] = useState({});

  useEffect(() => {
    if (!userId) return;

    const ownedIds = lists.map((l) => l.id);
    const sharedIds = Object.values(sharedListMetas).map((l) => l.id);
    const allIds = [...new Set([...ownedIds, ...sharedIds])];

    if (allIds.length === 0) return;

    let cancelled = false;

    const fetchAll = async () => {
      const results = {};
      await Promise.all(
        allIds.map(async (listId) => {
          try {
            const collabs = await fetchListCollaborators(listId);
            results[listId] = collabs;
          } catch (err) {
            console.error(`Failed to fetch collaborators for list ${listId}:`, err.message);
            results[listId] = [];
          }
        })
      );
      if (!cancelled) setCollaboratorsByListId(results);
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [userId, lists, sharedListMetas]);

  // Build merged list of owned + shared lists, sorted by cached localStorage order
  const allLists = useMemo(() => {
    const unordered = [
      ...lists.map((l) => ({ ...l, _ownerUid: userId, _isShared: false, _collaborators: collaboratorsByListId[l.id] ?? [] })),
      ...Object.values(sharedListMetas).map((l) => ({ ...l, _collaborators: collaboratorsByListId[l.id] ?? [] })),
    ];

    try {
      const cached = JSON.parse(localStorage.getItem('gather_list_order') || '[]');
      if (!cached.length) return unordered;
      const orderMap = new Map(cached.map((id, i) => [id.toLowerCase(), i]));
      return [...unordered].sort((a, b) => {
        const aIdx = orderMap.has(a.id) ? orderMap.get(a.id) : Infinity;
        const bIdx = orderMap.has(b.id) ? orderMap.get(b.id) : Infinity;
        return aIdx - bIdx;
      });
    } catch {
      return unordered;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists, sharedListMetas, userId, listOrderVersion, collaboratorsByListId]);

  // Validate and auto-select list once owned and shared lists have loaded
  useEffect(() => {
    if (!hasLoadedOwnedLists.current || (userEmail && !hasLoadedSharedLists.current) || hasAutoSelected.current) return;
    if (lists.length === 0 && Object.keys(sharedListMetas).length === 0) return;

    const cachedListId = activeListId;
    if (cachedListId) {
      // Validate the cached ID exists in all available lists
      const isValid = allLists.some((l) => l.id === cachedListId);
      if (isValid) {
        // Cached list is valid, keep it selected
        hasAutoSelected.current = true;
      } else {
        // Cached list doesn't exist (deleted/unshared) — clear and show list browser
        setActiveListId(null);
        hasAutoSelected.current = true;

        // Clear invalid ID from localStorage
        try {
          localStorage.removeItem(LAST_LIST_ID_KEY);
        } catch {
          // Ignore localStorage errors
        }

        // Clear invalid ID from Supabase (so other devices also reset)
        if (userId) {
          updateLastListId(userId, null).catch(() => {
            // Silent failure — background write
          });
        }
      }
    } else if (allLists.length > 0) {
      // No cached list ID — fall back to first list
      setActiveListId(allLists[0].id);
      hasAutoSelected.current = true;
    }
  }, [lists, sharedListMetas, activeListId, allLists, userId, userEmail]);

  // Determine the owner UID for the active list (needed for cross-user item access)
  const activeListEntry = allLists.find((l) => l.id === activeListId) ?? null;
  const activeListOwnerUid = activeListEntry?._ownerUid ?? userId;
  const isActiveListShared = activeListEntry?._isShared ?? false;

  // Subscribe to items of the active list (using the owner's UID for path)
  // Re-subscribes when sessionVersion changes (token refresh after long idle)
  useEffect(() => {
    if (!activeListId || !activeListOwnerUid) {
      setActiveItems([]);
      setActiveItemsLoading(false);
      return;
    }

    // Immediately clear items and set loading (fail-closed: never show stale items)
    setActiveItems([]);
    setActiveItemsLoading(true);

    let cancelled = false;
    const safeSetItems = (items) => {
      if (!cancelled) {
        setActiveItems(items);
        setActiveItemsLoading(false);
      }
    };
    const unsub = isActiveListShared
      ? subscribeSharedItems(activeListOwnerUid, activeListId, safeSetItems)
      : subscribeItems(userId, activeListId, safeSetItems);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [userId, activeListId, activeListOwnerUid, isActiveListShared, sessionVersion]);

  // Subscribe to history
  // Re-subscribes when sessionVersion changes (token refresh after long idle)
  useEffect(() => {
    if (!userId) {
      setHistory([]);
      return;
    }
    return subscribeHistory(userId, setHistory);
  }, [userId, sessionVersion]);

  // Subscribe to stores for the active list
  // Re-subscribes when activeListId or sessionVersion changes
  useEffect(() => {
    if (!activeListId) {
      setStores([]);
      return;
    }
    return subscribeStores(activeListId, setStores);
  }, [activeListId, sessionVersion]);

  // Subscribe to user category defaults
  // Re-subscribes when sessionVersion changes (token refresh after long idle)
  useEffect(() => {
    if (!userId) {
      setUserCategoryDefaults([]);
      return;
    }
    return subscribeUserCategoryDefaults(userId, setUserCategoryDefaults);
  }, [userId, sessionVersion]);

  // Subscribe to user store defaults for all list types
  // Re-subscribes when sessionVersion changes (token refresh after long idle)
  useEffect(() => {
    if (!userId) {
      setUserStoreDefaults([]);
      return;
    }
    // Fetch store defaults for all list types
    Promise.all([
      fetchUserStoreDefaults(userId, 'grocery'),
      fetchUserStoreDefaults(userId, 'packing'),
      fetchUserStoreDefaults(userId, 'project'),
    ])
      .then(([groceryDefaults, packingDefaults, projectDefaults]) => {
        setUserStoreDefaults([...groceryDefaults, ...packingDefaults, ...projectDefaults]);
      })
      .catch(() => setUserStoreDefaults([]));
  }, [userId, sessionVersion]);

  // Debounced persistence of activeListId to user_preferences and localStorage
  const lastListIdTimeoutRef = useRef(null);
  useEffect(() => {
    if (!userId || !activeListId) return;

    // Clear any pending write
    if (lastListIdTimeoutRef.current) {
      clearTimeout(lastListIdTimeoutRef.current);
    }

    // Schedule new write after 500ms debounce
    lastListIdTimeoutRef.current = setTimeout(() => {
      // Update localStorage immediately for next startup
      try {
        localStorage.setItem(LAST_LIST_ID_KEY, activeListId);
      } catch {
        // Ignore localStorage errors
      }
      // Persist to Supabase
      updateLastListId(userId, activeListId).catch(() => {
        // Silent failure — background write, no user-facing error
      });
    }, 500);

    return () => {
      if (lastListIdTimeoutRef.current) {
        clearTimeout(lastListIdTimeoutRef.current);
      }
    };
  }, [userId, activeListId]);

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Returns seed categories for a new list based on user defaults or system defaults.
   * Returns null for list types that don't support categories.
   */
  const getSeedCategoriesForType = (type, defaults) => {
    if (['basic', 'guest_list'].includes(type)) return null;
    
    const userDefault = defaults.find(d => d.listType === type);
    if (userDefault?.categories?.length > 0) {
      return JSON.parse(JSON.stringify(userDefault.categories));
    }
    
    const systemDefaults = getSystemDefaultCategories(type);
    if (systemDefaults) {
      return JSON.parse(JSON.stringify(systemDefaults));
    }
    
    return null;
  };

  /**
   * Returns the ownerUid for a given list ID (could be the current user
   * or another user if the list is shared).
   */
  const getListOwnerUid = useCallback((listId) => {
    const entry = allLists.find((l) => l.id === listId);
    return entry?._ownerUid ?? userId;
  }, [allLists, userId]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const createListAction = useCallback(async (name, emoji = null, color = '#1565c0', type = 'grocery', customCategories = null, customStores = null) => {
    if (!userId) return;
    const newId = await dbCreateList(userId, name, userEmail, emoji, color, type);

    const categoriesToUse = customCategories ?? getSeedCategoriesForType(type, userCategoryDefaults);
    if (categoriesToUse) {
      await dbUpdateList(userId, newId, { categories: categoriesToUse });
    }

    // Seed stores if the list type supports them
    const typeConfig = LIST_TYPES[type];
    if (typeConfig?.fields?.store) {
      if (customStores) {
        for (const [index, store] of customStores.entries()) {
          await dbCreateStore(userId, newId, { name: store.name, color: store.color, sortOrder: index });
        }
      } else {
        const storeDefaults = await fetchUserStoreDefaults(userId, type);
        for (const def of storeDefaults) {
          await dbCreateStore(userId, newId, { name: def.name, color: def.color, sortOrder: def.sortOrder });
        }
      }
    }
    
    setLists(prev => [...prev, { 
      id: newId, name, emoji, color, type, 
      categories: categoriesToUse || null,
      itemCount: 0, ownerId: userId, 
      createdAt: new Date().toISOString() 
    }]);
    setActiveListId(newId);
  }, [userId, userEmail, userCategoryDefaults]);

  const deleteListAction = useCallback(async (id) => {
    if (!userId) return;
    const ownerUid = getListOwnerUid(id);
    // Only owners can delete lists
    if (ownerUid !== userId) return;
    await dbDeleteList(userId, id);
    if (activeListId === id) {
      setActiveListId((_prev) => {
        const remaining = allLists.filter((l) => l.id !== id);
        return remaining[0]?.id ?? null;
      });
    }
  }, [userId, activeListId, allLists, getListOwnerUid]);

  const duplicateListAction = useCallback(async (listId, newName, options = {}) => {
    if (!userId) return;
    const result = await dbDuplicateList(listId, newName, options);
    const newList = result.list;
    setLists(prev => [...prev, {
      id: newList.id,
      name: newList.name,
      emoji: newList.emoji,
      color: newList.color,
      type: newList.type,
      categories: newList.categories,
      itemCount: newList.itemCount,
      ownerId: userId,
      createdAt: newList.createdAt,
    }]);
    setActiveListId(newList.id);
    return result;
  }, [userId]);

  const renameListAction = useCallback(async (id, newName) => {
    if (!userId) return;
    const ownerUid = getListOwnerUid(id);
    await dbUpdateList(ownerUid, id, { name: newName });
  }, [userId, getListOwnerUid]);

  const updateListDetailsAction = useCallback(async (id, updates) => {
    if (!userId) return;
    const ownerUid = getListOwnerUid(id);
    const allowed = {};
    if (updates.name !== undefined) allowed.name = updates.name;
    if (updates.emoji !== undefined) allowed.emoji = updates.emoji;
    if (updates.color !== undefined) allowed.color = updates.color;
    if (updates.type !== undefined) allowed.type = updates.type;
    if (updates.categories !== undefined) allowed.categories = updates.categories;
    await dbUpdateList(ownerUid, id, allowed);
  }, [userId, getListOwnerUid]);

  const selectListAction = useCallback((id) => {
    setActiveListId(id);
  }, []);

  const addItemAction = useCallback(async (listId, rawName, storeId = null) => {
    if (!userId) return;
    const ownerUid = getListOwnerUid(listId);
    const name = capitalize(rawName.trim());
    const listEntry = allLists.find((l) => l.id === listId);
    const listType = listEntry?.type ?? 'grocery';
    const categories = getEffectiveCategories(listEntry, userCategoryDefaults);
    const category = categories ? categorizeItem(name, categories, listType) : null;
    const item = {
      name,
      category,
      isChecked: false,
      store: storeId,
      quantity: 1,
      price: null,
      imageUrl: null,
    };
    await dbAddItem(ownerUid, listId, item);
    await addHistoryEntry(userId, name);
  }, [userId, allLists, userCategoryDefaults, getListOwnerUid]);

  const addItemsAction = useCallback(async (listId, items) => {
    if (!userId) return;
    const ownerUid = getListOwnerUid(listId);
    const listEntry = allLists.find((l) => l.id === listId);
    const listType = listEntry?.type ?? 'grocery';
    const categories = getEffectiveCategories(listEntry, userCategoryDefaults);
    const prepared = items.map((item) => {
      const name = capitalize(item.name.trim());
      const storeId = item.store ?? null;
      return {
        name,
        category: item.category ?? (categories ? categorizeItem(name, categories, listType) : null),
        isChecked: false,
        store: storeId,
        quantity: item.quantity ?? 1,
        unit: item.unit ?? 'each',
        price: item.price ?? null,
        imageUrl: item.imageUrl ?? null,
      };
    });
    await dbAddItems(ownerUid, listId, prepared);
    const itemNames = prepared.map((item) => item.name);
    await addHistoryEntries(userId, itemNames);
  }, [userId, allLists, userCategoryDefaults, getListOwnerUid]);

  const toggleItemAction = useCallback(async (listId, itemId, explicitChecked = null) => {
    if (!userId) return;
    const ownerUid = getListOwnerUid(listId);

    if (typeof explicitChecked === 'boolean') {
      await dbUpdateItem(ownerUid, listId, itemId, { isChecked: explicitChecked });
      return;
    }

    const item = activeItems.find((i) => i.id === itemId);
    if (!item) return;
    const nowChecked = !item.isChecked;
    await dbUpdateItem(ownerUid, listId, itemId, { isChecked: nowChecked });
    // Note: item_count is auto-updated by database trigger
  }, [userId, activeItems, getListOwnerUid]);

  const removeItemAction = useCallback(async (listId, itemId) => {
    if (!userId) return;
    const ownerUid = getListOwnerUid(listId);
    await dbRemoveItem(ownerUid, listId, itemId);
    // Note: item_count is auto-updated by database trigger
  }, [userId, getListOwnerUid]);

  const updateItemAction = useCallback(async (listId, itemId, updates) => {
    if (!userId) return;
    const ownerUid = getListOwnerUid(listId);
    await dbUpdateItem(ownerUid, listId, itemId, updates);
  }, [userId, getListOwnerUid]);

  const clearCheckedAction = useCallback(async (listId) => {
    if (!userId) return;
    const ownerUid = getListOwnerUid(listId);
    const checkedIds = activeItems.filter((i) => i.isChecked).map((i) => i.id);
    if (checkedIds.length === 0) return;
    await clearCheckedItems(ownerUid, listId, checkedIds);
  }, [userId, activeItems, getListOwnerUid]);

  const resetGuestListRsvpAction = useCallback(async (listId) => {
    if (!userId || !listId) return 0;
    const ownerUid = getListOwnerUid(listId);
    if (ownerUid !== userId) return 0;
    return await resetGuestListRsvp(listId);
  }, [userId, getListOwnerUid]);

  /**
   * Restores a previously deleted item with its original data.
   * Used by undo functionality to re-insert items after swipe-delete.
   *
   * @param {string} listId - The list to restore the item into
   * @param {Object} itemData - Full item data (name, category, isChecked, store, quantity, price, imageUrl)
   * @returns {Promise<string|null>} The new item ID, or null if restore failed
   */
  const restoreItemAction = useCallback(async (listId, itemData) => {
    if (!userId) return null;
    const ownerUid = getListOwnerUid(listId);
    const newId = await dbAddItem(ownerUid, listId, {
      name: itemData.name,
      category: itemData.category ?? null,
      isChecked: itemData.isChecked ?? false,
      store: itemData.store ?? null,
      quantity: itemData.quantity ?? 1,
      price: itemData.price ?? null,
      imageUrl: itemData.imageUrl ?? null,
      rsvpStatus: itemData.rsvpStatus ?? null,
    });
    return newId;
  }, [userId, getListOwnerUid]);

  /**
   * Restores multiple previously deleted items with their original data.
   * Used by undo functionality to re-insert items after batch operations like clear-checked.
   *
   * @param {string} listId - The list to restore items into
   * @param {Array<Object>} itemsData - Array of full item data objects
   */
  const restoreItemsAction = useCallback(async (listId, itemsData) => {
    if (!userId) return;
    const ownerUid = getListOwnerUid(listId);
    await dbAddItems(ownerUid, listId, itemsData.map((itemData) => ({
      name: itemData.name,
      category: itemData.category ?? null,
      isChecked: itemData.isChecked ?? false,
      store: itemData.store ?? null,
      quantity: itemData.quantity ?? 1,
      price: itemData.price ?? null,
      imageUrl: itemData.imageUrl ?? null,
      rsvpStatus: itemData.rsvpStatus ?? null,
    })));
  }, [userId, getListOwnerUid]);

  const addStoreAction = useCallback(async (name, color) => {
    if (!userId || !activeListId) return;
    await dbCreateStore(userId, activeListId, {
      name,
      color,
      sortOrder: stores.length,
    });
  }, [userId, activeListId, stores.length]);

  const updateStoreAction = useCallback(async (id, updates) => {
    if (!userId) return;
    await dbUpdateStore(id, updates);
  }, [userId]);

  const deleteStoreAction = useCallback(async (id) => {
    if (!userId) return;
    await dbDeleteStore(id);
  }, [userId]);

  const reorderStoresAction = useCallback(async (reorderedStores) => {
    if (!userId) return;
    setStores(reorderedStores); // optimistic update
    await saveStoreOrder(reorderedStores);
  }, [userId]);

   const reorderListsAction = useCallback(async (orderedIds) => {
     // Immediate: update localStorage + trigger re-render
     localStorage.setItem('gather_list_order', JSON.stringify(orderedIds));
     setListOrderVersion((v) => v + 1);
     
     // Debounced: sync to Supabase (300ms debounce to avoid rapid writes during drag)
     if (listOrderDebounceRef.current) {
       clearTimeout(listOrderDebounceRef.current);
     }
     listOrderDebounceRef.current = setTimeout(async () => {
       if (userId) {
         try {
           await updateListOrder(userId, orderedIds);
         } catch (error) {
           console.error('Failed to sync list order to server:', error);
         }
       }
     }, 300);
   }, [userId]);

   // -----------------------------------------------------------------------
   // User store defaults actions
   // -----------------------------------------------------------------------

    const createUserStoreDefaultAction = useCallback(async (listType, name, color) => {
      if (!userId) return;
      const newId = await dbCreateUserStoreDefault(userId, listType, {
        name,
        color,
        sortOrder: (userStoreDefaults.filter(d => d.listType === listType) ?? []).length,
      });
      const newDefault = {
        id: newId,
        userId,
        listType,
        name,
        color: color ?? null,
        sortOrder: (userStoreDefaults.filter(d => d.listType === listType) ?? []).length,
        createdAt: new Date().toISOString(),
      };
      setUserStoreDefaults([...userStoreDefaults, newDefault]);
    }, [userId, userStoreDefaults]);

   const updateUserStoreDefaultAction = useCallback(async (id, updates) => {
     if (!userId) return;
     await dbUpdateUserStoreDefault(id, updates);
     setUserStoreDefaults(userStoreDefaults.map(d => (d.id === id ? { ...d, ...updates } : d)));
   }, [userId, userStoreDefaults]);

   const deleteUserStoreDefaultAction = useCallback(async (id) => {
     if (!userId) return;
     await dbDeleteUserStoreDefault(id);
     setUserStoreDefaults(userStoreDefaults.filter(d => d.id !== id));
   }, [userId, userStoreDefaults]);

    const saveStoresAsDefaultAction = useCallback(async (listType, storesToSave) => {
      if (!userId) return;
      const existing = userStoreDefaults.filter(d => d.listType === listType);
      for (const def of existing) {
        await dbDeleteUserStoreDefault(def.id);
      }
      const created = [];
      for (const [index, store] of storesToSave.entries()) {
        const newId = await dbCreateUserStoreDefault(userId, listType, {
          name: store.name,
          color: store.color,
          sortOrder: index,
        });
        created.push({
          id: newId,
          userId,
          listType,
          name: store.name,
          color: store.color ?? null,
          sortOrder: index,
          createdAt: new Date().toISOString(),
        });
      }
      setUserStoreDefaults(prev => [...prev.filter(d => d.listType !== listType), ...created]);
    }, [userId, userStoreDefaults]);

    const saveUserStoreDefaultOrderAction = useCallback(async (defaults) => {
      if (!userId) return;
      // Merge updated defaults for this list type into existing state
      const listType = defaults[0]?.listType;
      if (!listType) return;
      
      setUserStoreDefaults(prev => {
        if (defaults.length === 0) {
          // Remove all defaults for this list type
          return prev.filter(d => d.listType !== listType);
        }
        // Keep defaults from other list types, replace this list type's defaults
        const unchanged = prev.filter(d => d.listType !== listType);
        return [...unchanged, ...defaults];
      });
      
      await saveUserStoreDefaultOrder(defaults);
    }, [userId]);

   // -----------------------------------------------------------------------
   // Sharing actions
   // -----------------------------------------------------------------------

  const shareListAction = useCallback(async (listId, email, sortConfig = null) => {
    if (!userId) return;
    const ownerUid = getListOwnerUid(listId);
    // Only owners can share
    if (ownerUid !== userId) return;
    const listEntry = allLists.find((l) => l.id === listId);
    const listName = listEntry?.name ?? 'Shared List';
    await dbShareList(userId, listId, listName, email, sortConfig);
  }, [userId, allLists, getListOwnerUid]);

  const unshareListAction = useCallback(async (listId, email) => {
    if (!userId) return;
    const ownerUid = getListOwnerUid(listId);
    if (ownerUid !== userId) return;
    await dbUnshareList(userId, listId, email);
  }, [userId, getListOwnerUid]);

  const saveUserCategoryDefaultAction = useCallback(async (listType, categories) => {
    if (!userId) return;
    await upsertUserCategoryDefault(userId, listType, categories);
  }, [userId]);

  // -----------------------------------------------------------------------
  // Build the context value
  // -----------------------------------------------------------------------

  const state = {
    lists: allLists,
    activeListId,
    history,
    stores,
    userCategoryDefaults,
    userStoreDefaults,
  };

   const actions = {
     createList: createListAction,
     renameList: renameListAction,
     updateListDetails: updateListDetailsAction,
     deleteList: deleteListAction,
     duplicateList: duplicateListAction,
     selectList: selectListAction,
     addItem: addItemAction,
     addItems: addItemsAction,
     toggleItem: toggleItemAction,
     removeItem: removeItemAction,
     updateItem: updateItemAction,
     clearChecked: clearCheckedAction,
     resetGuestListRsvp: resetGuestListRsvpAction,
     restoreItem: restoreItemAction,
     restoreItems: restoreItemsAction,
     addStore: addStoreAction,
     updateStore: updateStoreAction,
     deleteStore: deleteStoreAction,
     reorderStores: reorderStoresAction,
     reorderLists: reorderListsAction,
     createUserStoreDefault: createUserStoreDefaultAction,
     updateUserStoreDefault: updateUserStoreDefaultAction,
     deleteUserStoreDefault: deleteUserStoreDefaultAction,
     saveUserStoreDefaultOrder: saveUserStoreDefaultOrderAction,
     saveStoresAsDefault: saveStoresAsDefaultAction,
     shareList: shareListAction,
     unshareList: unshareListAction,
     saveUserCategoryDefault: saveUserCategoryDefaultAction,
   };

  const activeListMeta = allLists.find((l) => l.id === activeListId) ?? null;
  const activeList = activeListMeta
    ? { ...activeListMeta, items: activeItems, isLoadingItems: activeItemsLoading }
    : null;

  return (
    <ShoppingListContext.Provider value={{ state, actions, activeList }}>
      {children}
    </ShoppingListContext.Provider>
  );
};
