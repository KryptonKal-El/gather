/**
 * Firestore service layer for ShoppingListAI.
 * All data is scoped under users/{userId}/ for per-user isolation.
 * Provides CRUD operations and real-time snapshot listeners.
 */
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from './firebase.js';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

const userDoc = (userId) => doc(db, 'users', userId);
const listsCol = (userId) => collection(db, 'users', userId, 'lists');
const listDoc = (userId, listId) => doc(db, 'users', userId, 'lists', listId);
const itemsCol = (userId, listId) => collection(db, 'users', userId, 'lists', listId, 'items');
const itemDoc = (userId, listId, itemId) => doc(db, 'users', userId, 'lists', listId, 'items', itemId);
const historyCol = (userId) => collection(db, 'users', userId, 'history');
const storesCol = (userId) => collection(db, 'users', userId, 'stores');
const storeDoc = (userId, storeId) => doc(db, 'users', userId, 'stores', storeId);

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/** Creates a new shopping list document. Returns the generated ID. */
export const createList = async (userId, name) => {
  const ref = await addDoc(listsCol(userId), {
    name,
    itemCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

/** Updates fields on a shopping list (e.g. rename). */
export const updateList = async (userId, listId, updates) => {
  await updateDoc(listDoc(userId, listId), updates);
};

/** Deletes a shopping list and all its items (subcollection). */
export const deleteList = async (userId, listId) => {
  // Firestore doesn't cascade-delete subcollections, so we batch-delete items first
  const batch = writeBatch(db);
  const itemsRef = itemsCol(userId, listId);
  // We subscribe briefly to get all item docs, then unsubscribe
  const snapshot = await new Promise((resolve) => {
    const unsub = onSnapshot(itemsRef, (snap) => {
      unsub();
      resolve(snap);
    });
  });
  snapshot.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(listDoc(userId, listId));
  await batch.commit();
};

/**
 * Subscribes to all lists for a user in real-time.
 * @returns {Function} Unsubscribe function
 */
export const subscribeLists = (userId, callback) => {
  const q = query(listsCol(userId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const lists = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(lists);
  });
};

// ---------------------------------------------------------------------------
// Items (subcollection of a list)
// ---------------------------------------------------------------------------

/** Adds a single item to a list. Returns the generated ID. */
export const addItem = async (userId, listId, item) => {
  const ref = await addDoc(itemsCol(userId, listId), {
    ...item,
    addedAt: serverTimestamp(),
  });
  await updateDoc(listDoc(userId, listId), { itemCount: increment(1) });
  return ref.id;
};

/** Adds multiple items to a list in a batch. */
export const addItems = async (userId, listId, items) => {
  const batch = writeBatch(db);
  for (const item of items) {
    const ref = doc(itemsCol(userId, listId));
    batch.set(ref, { ...item, addedAt: serverTimestamp() });
  }
  batch.update(listDoc(userId, listId), { itemCount: increment(items.length) });
  await batch.commit();
};

/** Updates fields on a single item. */
export const updateItem = async (userId, listId, itemId, updates) => {
  await updateDoc(itemDoc(userId, listId, itemId), updates);
};

/** Deletes a single item. */
export const removeItem = async (userId, listId, itemId) => {
  await deleteDoc(itemDoc(userId, listId, itemId));
};

/** Deletes all checked items from a list in a batch. */
export const clearCheckedItems = async (userId, listId, checkedItemIds) => {
  const batch = writeBatch(db);
  for (const id of checkedItemIds) {
    batch.delete(itemDoc(userId, listId, id));
  }
  await batch.commit();
};

/**
 * Subscribes to all items in a list in real-time.
 * @returns {Function} Unsubscribe function
 */
export const subscribeItems = (userId, listId, callback) => {
  const q = query(itemsCol(userId, listId), orderBy('addedAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(items);
  });
};

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/** Adds a history entry. */
export const addHistoryEntry = async (userId, name) => {
  await addDoc(historyCol(userId), {
    name,
    addedAt: serverTimestamp(),
  });
};

/**
 * Subscribes to the user's item history in real-time.
 * @returns {Function} Unsubscribe function
 */
export const subscribeHistory = (userId, callback) => {
  const q = query(historyCol(userId), orderBy('addedAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const history = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(history);
  });
};

// ---------------------------------------------------------------------------
// Stores (categories are embedded as a field on each store document)
// ---------------------------------------------------------------------------

/** Creates a new store. Returns the generated ID. */
export const createStore = async (userId, store) => {
  const ref = await addDoc(storesCol(userId), {
    ...store,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

/** Updates a store. */
export const updateStore = async (userId, storeId, updates) => {
  await updateDoc(storeDoc(userId, storeId), updates);
};

/** Deletes a store. */
export const deleteStore = async (userId, storeId) => {
  await deleteDoc(storeDoc(userId, storeId));
};

/** Saves the full ordered array of stores (for reordering). */
export const saveStoreOrder = async (userId, stores) => {
  const batch = writeBatch(db);
  stores.forEach((s, index) => {
    batch.update(storeDoc(userId, s.id), { order: index });
  });
  await batch.commit();
};

/**
 * Subscribes to stores in real-time.
 * @returns {Function} Unsubscribe function
 */
export const subscribeStores = (userId, callback) => {
  const q = query(storesCol(userId), orderBy('order', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const stores = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(stores);
  });
};
