/**
 * Shopping list state management backed by Supabase.
 * Real-time listeners push data into state. Actions call Supabase directly.
 * Supports both owned lists and lists shared by other users.
 */
import { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { categorizeItem, DEFAULT_CATEGORIES } from '../utils/categories.js';
import { useAuth } from './AuthContext.jsx';
import {
  subscribeLists,
  subscribeItems,
  subscribeHistory,
  subscribeStores,
  subscribeSharedListRefs,
  subscribeList,
  subscribeSharedItems,
  createList as dbCreateList,
  updateList as dbUpdateList,
  deleteList as dbDeleteList,
  addItem as dbAddItem,
  addItems as dbAddItems,
  updateItem as dbUpdateItem,
  removeItem as dbRemoveItem,
  clearCheckedItems,
  addHistoryEntry,
  addHistoryEntries,
  createStore as dbCreateStore,
  updateStore as dbUpdateStore,
  deleteStore as dbDeleteStore,
  saveStoreOrder,
  shareList as dbShareList,
  unshareList as dbUnshareList,
  subscribeSharedStores,
} from '../services/database.js';
import { updateLastListId, getUserPreferences } from '../services/preferences.js';

const LAST_LIST_ID_KEY = 'gather_last_list_id';

/** Capitalizes the first letter of a string. */
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

export const ShoppingListContext = createContext(null);

/**
 * Provides shopping list state and actions to the component tree.
 * Subscribes to Supabase Realtime listeners scoped to the current user,
 * plus shared list references from other users.
 */
export const ShoppingListProvider = ({ children }) => {
  const { user } = useAuth();
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
  const [history, setHistory] = useState([]);
  const [stores, setStores] = useState([]);
  const [sharedStores, setSharedStores] = useState([]);

  // Track whether we've auto-selected a list on initial load
  const hasAutoSelected = useRef(false);
  // Track whether we've loaded and validated preferences from server
  const hasValidatedFromServer = useRef(false);
  // Track if owned lists have loaded at least once
  const hasLoadedOwnedLists = useRef(false);

  // Subscribe to owned lists
  useEffect(() => {
    if (!userId) {
      setLists([]);
      setActiveListId(null);
      hasAutoSelected.current = false;
      hasValidatedFromServer.current = false;
      hasLoadedOwnedLists.current = false;
      return;
    }
    return subscribeLists(userId, (newLists) => {
      setLists(newLists);
      hasLoadedOwnedLists.current = true;
    });
  }, [userId]);

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

  // Subscribe to shared list refs (lists others shared with me)
  useEffect(() => {
    if (!userEmail) {
      setSharedListRefs([]);
      setSharedListMetas({});
      return;
    }
    return subscribeSharedListRefs(userEmail, setSharedListRefs);
  }, [userEmail]);

  // Subscribe to metadata for each shared list
  useEffect(() => {
    const unsubs = {};

    for (const ref of sharedListRefs) {
      const key = `${ref.ownerUid}_${ref.listId}`;
      unsubs[key] = subscribeList(ref.ownerUid, ref.listId, (listData) => {
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
          // List was deleted by owner
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
  }, [sharedListRefs]);

  // Build merged list of owned + shared lists
  const allLists = [
    ...lists.map((l) => ({ ...l, _ownerUid: userId, _isShared: false })),
    ...Object.values(sharedListMetas),
  ];

  // Validate and auto-select list once owned lists have loaded
  useEffect(() => {
    if (!hasLoadedOwnedLists.current || hasAutoSelected.current) return;
    if (lists.length === 0 && Object.keys(sharedListMetas).length === 0) return;

    const cachedListId = activeListId;
    if (cachedListId) {
      // Validate the cached ID exists in all available lists
      const isValid = allLists.some((l) => l.id === cachedListId);
      if (isValid) {
        // Cached list is valid, keep it selected
        hasAutoSelected.current = true;
      } else {
        // Cached list doesn't exist (deleted/unshared) — show list browser
        setActiveListId(null);
        hasAutoSelected.current = true;
      }
    } else if (allLists.length > 0) {
      // No cached list ID — fall back to first list
      setActiveListId(allLists[0].id);
      hasAutoSelected.current = true;
    }
  }, [lists, sharedListMetas, activeListId, allLists]);

  // Determine the owner UID for the active list (needed for cross-user item access)
  const activeListEntry = allLists.find((l) => l.id === activeListId) ?? null;
  const activeListOwnerUid = activeListEntry?._ownerUid ?? userId;
  const isActiveListShared = activeListEntry?._isShared ?? false;

  // Subscribe to items of the active list (using the owner's UID for path)
  useEffect(() => {
    if (!activeListId || !activeListOwnerUid) {
      setActiveItems([]);
      return;
    }
    if (isActiveListShared) {
      return subscribeSharedItems(activeListOwnerUid, activeListId, setActiveItems);
    }
    return subscribeItems(userId, activeListId, setActiveItems);
  }, [userId, activeListId, activeListOwnerUid, isActiveListShared]);

  // Subscribe to history
  useEffect(() => {
    if (!userId) {
      setHistory([]);
      return;
    }
    return subscribeHistory(userId, setHistory);
  }, [userId]);

  // Subscribe to stores
  useEffect(() => {
    if (!userId) {
      setStores([]);
      return;
    }
    return subscribeStores(userId, setStores);
  }, [userId]);

  // Subscribe to shared stores when viewing a shared list
  useEffect(() => {
    if (!isActiveListShared || !activeListOwnerUid || activeItems.length === 0) {
      setSharedStores([]);
      return;
    }

    const missingStoreIds = [
      ...new Set(
        activeItems
          .map((item) => item.storeId)
          .filter((id) => id && !stores.some((s) => s.id === id))
      ),
    ];

    if (missingStoreIds.length === 0) {
      setSharedStores([]);
      return;
    }

    return subscribeSharedStores(activeListOwnerUid, missingStoreIds, setSharedStores);
  }, [isActiveListShared, activeListOwnerUid, activeItems, stores]);

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

  const allStores = useMemo(() => {
    if (!isActiveListShared) return stores;
    return [...stores, ...sharedStores.filter((ss) => !stores.some((s) => s.id === ss.id))];
  }, [isActiveListShared, stores, sharedStores]);

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Returns the categories array for a given store, or DEFAULT_CATEGORIES
   * if no store is specified or the store is not found.
   */
  const getCategoriesForStore = useCallback((storeId) => {
    if (!storeId) return DEFAULT_CATEGORIES;
    const store = allStores.find((s) => s.id === storeId);
    return store?.categories ?? DEFAULT_CATEGORIES;
  }, [allStores]);

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

  const createListAction = useCallback(async (name, emoji = null, color = '#1565c0', type = 'grocery') => {
    if (!userId) return;
    const newId = await dbCreateList(userId, name, userEmail, emoji, color, type);
    setLists(prev => [...prev, { id: newId, name, emoji, color, type, itemCount: 0, ownerId: userId, createdAt: new Date().toISOString() }]);
    setActiveListId(newId);
  }, [userId, userEmail]);

  const deleteListAction = useCallback(async (id) => {
    if (!userId) return;
    const ownerUid = getListOwnerUid(id);
    // Only owners can delete lists
    if (ownerUid !== userId) return;
    await dbDeleteList(userId, id);
    if (activeListId === id) {
      setActiveListId((prev) => {
        const remaining = allLists.filter((l) => l.id !== id);
        return remaining[0]?.id ?? null;
      });
    }
  }, [userId, activeListId, allLists, getListOwnerUid]);

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
    const categories = getCategoriesForStore(storeId);
    const item = {
      name,
      category: categorizeItem(name, categories, listType),
      isChecked: false,
      store: storeId,
      quantity: 1,
      price: null,
      imageUrl: null,
    };
    await dbAddItem(ownerUid, listId, item);
    await addHistoryEntry(userId, name);
  }, [userId, allLists, getCategoriesForStore, getListOwnerUid]);

  const addItemsAction = useCallback(async (listId, items) => {
    if (!userId) return;
    const ownerUid = getListOwnerUid(listId);
    const listEntry = allLists.find((l) => l.id === listId);
    const listType = listEntry?.type ?? 'grocery';
    const prepared = items.map((item) => {
      const name = capitalize(item.name.trim());
      const storeId = item.store ?? null;
      const categories = getCategoriesForStore(storeId);
      return {
        name,
        category: item.category ?? categorizeItem(name, categories, listType),
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
  }, [userId, allLists, getCategoriesForStore, getListOwnerUid]);

  const toggleItemAction = useCallback(async (listId, itemId) => {
    if (!userId) return;
    const ownerUid = getListOwnerUid(listId);
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
    if (!userId) return;
    await dbCreateStore(userId, {
      name,
      color,
      categories: [],
      order: stores.length,
    });
  }, [userId, stores.length]);

  const updateStoreAction = useCallback(async (id, updates) => {
    if (!userId) return;
    await dbUpdateStore(userId, id, updates);
  }, [userId]);

  const deleteStoreAction = useCallback(async (id) => {
    if (!userId) return;
    await dbDeleteStore(userId, id);
  }, [userId]);

  const reorderStoresAction = useCallback(async (reorderedStores) => {
    if (!userId) return;
    setStores(reorderedStores); // optimistic update
    await saveStoreOrder(userId, reorderedStores);
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

  // -----------------------------------------------------------------------
  // Build the context value
  // -----------------------------------------------------------------------

  const state = {
    lists: allLists,
    activeListId,
    history,
    stores: allStores,
  };

  const actions = {
    createList: createListAction,
    renameList: renameListAction,
    updateListDetails: updateListDetailsAction,
    deleteList: deleteListAction,
    selectList: selectListAction,
    addItem: addItemAction,
    addItems: addItemsAction,
    toggleItem: toggleItemAction,
    removeItem: removeItemAction,
    updateItem: updateItemAction,
    clearChecked: clearCheckedAction,
    restoreItem: restoreItemAction,
    restoreItems: restoreItemsAction,
    addStore: addStoreAction,
    updateStore: updateStoreAction,
    deleteStore: deleteStoreAction,
    reorderStores: reorderStoresAction,
    shareList: shareListAction,
    unshareList: unshareListAction,
  };

  const activeListMeta = allLists.find((l) => l.id === activeListId) ?? null;
  const activeList = activeListMeta
    ? { ...activeListMeta, items: activeItems }
    : null;

  return (
    <ShoppingListContext.Provider value={{ state, actions, activeList }}>
      {children}
    </ShoppingListContext.Provider>
  );
};
