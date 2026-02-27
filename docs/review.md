# Critic Review: Firebase to Supabase Migration (US-004 through US-006)

**PRD**: Firebase to Supabase Backend Migration  
**Stories Reviewed**: US-004 (CRUD Migration), US-005 (Real-time Subscriptions), US-006 (RLS Policies)  
**Review Date**: 2026-02-27  
**Reviewer**: Critic Agent

---

## Summary

This review covers the Supabase CRUD service layer (`database.js`), the updated `ShoppingListContext.jsx`, and the RLS policies migration. The implementation is **well-structured** with consistent patterns for snake_case ↔ camelCase transformations, proper real-time subscriptions with unique channel naming, and comprehensive RLS policies. There are **two critical issues** requiring fixes before shipping, along with several important issues that should be addressed soon.

---

## Critical Issues

### CRITICAL-1: `removeItem` does not decrement item_count atomically

**File**: `src/services/database.js` (lines 268-279)  
**Impact**: Item count becomes permanently incorrect; data integrity issue

```javascript
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
```

**Problem**: Unlike `addItem` (which calls `adjustItemCount(listId, 1)` after insert), `removeItem` does NOT decrement the item count. The context layer (`ShoppingListContext.jsx` lines 281-289) does call `adjustItemCount` but only for **unchecked** items:

```javascript
const removeItemAction = useCallback(async (listId, itemId) => {
  // ...
  await dbRemoveItem(ownerUid, listId, itemId);
  if (item && !item.isChecked) {
    await adjustItemCount(listId, -1);
  }
}, [userId, activeItems, getListOwnerUid]);
```

**Issues with this approach**:
1. If `item` is not found in `activeItems` (e.g., removed by another user in real-time), the count is not adjusted
2. The count adjustment is non-atomic — a failure between delete and adjustItemCount leaves count incorrect
3. This differs from `addItem` where the count is adjusted in the service layer, not context

**Recommendation**: Move the count adjustment into `removeItem` in database.js for consistency, OR use a database trigger for `item_count` to guarantee atomicity:

```sql
-- Better: Use a trigger for atomic count updates
CREATE OR REPLACE FUNCTION update_item_count_on_insert()
RETURNS trigger AS $$
BEGIN
  UPDATE lists SET item_count = item_count + 1 WHERE id = NEW.list_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_item_count_on_delete()
RETURNS trigger AS $$
BEGIN
  IF NOT OLD.is_checked THEN
    UPDATE lists SET item_count = item_count - 1 WHERE id = OLD.list_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER items_insert_count AFTER INSERT ON items
  FOR EACH ROW EXECUTE FUNCTION update_item_count_on_insert();

CREATE TRIGGER items_delete_count AFTER DELETE ON items
  FOR EACH ROW EXECUTE FUNCTION update_item_count_on_delete();
```

---

### CRITICAL-2: `clearCheckedItems` does not decrement item_count

**File**: `src/services/database.js` (lines 287-300)  
**Impact**: Item count permanently inflated after clearing checked items

```javascript
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
```

**Problem**: When clearing checked items, the `item_count` is never decremented. The context layer (`clearCheckedAction`) also doesn't adjust the count. Over time, `item_count` will grow indefinitely even though items are deleted.

**Note**: Actually, this might be **intentional** if `item_count` represents "unchecked items only" (since `toggleItemAction` decrements count when checking an item). However:
1. This semantic is not documented anywhere
2. It's inconsistent with `addItem` which always increments regardless of `isChecked` state
3. The initial seed value of `item_count: 0` in `createList` suggests it's total items, not unchecked

**Recommendation**: Clarify the semantic of `item_count`:
- If it means "total items": add `adjustItemCount(listId, -checkedItemIds.length)` to `clearCheckedItems`
- If it means "unchecked items only": document this clearly and audit all call sites

---

## Important Issues

### IMPORTANT-1: `saveStoreOrder` is an N+1 update (performance issue)

**File**: `src/services/database.js` (lines 758-772)  
**Impact**: Slow operation; each store reorder makes N sequential API calls

```javascript
export const saveStoreOrder = async (userId, stores) => {
  try {
    // Update each store's sort_order
    for (let i = 0; i < stores.length; i++) {
      const { error } = await supabase
        .from('stores')
        .update({ sort_order: i })
        .eq('id', stores[i].id);

      if (error) throw error;
    }
  } catch (error) {
    throw new Error('Failed to save store order', { cause: error });
  }
};
```

**Problem**: For N stores, this makes N sequential database calls. With 5-10 stores, this could take 500ms-1s. If one fails, stores are left in inconsistent order.

**Recommendation**: Use a single upsert or RPC call:

