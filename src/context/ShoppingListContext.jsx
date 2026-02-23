/**
 * Shopping list state management backed by Firestore.
 * Real-time listeners push data into state. Actions call Firestore directly.
 * All data is scoped to the authenticated user.
 */
import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { increment } from 'firebase/firestore';
import { categorizeItem, DEFAULT_CATEGORIES } from '../utils/categories.js';
import { useAuth } from './AuthContext.jsx';
import {
  subscribeLists,
  subscribeItems,
  subscribeHistory,
  subscribeStores,
  createList as fsCreateList,
  updateList as fsUpdateList,
  deleteList as fsDeleteList,
  addItem as fsAddItem,
  addItems as fsAddItems,
  updateItem as fsUpdateItem,
  removeItem as fsRemoveItem,
  clearCheckedItems,
  addHistoryEntry,
  createStore as fsCreateStore,
  updateStore as fsUpdateStore,
  deleteStore as fsDeleteStore,
  saveStoreOrder,
} from '../services/firestore.js';

/** Capitalizes the first letter of a string. */
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

export const ShoppingListContext = createContext(null);

/**
 * Provides shopping list state and actions to the component tree.
 * Subscribes to Firestore real-time listeners scoped to the current user.
 */
export const ShoppingListProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState(null);
  const [activeItems, setActiveItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [stores, setStores] = useState([]);

  // Track whether we've auto-selected a list on initial load
  const hasAutoSelected = useRef(false);

  // Subscribe to lists
  useEffect(() => {
    if (!userId) {
      setLists([]);
      setActiveListId(null);
      hasAutoSelected.current = false;
      return;
    }
    return subscribeLists(userId, (newLists) => {
      setLists(newLists);
      if (!hasAutoSelected.current && newLists.length > 0) {
        setActiveListId(newLists[0].id);
        hasAutoSelected.current = true;
      }
    });
  }, [userId]);

  // Subscribe to items of the active list
  useEffect(() => {
    if (!userId || !activeListId) {
      setActiveItems([]);
      return;
    }
    return subscribeItems(userId, activeListId, setActiveItems);
  }, [userId, activeListId]);

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

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Returns the categories array for a given store, or DEFAULT_CATEGORIES
   * if no store is specified or the store is not found.
   */
  const getCategoriesForStore = useCallback((storeId) => {
    if (!storeId) return DEFAULT_CATEGORIES;
    const store = stores.find((s) => s.id === storeId);
    return store?.categories ?? DEFAULT_CATEGORIES;
  }, [stores]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const createListAction = useCallback(async (name) => {
    if (!userId) return;
    const newId = await fsCreateList(userId, name);
    setActiveListId(newId);
  }, [userId]);

  const deleteListAction = useCallback(async (id) => {
    if (!userId) return;
    await fsDeleteList(userId, id);
    if (activeListId === id) {
      setActiveListId((prev) => {
        const remaining = lists.filter((l) => l.id !== id);
        return remaining[0]?.id ?? null;
      });
    }
  }, [userId, activeListId, lists]);

  const renameListAction = useCallback(async (id, newName) => {
    if (!userId) return;
    await fsUpdateList(userId, id, { name: newName });
  }, [userId]);

  const selectListAction = useCallback((id) => {
    setActiveListId(id);
  }, []);

  const addItemAction = useCallback(async (listId, rawName, storeId = null) => {
    if (!userId) return;
    const name = capitalize(rawName.trim());
    const categories = getCategoriesForStore(storeId);
    const item = {
      name,
      category: categorizeItem(name, categories),
      isChecked: false,
      store: storeId,
      quantity: 1,
      price: null,
    };
    await fsAddItem(userId, listId, item);
    await addHistoryEntry(userId, name);
  }, [userId, getCategoriesForStore]);

  const addItemsAction = useCallback(async (listId, items) => {
    if (!userId) return;
    const prepared = items.map((item) => {
      const name = capitalize(item.name.trim());
      const storeId = item.store ?? null;
      const categories = getCategoriesForStore(storeId);
      return {
        name,
        category: item.category ?? categorizeItem(name, categories),
        isChecked: false,
        store: storeId,
        quantity: item.quantity ?? 1,
        price: item.price ?? null,
      };
    });
    await fsAddItems(userId, listId, prepared);
    for (const item of prepared) {
      await addHistoryEntry(userId, item.name);
    }
  }, [userId, getCategoriesForStore]);

  const toggleItemAction = useCallback(async (listId, itemId) => {
    if (!userId) return;
    const item = activeItems.find((i) => i.id === itemId);
    if (!item) return;
    const nowChecked = !item.isChecked;
    await fsUpdateItem(userId, listId, itemId, { isChecked: nowChecked });
    await fsUpdateList(userId, listId, { itemCount: increment(nowChecked ? -1 : 1) });
  }, [userId, activeItems]);

  const removeItemAction = useCallback(async (listId, itemId) => {
    if (!userId) return;
    const item = activeItems.find((i) => i.id === itemId);
    await fsRemoveItem(userId, listId, itemId);
    if (item && !item.isChecked) {
      await fsUpdateList(userId, listId, { itemCount: increment(-1) });
    }
  }, [userId, activeItems]);

  const updateItemAction = useCallback(async (listId, itemId, updates) => {
    if (!userId) return;
    await fsUpdateItem(userId, listId, itemId, updates);
  }, [userId]);

  const clearCheckedAction = useCallback(async (listId) => {
    if (!userId) return;
    const checkedIds = activeItems.filter((i) => i.isChecked).map((i) => i.id);
    if (checkedIds.length === 0) return;
    await clearCheckedItems(userId, listId, checkedIds);
  }, [userId, activeItems]);

  const addStoreAction = useCallback(async (name, color) => {
    if (!userId) return;
    await fsCreateStore(userId, {
      name,
      color,
      categories: DEFAULT_CATEGORIES,
      order: stores.length,
    });
  }, [userId, stores.length]);

  const updateStoreAction = useCallback(async (id, updates) => {
    if (!userId) return;
    await fsUpdateStore(userId, id, updates);
  }, [userId]);

  const deleteStoreAction = useCallback(async (id) => {
    if (!userId) return;
    await fsDeleteStore(userId, id);
  }, [userId]);

  const reorderStoresAction = useCallback(async (reorderedStores) => {
    if (!userId) return;
    setStores(reorderedStores); // optimistic update
    await saveStoreOrder(userId, reorderedStores);
  }, [userId]);

  // -----------------------------------------------------------------------
  // Build the context value
  // -----------------------------------------------------------------------

  const state = {
    lists,
    activeListId,
    history,
    stores,
  };

  const actions = {
    createList: createListAction,
    renameList: renameListAction,
    deleteList: deleteListAction,
    selectList: selectListAction,
    addItem: addItemAction,
    addItems: addItemsAction,
    toggleItem: toggleItemAction,
    removeItem: removeItemAction,
    updateItem: updateItemAction,
    clearChecked: clearCheckedAction,
    addStore: addStoreAction,
    updateStore: updateStoreAction,
    deleteStore: deleteStoreAction,
    reorderStores: reorderStoresAction,
  };

  const activeListMeta = lists.find((l) => l.id === activeListId) ?? null;
  const activeList = activeListMeta
    ? { ...activeListMeta, items: activeItems }
    : null;

  return (
    <ShoppingListContext.Provider value={{ state, actions, activeList }}>
      {children}
    </ShoppingListContext.Provider>
  );
};
