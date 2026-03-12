/**
 * Supabase database service layer for Gather.
 * Provides CRUD operations and subscription stubs for lists, items, stores, history, and sharing.
 * Real-time subscriptions will be implemented in US-005.
 */
import { supabase } from './supabase.js';

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/**
 * Creates a new shopping list. Returns the generated ID.
 * @param {string} userId - Owner's user ID
 * @param {string} name - List name
 * @param {string|null} _ownerEmail - Owner's email (unused in Supabase schema, kept for API compat)
 * @param {string|null} emoji - Optional emoji for the list
 * @param {string} color - Hex color for the list (defaults to '#1565c0')
 * @param {string} type - List type ('grocery', 'event', 'todo', etc.) defaults to 'grocery'
 * @returns {Promise<string>} The new list's ID
 */
export const createList = async (userId, name, _ownerEmail = null, emoji = null, color = '#1565c0', type = 'grocery') => {
  try {
    const { data, error } = await supabase
      .from('lists')
      .insert({
        owner_id: userId,
        name,
        emoji: emoji ?? null,
        color,
        item_count: 0,
        type,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    throw new Error(`Failed to create list: name=${name}`, { cause: error });
  }
};

/**
 * Updates fields on a shopping list.
 * @param {string} userId - User ID (kept for API compatibility, not used in query)
 * @param {string} listId - List ID to update
 * @param {object} updates - Fields to update
 */
export const updateList = async (userId, listId, updates) => {
  try {
    // Map camelCase to snake_case
    const mapped = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.emoji !== undefined) mapped.emoji = updates.emoji;
    if (updates.itemCount !== undefined) mapped.item_count = updates.itemCount;
    if (updates.item_count !== undefined) mapped.item_count = updates.item_count;
    if (updates.color !== undefined) mapped.color = updates.color;
    if (updates.type !== undefined) mapped.type = updates.type;

    const { error } = await supabase
      .from('lists')
      .update(mapped)
      .eq('id', listId);

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to update list: listId=${listId}`, { cause: error });
  }
};

/**
 * Deletes a shopping list. Items cascade-delete via FK constraint.
 * @param {string} userId - User ID (kept for API compatibility)
 * @param {string} listId - List ID to delete
 */
export const deleteList = async (userId, listId) => {
  try {
    const { error } = await supabase
      .from('lists')
      .delete()
      .eq('id', listId);

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to delete list: listId=${listId}`, { cause: error });
  }
};

/**
 * Adjusts the item_count on a list using the RPC function.
 * NOTE: This is supplementary — database triggers auto-manage item_count on
 * insert/delete/check. Use this only for manual corrections if needed.
 * @param {string} listId - List ID
 * @param {number} amount - Amount to add (negative to subtract)
 */
