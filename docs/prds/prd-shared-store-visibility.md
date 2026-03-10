# PRD: Shared List Store Visibility

**Status:** Ready  
**Created:** 2026-03-10  
**Updated:** 2026-03-10  
**Branch:** `feature/shared-store-visibility`

---

## Problem

When a list is shared between users, items reference `store_id` values pointing to the list owner's stores. However, the `stores` table has a single RLS policy (`stores_all_own`) that restricts all operations to `user_id = auth.uid()`. This means the shared recipient cannot read the owner's stores, which breaks:

- **Store-based item grouping** — items fall into the "No Store" / nil-store bucket instead of showing grouped under the owner's stores
- **Store section headers** — colored dot + store name don't render
- **Store-specific category grouping** — each store has custom `categories` with keyword-based auto-categorization; without store access, items fall back to default categories
- **Store picker in add-item form** — shared user can't see the owner's stores to assign items to them

This affects both the **React PWA** and the **native Swift iOS app**.

### Root Cause

1. **RLS:** The `stores_all_own` policy uses `FOR ALL USING (user_id = auth.uid())` — a single blanket policy for SELECT/INSERT/UPDATE/DELETE that only allows access to your own stores.

2. **React:** `subscribeStores(userId, setStores)` in `ShoppingListContext.jsx` passes the current user's ID, so only the current user's stores are fetched.

3. **Swift:** `ListDetailViewModel.init(listId:userId:)` receives `authViewModel.currentUser?.id` (the current user), then calls `StoreService.fetchStores(userId:)` which queries `.eq("user_id", value: userId)` — same result.

4. **Realtime:** Both platforms subscribe to store changes filtered by `user_id=eq.{currentUserId}`, so they wouldn't receive realtime updates for the owner's stores either.

---

## Solution: Read-Only RLS + Dual Store Fetch

### Approach

1. **Refactor the `stores_all_own` RLS policy** into separate per-operation policies:
   - `stores_select_own_or_shared` (SELECT): Allow reading own stores **and** stores referenced by items in lists shared with the current user
   - `stores_insert_own` (INSERT): Only own stores
   - `stores_update_own` (UPDATE): Only own stores
   - `stores_delete_own` (DELETE): Only own stores

2. **Add an index on `items(store_id)`** to keep the RLS subquery fast.

3. **React:** When viewing a shared list, also fetch the list owner's stores and merge them with the current user's stores for display.

4. **Swift:** Same pattern — fetch owner's stores alongside the current user's stores when on a shared list.

---

## User Stories

### US-001: Refactor Store RLS Policies

**Type:** Backend (Supabase migration)

Replace the single `stores_all_own` policy with granular per-operation policies. The SELECT policy must allow reading stores that are referenced by items in lists shared with the current user.

**Migration:**
```sql
-- Drop the blanket policy
DROP POLICY "stores_all_own" ON stores;

-- SELECT: own stores + stores referenced by items in shared lists
CREATE POLICY "stores_select_own_or_shared" ON stores
  FOR SELECT USING (
    user_id = auth.uid()
    OR id IN (
      SELECT DISTINCT i.store_id FROM items i
      JOIN list_shares ls ON ls.list_id = i.list_id
      WHERE ls.shared_with_email = auth.jwt() ->> 'email'
      AND i.store_id IS NOT NULL
    )
  );

-- INSERT: own stores only
CREATE POLICY "stores_insert_own" ON stores
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE: own stores only
CREATE POLICY "stores_update_own" ON stores
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE: own stores only
CREATE POLICY "stores_delete_own" ON stores
  FOR DELETE USING (user_id = auth.uid());

-- Index to support the RLS subquery join
CREATE INDEX IF NOT EXISTS idx_items_store_id ON items(store_id);
```

**Acceptance Criteria:**
- [ ] The blanket `stores_all_own` policy is replaced by four granular policies
- [ ] A user can SELECT their own stores (no regression)
- [ ] A user can SELECT stores belonging to another user when those stores are referenced by items in a list shared with them
- [ ] A user cannot INSERT/UPDATE/DELETE another user's stores
- [ ] Index `idx_items_store_id` exists on `items(store_id)`
- [ ] Migration is idempotent (can run on fresh DB or existing)

---

### US-002: React — Fetch Owner's Stores for Shared Lists

**Type:** Frontend (React)