```javascript
export const saveStoreOrder = async (userId, stores) => {
  try {
    // Batch update using upsert
    const updates = stores.map((store, i) => ({
      id: store.id,
      user_id: userId,
      name: store.name,
      color: store.color,
      categories: store.categories,
      sort_order: i,
    }));

    const { error } = await supabase
      .from('stores')
      .upsert(updates, { onConflict: 'id' });

    if (error) throw error;
  } catch (error) {
    throw new Error('Failed to save store order', { cause: error });
  }
};
```

Or create an RPC function for atomic batch update.

---

### IMPORTANT-2: Real-time subscriptions re-fetch entire dataset on every change

**File**: `src/services/database.js` (all subscription functions)  
**Impact**: Unnecessary bandwidth; poor performance for large lists

```javascript
// Example from subscribeItems (line 346-359)
.on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'items',
    filter: `list_id=eq.${listId}`,
  },
  () => {
    fetchItems();  // Re-fetches ALL items on ANY change
  }
)
```

**Problem**: When one item is updated/added/deleted, the subscription callback re-fetches the entire items array. For a list with 100 items, changing one item downloads all 100 again.

**This pattern is used in all 7 subscriptions**:
- `subscribeLists` (line 152)
- `subscribeItems` (line 356)
- `subscribeHistory` (line 449)
- `subscribeSharedListRefs` (line 589)
- `subscribeList` (lines 654, 666)
- `subscribeStores` (line 824)

**Recommendation**: Use the event payload for incremental updates:

```javascript
.on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'items',
    filter: `list_id=eq.${listId}`,
  },
  (payload) => {
    if (payload.eventType === 'INSERT') {
      setItems(prev => [...prev, mapRowToCamelCase(payload.new)]);
    } else if (payload.eventType === 'UPDATE') {
      setItems(prev => prev.map(item => 
        item.id === payload.new.id ? mapRowToCamelCase(payload.new) : item
      ));
    } else if (payload.eventType === 'DELETE') {
      setItems(prev => prev.filter(item => item.id !== payload.old.id));
    }
  }
)
```

This is a significant refactor but important for lists with many items.

---

### IMPORTANT-3: `addItems` (batch) adds history entries sequentially

**File**: `src/context/ShoppingListContext.jsx` (lines 265-269)  
**Impact**: Slow operation when adding many items; N sequential API calls

```javascript
await dbAddItems(ownerUid, listId, prepared);
for (const item of prepared) {
  await addHistoryEntry(userId, item.name);
}
```

**Problem**: If adding 20 items, this makes 20 sequential `INSERT` calls for history. Could take several seconds.

**Recommendation**: Add a `addHistoryEntries` batch function to `database.js`:

```javascript
export const addHistoryEntries = async (userId, names) => {
  try {
    const rows = names.map(name => ({ user_id: userId, name }));
    const { error } = await supabase.from('history').insert(rows);
    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to add history entries: count=${names.length}`, { cause: error });
  }
};
```

Then in context:
```javascript
await dbAddItems(ownerUid, listId, prepared);
await addHistoryEntries(userId, prepared.map(item => item.name));
```

---

### IMPORTANT-4: Missing RLS policy for profile DELETE

**File**: `supabase/migrations/20260227220000_rls_policies.sql` (lines 26-33)  
**Impact**: Users cannot delete their own profiles (if feature is needed)

```sql
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- No DELETE policy
```

**Problem**: There's no DELETE policy for profiles. While the FK `ON DELETE CASCADE` from `auth.users` handles deletion when the user account is deleted, if you ever need to allow a user to delete their profile data independently, this would fail silently.

**Recommendation**: Add a DELETE policy for completeness:

```sql
CREATE POLICY "profiles_delete_own" ON profiles
  FOR DELETE USING (id = auth.uid());
```

---

### IMPORTANT-5: Stale docstring in ShoppingListContext

**File**: `src/context/ShoppingListContext.jsx` (lines 42-44)  
**Impact**: Misleading documentation

```javascript
/**
 * Provides shopping list state and actions to the component tree.
 * Subscribes to Firestore real-time listeners scoped to the current user,
 * plus shared list references from other users.
 */
```

**Problem**: Still references "Firestore" even though this is now Supabase.

**Recommendation**: Update to:
```javascript
/**
 * Provides shopping list state and actions to the component tree.
 * Subscribes to Supabase Realtime listeners scoped to the current user,
 * plus shared list references from other users.
 */
```

---

## Minor Suggestions

### SUGGESTION-1: Channel naming could include user ID for shared items

**File**: `src/services/database.js` (line 347)

```javascript
const channel = supabase
  .channel(`items-${listId}`)