export const adjustItemCount = async (listId, amount) => {
  try {
    const { error } = await supabase.rpc('increment_item_count', {
      p_list_id: listId,
      amount,
    });

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to adjust item count: listId=${listId}, amount=${amount}`, { cause: error });
  }
};

/**
 * Subscribes to all lists for a user.
 * Performs initial fetch and subscribes to real-time changes via Supabase Realtime.
 * @param {string} userId - User ID
 * @param {function} callback - Called with array of list objects
 * @returns {function} Unsubscribe function that removes the channel
 */
export const subscribeLists = (userId, callback) => {
  const fetchLists = async () => {
    try {
      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch lists:', error);
        return;
      }

      callback(
        data.map((row) => ({
          id: row.id,
          name: row.name,
          emoji: row.emoji,
          color: row.color,
          itemCount: row.item_count,
          ownerId: row.owner_id,
          createdAt: row.created_at,
          sortConfig: row.sort_config,
          type: row.type,
        }))
      );
    } catch (error) {
      console.error('Failed to fetch lists:', error);
    }
  };

  // Initial fetch
  fetchLists();

  // Subscribe to real-time changes
  const channel = supabase
    .channel(`lists-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'lists',
        filter: `owner_id=eq.${userId}`,
      },
      () => {
        fetchLists();
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[subscribeLists] Realtime subscription error:', err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/**
 * Fetches items for a list with id, name, quantity, and unit (for dedup preview).
 * @param {string} listId - List ID
 * @returns {Promise<Array<{id: string, name: string, quantity: number, unit: string}>>}
 */
export const fetchItemsForList = async (listId) => {
  const { data, error } = await supabase
    .from('items')
    .select('id, name, quantity, unit')
    .eq('list_id', listId);

  if (error) throw new Error(`Failed to fetch items for list: ${listId}`, { cause: error });
  return data;
};

/**
 * Batch updates quantities on existing items.
 * @param {Array<{id: string, quantity: number}>} updates - Items to update
 */
export const batchUpdateItemQuantities = async (updates) => {
  const promises = updates.map(({ id, quantity }) =>
    supabase.from('items').update({ quantity }).eq('id', id)
  );
  const results = await Promise.all(promises);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error('Failed to update item quantities', { cause: failed.error });
};

/**
 * Adds a single item to a list. Returns the generated ID.
 * @param {string} userId - User ID (kept for API compatibility)
 * @param {string} listId - List ID
 * @param {object} item - Item data
 * @returns {Promise<string>} The new item's ID
 */
export const addItem = async (userId, listId, item) => {
  try {
    const { data, error } = await supabase
      .from('items')
      .insert({
        list_id: listId,
        name: item.name,
        category: item.category ?? null,
        is_checked: item.isChecked ?? false,
        store_id: item.store ?? null,
        quantity: item.quantity ?? 1,
        price: item.price ?? null,
        image_url: item.imageUrl ?? null,
        unit: item.unit ?? 'each',
        rsvp_status: item.rsvpStatus ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Note: item_count is auto-updated by database trigger
    return data.id;
  } catch (error) {
    throw new Error(`Failed to add item: listId=${listId}, name=${item.name}`, { cause: error });
  }
};

/**
 * Adds multiple items to a list in a batch.
 * @param {string} userId - User ID (kept for API compatibility)
 * @param {string} listId - List ID
 * @param {Array<object>} items - Array of item data
 */
export const addItems = async (userId, listId, items) => {
  try {
    const rows = items.map((item) => ({
      list_id: listId,
      name: item.name,
      category: item.category ?? null,
      is_checked: item.isChecked ?? false,
      store_id: item.store ?? null,
      quantity: item.quantity ?? 1,
      price: item.price ?? null,
      image_url: item.imageUrl ?? null,
      unit: item.unit ?? 'each',
      rsvp_status: item.rsvpStatus ?? null,
    }));

    const { error } = await supabase.from('items').insert(rows);

    if (error) throw error;
    // Note: item_count is auto-updated by database triggers (per row)
  } catch (error) {
    throw new Error(`Failed to add items: listId=${listId}, count=${items.length}`, { cause: error });
  }
};

/**
 * Updates fields on a single item.
 * @param {string} userId - User ID (kept for API compatibility)
 * @param {string} listId - List ID (kept for API compatibility)
 * @param {string} itemId - Item ID to update
 * @param {object} updates - Fields to update
 */
export const updateItem = async (userId, listId, itemId, updates) => {
  try {
    // Map camelCase to snake_case
    const mapped = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.category !== undefined) mapped.category = updates.category;
    if (updates.isChecked !== undefined) mapped.is_checked = updates.isChecked;
    if (updates.is_checked !== undefined) mapped.is_checked = updates.is_checked;
    if (updates.store !== undefined) mapped.store_id = updates.store;
    if (updates.store_id !== undefined) mapped.store_id = updates.store_id;
    if (updates.quantity !== undefined) mapped.quantity = updates.quantity;
    if (updates.price !== undefined) mapped.price = updates.price;
    if (updates.imageUrl !== undefined) mapped.image_url = updates.imageUrl;
    if (updates.image_url !== undefined) mapped.image_url = updates.image_url;
    if (updates.unit !== undefined) mapped.unit = updates.unit;
    if (updates.rsvpStatus !== undefined) mapped.rsvp_status = updates.rsvpStatus;
    if (updates.rsvp_status !== undefined) mapped.rsvp_status = updates.rsvp_status;

    const { error } = await supabase
      .from('items')
      .update(mapped)
      .eq('id', itemId);

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to update item: itemId=${itemId}`, { cause: error });
  }
};

/**
 * Deletes a single item.
 * @param {string} userId - User ID (kept for API compatibility)
 * @param {string} listId - List ID (kept for API compatibility)
 * @param {string} itemId - Item ID to delete
 */
export const removeItem = async (userId, listId, itemId) => {
  try {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to remove item: itemId=${itemId}`, { cause: error });
  }
};

/**
 * Deletes all checked items from a list.
 * @param {string} userId - User ID (kept for API compatibility)
 * @param {string} listId - List ID (kept for API compatibility)
 * @param {Array<string>} checkedItemIds - Array of item IDs to delete
 */
export const clearCheckedItems = async (userId, listId, checkedItemIds) => {
  try {
    if (checkedItemIds.length === 0) return;

    const { error } = await supabase
      .from('items')
      .delete()
      .in('id', checkedItemIds);

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to clear checked items: listId=${listId}`, { cause: error });
  }
};

/**
 * Subscribes to all items in a list.
 * Performs initial fetch and subscribes to real-time changes via Supabase Realtime.
 * @param {string} userId - User ID (kept for API compatibility)
 * @param {string} listId - List ID
 * @param {function} callback - Called with array of item objects
 * @returns {function} Unsubscribe function that removes the channel
 */
export const subscribeItems = (userId, listId, callback) => {
  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('list_id', listId)
        .order('added_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch items:', error);
        return;
      }

      callback(
        data.map((row) => ({
          id: row.id,
          name: row.name,
          category: row.category,
          isChecked: row.is_checked,
          store: row.store_id,
          quantity: row.quantity,
          price: row.price,
          imageUrl: row.image_url,
          unit: row.unit ?? 'each',
          addedAt: row.added_at,
          rsvpStatus: row.rsvp_status,
        }))
      );
    } catch (error) {
      console.error('Failed to fetch items:', error);
    }
  };

  // Initial fetch
  fetchItems();

  // Subscribe to real-time changes
  const channel = supabase
    .channel(`items-${listId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'items',
        filter: `list_id=eq.${listId}`,
      },
      () => {
        fetchItems();
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[subscribeItems] Realtime subscription error:', err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Subscribes to items in a shared list (delegates to subscribeItems).
 * @param {string} ownerUid - Owner's user ID (kept for API compatibility)
 * @param {string} listId - List ID
 * @param {function} callback - Called with array of item objects
 * @returns {function} Unsubscribe function that removes the channel
 */
export const subscribeSharedItems = (ownerUid, listId, callback) => {
  return subscribeItems(ownerUid, listId, callback);
};

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/**
 * Adds a history entry for an item name.
 * @param {string} userId - User ID
 * @param {string} name - Item name to record
 */
export const addHistoryEntry = async (userId, name) => {
  try {
    const { error } = await supabase.from('history').insert({
      user_id: userId,
      name,
    });

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to add history entry: name=${name}`, { cause: error });
  }
};

/**
 * Adds multiple history entries in a single batch insert.
 * @param {string} userId - The authenticated user's ID
 * @param {string[]} names - Array of item names to add to history
 */
export const addHistoryEntries = async (userId, names) => {
  if (!names.length) return;
  const rows = names.map((name) => ({ user_id: userId, name }));
  const { error } = await supabase.from('history').insert(rows);
  if (error) {
    throw new Error('Failed to add history entries', { cause: error });
  }
};

/**
 * Subscribes to the user's item history.
 * Performs initial fetch and subscribes to real-time changes via Supabase Realtime.
 * @param {string} userId - User ID
 * @param {function} callback - Called with array of history objects
 * @returns {function} Unsubscribe function that removes the channel
 */
export const subscribeHistory = (userId, callback) => {
  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('history')
        .select('*')
        .eq('user_id', userId)
        .order('added_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch history:', error);
        return;
      }

      callback(
        data.map((row) => ({
          id: row.id,
          name: row.name,
          addedAt: row.added_at,
        }))
      );
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  // Initial fetch
  fetchHistory();

  // Subscribe to real-time changes
  const channel = supabase
    .channel(`history-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'history',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        fetchHistory();
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[subscribeHistory] Realtime subscription error:', err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

/**
 * Shares a list with another user by email.
 * @param {string} ownerUid - Owner's user ID
 * @param {string} listId - List ID to share
 * @param {string} listName - List name (unused in Supabase, kept for API compat)
 * @param {string} email - Email of the user to share with
 */
export const shareList = async (ownerUid, listId, listName, email) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const { error } = await supabase.from('list_shares').insert({
      list_id: listId,
      shared_with_email: normalizedEmail,
    });

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to share list: listId=${listId}, email=${email}`, { cause: error });
  }
};

/**
 * Removes sharing for a given email from a list.
 * @param {string} ownerUid - Owner's user ID (kept for API compatibility)
 * @param {string} listId - List ID
 * @param {string} email - Email to unshare with
 */
export const unshareList = async (ownerUid, listId, email) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const { error } = await supabase
      .from('list_shares')
      .delete()
      .eq('list_id', listId)
      .eq('shared_with_email', normalizedEmail);

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to unshare list: listId=${listId}, email=${email}`, { cause: error });
  }
};

/**
 * Subscribes to shared list references for a user (by email).
 * Returns refs for lists that others have shared with this user.
 * Performs initial fetch and subscribes to real-time changes via Supabase Realtime.
 * @param {string} email - User's email
 * @param {function} callback - Called with array of shared list ref objects
 * @returns {function} Unsubscribe function that removes the channel
 */
export const subscribeSharedListRefs = (email, callback) => {
  if (!email) {
    callback([]);
    return () => {};
  }

  const normalizedEmail = email.toLowerCase().trim();

  const fetchSharedRefs = async () => {
    try {
      const { data: shares, error: sharesError } = await supabase
        .from('list_shares')
        .select('id, list_id, added_at')
        .eq('shared_with_email', normalizedEmail);

      if (sharesError) {
        console.error('Failed to fetch shared list refs:', sharesError);
        return;
      }

      if (shares.length === 0) {
        callback([]);
        return;
      }

      // Fetch the parent lists to get name and owner info
      const listIds = shares.map((s) => s.list_id);
      const { data: lists, error: listsError } = await supabase
        .from('lists')
        .select('id, name, owner_id')
        .in('id', listIds);

      if (listsError) {
        console.error('Failed to fetch shared lists:', listsError);
        return;
      }

      const listMap = {};
      for (const list of lists) {
        listMap[list.id] = list;
      }

      const refs = shares
        .filter((s) => listMap[s.list_id])
        .map((s) => {
          const list = listMap[s.list_id];
          return {
            id: s.id,
            listId: s.list_id,
            listName: list.name,
            ownerUid: list.owner_id,
            addedAt: s.added_at,
          };
        });

      callback(refs);
    } catch (error) {
      console.error('Failed to fetch shared list refs:', error);
    }
  };

  // Initial fetch
  fetchSharedRefs();

  // Subscribe to real-time changes
  const channel = supabase
    .channel(`shared-refs-${normalizedEmail}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'list_shares',
        filter: `shared_with_email=eq.${normalizedEmail}`,
      },
      () => {
        fetchSharedRefs();
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[subscribeSharedListRefs] Realtime subscription error:', err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Subscribes to a single list document.
 * Performs initial fetch and subscribes to real-time changes via Supabase Realtime.
 * @param {string} ownerUid - Owner's user ID (kept for API compatibility)
 * @param {string} listId - List ID
 * @param {function} callback - Called with list object or null
 * @returns {function} Unsubscribe function that removes the channel
 */
export const subscribeList = (ownerUid, listId, callback) => {
  const fetchList = async () => {
    try {
      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .eq('id', listId)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch list:', error);
        return;
      }

      if (!data) {
        callback(null);
        return;
      }

      callback({
        id: data.id,
        name: data.name,
        emoji: data.emoji,
        color: data.color,
        itemCount: data.item_count,
        ownerId: data.owner_id,
        createdAt: data.created_at,
        sortConfig: data.sort_config,
        type: data.type,
      });
    } catch (error) {
      console.error('Failed to fetch list:', error);
    }
  };

  // Initial fetch
  fetchList();

  // Subscribe to real-time changes
  const channel = supabase
    .channel(`list-${listId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'lists',
        filter: `id=eq.${listId}`,
      },
      () => {
        fetchList();
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'lists',
        filter: `id=eq.${listId}`,
      },
      () => {
        callback(null);
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[subscribeList] Realtime subscription error:', err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

/**
 * Creates a new store. Returns the generated ID.
 * @param {string} userId - User ID
 * @param {object} store - Store data
 * @returns {Promise<string>} The new store's ID
 */
export const createStore = async (userId, store) => {
  try {
    const { data, error } = await supabase
      .from('stores')
      .insert({
        user_id: userId,
        name: store.name,
        color: store.color ?? null,
        categories: store.categories ?? [],
        sort_order: store.order ?? 0,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    throw new Error(`Failed to create store: name=${store.name}`, { cause: error });
  }
};

/**
 * Updates a store.
 * @param {string} userId - User ID (kept for API compatibility)
 * @param {string} storeId - Store ID to update
 * @param {object} updates - Fields to update
 */
export const updateStore = async (userId, storeId, updates) => {
  try {
    // Map camelCase to snake_case
    const mapped = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.color !== undefined) mapped.color = updates.color;
    if (updates.categories !== undefined) mapped.categories = updates.categories;
    if (updates.order !== undefined) mapped.sort_order = updates.order;
    if (updates.sort_order !== undefined) mapped.sort_order = updates.sort_order;

    const { error } = await supabase
      .from('stores')
      .update(mapped)
      .eq('id', storeId);

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to update store: storeId=${storeId}`, { cause: error });
  }
};

/**
 * Deletes a store.
 * @param {string} userId - User ID (kept for API compatibility)
 * @param {string} storeId - Store ID to delete
 */
export const deleteStore = async (userId, storeId) => {
  try {
    const { error } = await supabase
      .from('stores')
      .delete()
      .eq('id', storeId);

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to delete store: storeId=${storeId}`, { cause: error });
  }
};

/**
 * Saves the full ordered array of stores (for reordering).
 * Uses a single upsert for efficiency.
 * @param {string} userId - User ID
 * @param {Array<object>} stores - Array of store objects with id
 */
export const saveStoreOrder = async (userId, stores) => {
  const updates = stores.map((store, i) => ({
    id: store.id,
    user_id: userId,
    name: store.name,
    color: store.color,
    categories: store.categories ?? [],
    sort_order: i,
  }));

  const { error } = await supabase
    .from('stores')
    .upsert(updates, { onConflict: 'id' });

  if (error) {
    throw new Error('Failed to save store order', { cause: error });
  }
};

/**
 * Subscribes to stores.
 * Performs initial fetch and subscribes to real-time changes via Supabase Realtime.
 * @param {string} userId - User ID
 * @param {function} callback - Called with array of store objects
 * @returns {function} Unsubscribe function that removes the channel
 */
export const subscribeStores = (userId, callback) => {
  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Failed to fetch stores:', error);
        return;
      }

      callback(
        data.map((row) => ({
          id: row.id,
          name: row.name,
          color: row.color,
          categories: row.categories,
          order: row.sort_order,
          createdAt: row.created_at,
        }))
      );
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    }
  };

  // Initial fetch
  fetchStores();

  // Subscribe to real-time changes
  const channel = supabase
    .channel(`stores-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'stores',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        fetchStores();
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[subscribeStores] Realtime subscription error:', err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Fetches stores by an array of IDs. Used to load shared-list owner stores
 * that the RLS policy now permits reading.
 * @param {string[]} storeIds - Array of store UUIDs to fetch
 * @returns {Promise<Array>} Array of store objects (same shape as subscribeStores callback)
 */
export const fetchStoresByIds = async (storeIds) => {
  if (!storeIds.length) return [];
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .in('id', storeIds)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch stores by IDs:', error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    categories: row.categories,
    order: row.sort_order,
    createdAt: row.created_at,
    _isShared: true,
  }));
};

/**
 * Subscribes to realtime changes on a set of shared stores by ID.
 * Performs initial fetch and listens for changes on the owner's stores.
 * @param {string} ownerUid - The store owner's user ID (for the realtime filter)
 * @param {string[]} storeIds - Array of store UUIDs to fetch
 * @param {function} callback - Called with array of store objects on each update
 * @returns {function} Unsubscribe function
 */
export const subscribeSharedStores = (ownerUid, storeIds, callback) => {
  if (!storeIds.length) {
    callback([]);
    return () => {};
  }

  const fetchShared = async () => {
    const result = await fetchStoresByIds(storeIds);
    callback(result);
  };

  fetchShared();

  const channel = supabase
    .channel(`shared-stores-${ownerUid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'stores',
        filter: `user_id=eq.${ownerUid}`,
      },
      () => {
        fetchShared();
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[subscribeSharedStores] Realtime subscription error:', err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};