Update the store subscription/fetch logic so that when viewing a shared list, the owner's stores are also loaded and available for display.

**Current behavior:**  
`subscribeStores(userId, setStores)` in `ShoppingListContext.jsx` only fetches stores where `user_id = currentUserId`.

**Required changes:**

1. In `database.js`, add a function `fetchStoresByIds(storeIds)` that fetches stores by their IDs (the RLS policy from US-001 will allow this for shared stores):
   ```js
   export const fetchStoresByIds = async (storeIds) => {
     const { data, error } = await supabase
       .from('stores')
       .select('*')
       .in('id', storeIds);
     // ...
   };
   ```

2. In `ShoppingListContext.jsx`, when the active list is shared (`_isShared === true`), extract unique `store_id` values from the list's items that don't match any of the current user's stores, and fetch those stores. Merge them into the `stores` array for display (marked as read-only / not owned).

3. The store picker in `AddItemForm.jsx` should show both the user's own stores and the owner's stores (the owner's stores visually distinguished or in a separate group).

**Acceptance Criteria:**
- [ ] When viewing a shared list, items are grouped under the correct store sections with name, color, and categories
- [ ] The current user's own stores still load and display correctly (no regression)
- [ ] Store section headers show the owner's store name and color dot
- [ ] Store-specific category grouping works (owner's store categories used for item categorization)
- [ ] Add-item store picker shows both own stores and owner's stores when on a shared list
- [ ] No duplicate stores appear if both users happen to have stores with the same name

---

### US-003: React — Realtime Sync for Shared Stores

**Type:** Frontend (React)

When the list owner renames, recolors, or modifies categories on a store, those changes should propagate to the shared user's view.

**Required changes:**

1. When viewing a shared list, subscribe to realtime changes on the owner's stores (the store IDs referenced by items in the current list).
2. On receiving a change event, refetch the shared stores and update the merged stores array.
3. Unsubscribe from the owner's store channel when navigating away from the shared list.

**Acceptance Criteria:**
- [ ] When the list owner renames a store, the shared user sees the updated name without refresh
- [ ] When the list owner changes a store's color, the shared user sees the updated color without refresh
- [ ] When the list owner modifies store categories, the shared user's item categorization updates
- [ ] Realtime subscription is cleaned up when leaving the shared list view
- [ ] No duplicate realtime channels are created

---

### US-004: Swift — Fetch Owner's Stores for Shared Lists

**Type:** iOS (Swift)

Update `ListDetailViewModel` and `StoreService` so that when viewing a shared list, the owner's stores are loaded alongside the current user's stores.

**Current behavior:**  
`ListDetailViewModel.loadData()` calls `StoreService.fetchStores(userId: userId)` where `userId` is always the authenticated user's ID.

**Required changes:**

1. In `StoreService.swift`, add a function `fetchStoresByIds(_ ids: [UUID])` that fetches stores by their IDs:
   ```swift
   static func fetchStoresByIds(_ ids: [UUID]) async throws -> [Store] {
       let stores: [Store] = try await client
           .from("stores")
           .select()
           .in("id", values: ids.map { $0.uuidString })
           .execute()
           .value
       return stores
   }
   ```

2. In `ListDetailViewModel`, after fetching items, extract `store_id` values that don't match any of the user's own stores. Fetch those via `fetchStoresByIds` and merge them into the `stores` array.

3. Pass the list's `ownerId` into `ListDetailViewModel` so it knows whether the list is shared (i.e., `ownerId != userId`).

**Acceptance Criteria:**
- [ ] When viewing a shared list, items are grouped under the correct store sections with name, color, and categories
- [ ] The current user's own stores still load and display correctly (no regression)
- [ ] Store section headers show the owner's store name and color dot
- [ ] Store-specific category grouping works (owner's store categories used)
- [ ] The `stores` array contains both own and shared stores, with shared stores properly sorted

---

### US-005: Swift — Realtime Sync for Shared Stores

**Type:** iOS (Swift)

When the list owner modifies their stores, the shared user's view should update in realtime.

**Required changes:**

1. In `ListDetailViewModel.setupRealtimeSubscriptions()`, when the list is shared, subscribe to a second stores channel filtered by the owner's `user_id`.
2. On receiving a change event, refetch the shared stores and merge them into the `stores` array.
3. Clean up the additional channel in `deinit` / `cleanup()`.

**Acceptance Criteria:**
- [ ] When the list owner renames a store, the shared user sees the updated name without reloading
- [ ] When the list owner changes a store's color, the shared user sees the updated color
- [ ] When the list owner modifies store categories, the shared user's item categorization updates
- [ ] The additional realtime channel is cleaned up when leaving the view
- [ ] No duplicate channels are created (guard against double subscription)

---

### US-006: Shared Store Read-Only Guard

**Type:** Both (React + Swift)

Ensure shared users cannot accidentally modify the list owner's stores.

**Required changes:**

1. **React:** In `StoreManager.jsx` and any store edit/delete flows, disable edit/delete controls for stores the user doesn't own. If the user somehow triggers an update/delete on a shared store, the RLS policy will reject it, but the UI should prevent the attempt.

2. **Swift:** In `StoreViewModel` and store-related views (`StoreBrowserView`, `EditStoreSheet`), ensure only own stores are editable. Shared stores should be display-only.

3. Both platforms should visually distinguish "my stores" from "shared stores" (e.g., a subtle badge or different section header).

**Acceptance Criteria:**
- [ ] React: Store Manager does not show edit/delete controls for stores not owned by the current user
- [ ] Swift: Store browser does not show edit/delete controls for stores not owned by the current user
- [ ] Attempting to edit/delete a shared store via API returns an error (RLS enforcement)
- [ ] Shared stores are visually distinguishable from own stores (subtle indicator)

---

## Credential & Service Access Plan

No external credentials required for this PRD. All changes are within Supabase (migrations, RLS) and client-side code (React, Swift).

---

## Definition of Done

- [ ] Supabase migration deployed: `stores_all_own` replaced with four granular policies + `idx_items_store_id` index
- [ ] React PWA: Shared list view shows items grouped by the list owner's stores with correct names, colors, and category grouping
- [ ] React PWA: Realtime updates from the owner's store changes propagate to the shared user
- [ ] React PWA: Store picker in add-item form shows owner's stores on shared lists
- [ ] React PWA: Store Manager prevents editing/deleting shared stores
- [ ] Swift iOS: Shared list view shows items grouped by the list owner's stores with correct names, colors, and category grouping
- [ ] Swift iOS: Realtime updates from the owner's store changes propagate to the shared user
- [ ] Swift iOS: Store views prevent editing/deleting shared stores
- [ ] No regression: Own stores load and function identically to current behavior on both platforms
- [ ] Build succeeds on both React (`npm run build`) and Swift (Xcode build)

---

## Flag Review

| Story | Support Article? | Tools? | Test Intensity | Reasoning |
|-------|------------------|--------|----------------|-----------|
| US-001: RLS migration | ❌ No | ❌ No | high | Security-critical RLS changes, must verify no unauthorized access |
| US-002: React shared store fetch | ❌ No | ❌ No | medium | UI behavior change for shared lists |
| US-003: React realtime sync | ❌ No | ❌ No | medium | Realtime subscription management |
| US-004: Swift shared store fetch | ❌ No | ❌ No | medium | UI behavior change for shared lists |
| US-005: Swift realtime sync | ❌ No | ❌ No | medium | Realtime subscription management |
| US-006: Read-only guard | ❌ No | ❌ No | medium | Permission enforcement on both platforms |

---

## Technical Notes

### RLS Performance

The SELECT policy subquery joins `items → list_shares` which are both indexed:
- `idx_items_list_id` on `items(list_id)` — exists
- `idx_list_shares_list_id` on `list_shares(list_id)` — exists
- `idx_items_store_id` on `items(store_id)` — **added in this migration**

The `IN` subquery with `DISTINCT` runs once per stores query, returning only the store IDs the shared user needs. For typical list sizes (10–100 items), this is negligible.

### Store Merging Strategy

Both platforms should:
1. Fetch own stores (existing behavior)
2. After fetching items, collect `store_id` values not in own stores
3. Fetch those missing stores by ID (RLS now allows this)
4. Merge into the stores array, keeping own stores first, then shared stores sorted by `sort_order`
5. Mark shared stores with a flag (e.g., `isShared: true` or `isOwned: false`) for UI treatment

### Realtime Considerations

The existing realtime filter `user_id=eq.{userId}` only catches changes to the current user's stores. For shared lists, a second channel filtered on the owner's `user_id` is needed. This is safe because the RLS policy controls what data the subscription can see — the shared user will only receive events for stores they have access to.