```

**Context**: For `subscribeItems` and `subscribeSharedItems`, the channel is named `items-${listId}`. If the same user has the list open in multiple tabs AND is viewing a shared list in another tab with the same `listId` (unlikely but possible with UUID collision or testing), channels could conflict.

**Consider**: Include a random suffix or user ID:
```javascript
.channel(`items-${listId}-${userId || 'shared'}`)
```

---

### SUGGESTION-2: Consider optimistic updates for toggle/update operations

**File**: `src/context/ShoppingListContext.jsx`  
**Context**: `toggleItemAction` and `updateItemAction` wait for the server round-trip before the UI updates. For better UX, consider optimistic updates with rollback on failure.

---

### SUGGESTION-3: Add JSDoc @returns for subscription functions

**File**: `src/services/database.js`  
**Context**: The subscription functions have good JSDoc but the `@returns` could be more descriptive:

```javascript
/**
 * @returns {function} Unsubscribe function that removes the channel and stops listening
 */
```

---

### SUGGESTION-4: Consider adding `REPLICA IDENTITY FULL` for DELETE events

**File**: `supabase/migrations/20260227213403_initial_schema.sql`  
**Context**: By default, DELETE events in Supabase Realtime only include the primary key (`old.id`). If you want to use the payload for incremental updates (per IMPORTANT-2), you'd need the full row:

```sql
ALTER TABLE items REPLICA IDENTITY FULL;
ALTER TABLE lists REPLICA IDENTITY FULL;
-- etc.
```

This is only needed if you implement incremental updates.

---

## What's Done Well

1. **Consistent snake_case ↔ camelCase mapping**: All CRUD functions consistently transform between database snake_case and JavaScript camelCase. The mapping logic handles both formats in `updates` objects for flexibility.

2. **Unique channel naming**: All real-time subscriptions use unique channel names incorporating user ID, list ID, or email: `lists-${userId}`, `items-${listId}`, `history-${userId}`, `stores-${userId}`, `shared-refs-${email}`, `list-${listId}`.

3. **Proper cleanup**: All subscription functions return unsubscribe functions that call `supabase.removeChannel(channel)`.

4. **API compatibility maintained**: Function signatures match the original Firestore API (`userId`, `listId`, `itemId` parameters preserved even when unused), allowing drop-in replacement.

5. **Comprehensive RLS policies**: All 6 tables have RLS enabled with appropriate policies. The sharing model correctly allows both owners and shared users to access list/items.

6. **Access control in `increment_item_count`**: The RLS migration correctly adds ownership verification to the `SECURITY DEFINER` function (addressing WARNING-3 from the previous review).

7. **Unique constraint on `list_shares`**: The migration adds `UNIQUE (list_id, shared_with_email)` (addressing WARNING-4 from the previous review).

8. **Error handling with context**: All CRUD functions wrap errors with contextual messages including IDs.

9. **Email normalization**: `shareList`, `unshareList`, and `subscribeSharedListRefs` all normalize email to lowercase with trim.

10. **Null safety**: Subscription functions handle empty results gracefully (e.g., `subscribeSharedListRefs` returns early with empty array if no email).

---

## Requirements Traceability

| Story | Status | Notes |
|-------|--------|-------|
| US-004 | Partial Pass | CRUD operations correct but `removeItem` and `clearCheckedItems` have item_count issues |
| US-005 | Pass | All 7 subscriptions implemented with unique channels and proper cleanup |
| US-006 | Pass | RLS policies comprehensive; addressed previous review feedback |

---

## Final Assessment

**Status**: **CONDITIONAL PASS** - Critical issues must be fixed, but no blockers to testing

### Required Before Merge

| Priority | Issue | Effort | Fix |
|----------|-------|--------|-----|
| P0 | CRITICAL-1: `removeItem` item_count | Medium | Move adjustItemCount to service layer OR use DB trigger |
| P0 | CRITICAL-2: `clearCheckedItems` item_count | Low | Clarify semantic and fix if needed |
| P1 | IMPORTANT-5: Stale Firestore docstring | Trivial | Update comment |

### Should Fix Soon (Post-Merge OK)

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| P1 | IMPORTANT-1: N+1 store reorder | Low | Performance |
| P2 | IMPORTANT-3: Sequential history inserts | Low | Performance |
| P2 | IMPORTANT-4: Missing profile DELETE policy | Trivial | Completeness |

### Technical Debt (Track for Later)

| Issue | Effort | Impact |
|-------|--------|--------|
| IMPORTANT-2: Re-fetch on every change | High | Bandwidth/perf for large lists |
| SUGGESTION-2: Optimistic updates | Medium | Better UX |

---

## Summary

| Category | Count |
|----------|-------|
| Critical Issues | 2 |
| Important Issues | 5 |
| Suggestions | 4 |
| Positive Notes | 10 |

The migration is **well-executed** with solid patterns for CRUD operations, real-time subscriptions, and security policies. The critical issues around `item_count` consistency need resolution, but the overall architecture is sound and the code follows project conventions.
