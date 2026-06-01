# PRD: List-Scoped Stores

## Overview

Stores are currently owned per-user and shared indirectly with list collaborators via an RLS subquery. This creates a mismatch: when a list is shared, collaborators see the owner's stores read-only and cannot manage them. Stores should work like categories — scoped to a list — so all collaborators on a shared list see and manage the same set of stores.

## Goals

- Move stores from per-user to per-list ownership.
- Shared list collaborators can see and manage stores on any list they have access to.
- New lists auto-populate from the user's default store set (mirrors the category defaults pattern).
- Existing users' stores migrate to their defaults; no backfill of existing lists.

## Out of Scope

- Changing how items reference stores (`items.store_id` FK stays as-is).
- Store templates or cross-list store syncing beyond defaults.
- Changes to how items are sorted or grouped by store.

## Locked Decisions

| Question | Decision |
|---|---|
| New list default stores | Copy from `user_store_defaults` at list creation time |
| Migration of existing stores | Migrate to defaults only — no backfill of existing lists |
| Storage format | Relational — add `list_id` to `stores` table, drop `user_id` |
| Defaults storage | New `user_store_defaults` table with `list_type` column (mirrors `user_category_defaults`) |
| List types supporting stores | `grocery`, `packing`, `project` only |
| Settings UI | Rename "Category Defaults" → "List Defaults"; stores sub-section per eligible list type |

---

## User Stories

### S-1 — Database Migration: List-Scoped Stores

**As a** developer,
**I want** the database schema updated so stores are scoped to lists,
**so that** all downstream code can rely on `stores.list_id` as the ownership key.

**Acceptance Criteria:**

1. A new migration adds `list_id uuid REFERENCES lists(id) ON DELETE CASCADE` to the `stores` table.
2. `user_id` is dropped from `stores`.
3. A new `user_store_defaults` table is created:
   ```sql
   CREATE TABLE user_store_defaults (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
     list_type text NOT NULL,
     name text NOT NULL,
     color text,
     sort_order int DEFAULT 0,
     created_at timestamptz DEFAULT now()
   );
   ```
   Valid `list_type` values that support stores: `grocery`, `packing`, `project`.
4. A data migration copies every existing row in `stores` (before schema change) into `user_store_defaults` with `list_type = 'grocery'` (existing stores are assumed to be grocery-context), preserving `user_id`, `name`, `color`, `sort_order`.
5. All existing rows in `stores` are deleted (they had no `list_id` and cannot be migrated to a list).
6. Indexes added:
   - `CREATE INDEX idx_stores_list_id ON stores(list_id);`
   - `CREATE INDEX idx_user_store_defaults_user_id ON user_store_defaults(user_id);`
7. RLS on `stores` is replaced:
   - **SELECT**: user owns the list (`lists.user_id = auth.uid()`) OR user is a collaborator (`list_shares.shared_with_email = auth.jwt()->>'email'`).
   - **INSERT / UPDATE / DELETE**: same membership check (both owner and collaborators can manage stores on a shared list).
   - Old `stores_select_own_or_shared`, `stores_insert_own`, `stores_update_own`, `stores_delete_own` policies dropped.
8. RLS on `user_store_defaults`: all operations require `user_id = auth.uid()`.
9. `ALTER PUBLICATION supabase_realtime ADD TABLE user_store_defaults;`
10. `npm run build` succeeds after migration files are added.

**Flow Chart:**

```
1. NEW MIGRATION FILE (supabase/migrations/[timestamp]_list_scoped_stores.sql)
   ├─ Add list_id column to stores (nullable initially)
   ├─ Copy stores → user_store_defaults (data migration)
   ├─ Delete all rows from stores
   ├─ Drop user_id from stores
   ├─ Set list_id NOT NULL
   ├─ Add indexes
   ├─ Drop old RLS policies on stores
   ├─ Add new RLS policies (list membership)
   └─ Add RLS + realtime for user_store_defaults

2. VERIFY QUALITY
   ├─ Run lint
   └─ Run build
```

---

### S-2 — Service Layer: List-Scoped Store CRUD + User Store Defaults

**As a** developer,
**I want** `src/services/database.js` updated to reflect the new schema,
**so that** all store operations are list-scoped and defaults are manageable.

**Acceptance Criteria:**

1. `createStore(userId, listId, { name, color, sortOrder })` — inserts into `stores` with `list_id`.
2. `updateStore(storeId, updates)` — unchanged in signature; no user_id filter needed (RLS enforces access).
3. `deleteStore(storeId)` — unchanged.
4. `saveStoreOrder(stores)` — unchanged.
5. `subscribeStores(listId, callback)` — subscribes to `stores` filtered by `list_id` (replaces `userId` filter). Returns an unsubscribe function.
6. `fetchStoresByIds(ids)` — unchanged (still useful for ad-hoc lookups).
7. `subscribeSharedStores` and the `_isShared` merging logic in `ShoppingListContext` are removed — no longer needed since all collaborators share the same list-scoped stores.
8. New functions for defaults:
   - `fetchUserStoreDefaults(userId, listType)` — SELECT from `user_store_defaults` WHERE `user_id = userId AND list_type = listType` ORDER BY `sort_order`.
   - `createUserStoreDefault(userId, listType, { name, color, sortOrder })` — INSERT.
   - `updateUserStoreDefault(id, updates)` — UPDATE.
   - `deleteUserStoreDefault(id)` — DELETE.
   - `saveUserStoreDefaultOrder(defaults)` — batch UPDATE `sort_order`.
9. All new and modified functions have JSDoc comments.
10. `npm run build` succeeds.

**Flow Chart:**

```
1. src/services/database.js
   ├─ Update createStore: add listId param, use list_id in insert
   ├─ Update subscribeStores: filter by list_id instead of user_id
   ├─ Remove subscribeSharedStores
   ├─ Remove fetchStoresByIds (or keep if still used elsewhere — verify)
   ├─ Add fetchUserStoreDefaults
   ├─ Add createUserStoreDefault
   ├─ Add updateUserStoreDefault
   ├─ Add deleteUserStoreDefault
   └─ Add saveUserStoreDefaultOrder

2. VERIFY QUALITY
   ├─ Run lint
   └─ Run build
```

---

### S-3 — New List Creation Copies User Store Defaults

**As a** user,
**I want** my preferred stores to automatically appear when I create a new list,
**so that** I don't have to rebuild my store set for every new list.

**Acceptance Criteria:**

1. When a new list is created, if the list type supports stores (`grocery`, `packing`, `project`), `fetchUserStoreDefaults(userId, listType)` is called.
2. For each default, a store row is inserted into `stores` with the new `list_id`, preserving `name`, `color`, and `sort_order`.
3. If the list type does not support stores, or the user has no defaults for that type, the list starts with no stores (no error, no empty-state blocking).
4. This copy happens server-side in the list-creation flow (within `createList` in `database.js` or as a follow-up call in the context action), not in a UI component.
5. `npm run build` succeeds.

**Flow Chart:**

```
1. src/services/database.js — createList (or post-creation helper)
   ├─ After list row is inserted, fetch user_store_defaults for userId
   ├─ If defaults exist: batch insert into stores with new list_id
   └─ If no defaults: no-op

2. src/context/ShoppingListContext.jsx — createListAction
   └─ Ensure createList call propagates listId correctly for store seeding

3. VERIFY QUALITY
   ├─ Run lint
   └─ Run build
```

---

### S-4 — State Management: List-Scoped Stores in ShoppingListContext

**As a** developer,
**I want** `ShoppingListContext` and `useShoppingList` updated to manage list-scoped stores,
**so that** all components receive the correct stores for the active list.

**Acceptance Criteria:**

1. `stores` state is scoped to the active list — `subscribeStores(activeListId, callback)` replaces `subscribeStores(userId, callback)`.
2. `sharedStores` state and the `allStores` merge logic are removed.
3. Store subscription is re-established whenever `activeListId` changes (and torn down on change/unmount).
4. `addStoreAction(listId, data)` passes `listId` through to `createStore`.
5. Context exposes `state.stores` (list-scoped only — no `_isShared` flag, no merging).
6. `App.jsx` and any other consumers that referenced `allStores` or `sharedStores` are updated to use `state.stores`.
7. `npm run build` succeeds.

**Flow Chart:**

```
1. src/context/ShoppingListContext.jsx
   ├─ Remove sharedStores state
   ├─ Remove allStores merge logic
   ├─ Remove subscribeSharedStores call
   ├─ Update subscribeStores call: pass activeListId instead of userId
   ├─ Re-subscribe when activeListId changes (useEffect dependency)
   └─ Update addStoreAction to pass listId

2. src/hooks/useShoppingList.js (if store logic lives here)
   └─ Mirror same changes

3. src/App.jsx
   └─ Replace allStores/sharedStores references with state.stores

4. VERIFY QUALITY
   ├─ Run lint
   └─ Run build
```

---

### S-5 — Store Management UI: List-Scoped (React Web)

**As a** user,
**I want** to manage stores for the current list from the list's context menu,
**so that** stores feel like a list setting (like categories) rather than a global tab.

**Acceptance Criteria:**

1. The top-level "Stores" tab is removed from the main navigation (desktop and mobile).
2. A "Manage Stores" menu item is added to the `ListSelector` context menu (desktop dropdown and mobile action sheet), mirroring the "Edit Categories" entry. It is shown only for list types that support store assignment (`grocery`, `packing`, `project`); hidden for `basic`, `todo`, and `guest_list`. It is available to both owners and collaborators (no `isOwned` gate).
3. A "Manage Stores" menu item is added to the `MobileListDetail` 3-dot menu, subject to the same list-type visibility rule, ungated by ownership.
4. Tapping "Manage Stores" opens `StoreManager` as a modal or sheet, scoped to the active list.
5. `StoreManager` receives `listId` as a required prop (replaces any user-ID-based ownership assumption).
6. The "Shared with you" section and `_isShared` badge are removed — all stores in the list are peers.
7. All collaborators on a shared list see the same stores in `StoreManager` (owner and collaborator views are identical).
8. Add, edit, delete, and reorder actions all pass `listId` through to the service layer.
9. `AddItemForm` store picker shows stores from `state.stores` (list-scoped) — no change to the picker UI required beyond the data source.
10. `ShoppingItem` store badge and store picker continue to work unchanged (they consume `stores` from props, not ownership metadata).
11. Loading, error, and empty states handled explicitly.
12. `npm run build` succeeds.

**Flow Chart:**

```
1. src/App.jsx
   ├─ Remove Stores tab from navigation (desktop + mobile)
   └─ Wire onManageStoresClick handler → open StoreManager modal with activeListId

2. src/components/ListSelector.jsx
   ├─ Add "Manage Stores" menu item (desktop, after Edit Categories)
   └─ Add "Manage Stores" menu item (mobile action sheet, after Edit Categories)

3. src/components/MobileListDetail.jsx
   └─ Add "Manage Stores" to 3-dot menu (ungated)

4. src/components/StoreManager.jsx
   ├─ Add listId prop (required)
   ├─ Remove _isShared filtering and "Shared with you" section
   └─ Remove shared store badge rendering

5. VERIFY QUALITY
   ├─ Run lint
   └─ Run build
```

---

### S-6 — List Defaults Settings UI: Stores Per List Type (React Web)

**As a** user,
**I want** to manage my default stores per list type inside a unified "List Defaults" settings section,
**so that** new lists of each type start with the right stores for that context.

**Acceptance Criteria:**

1. The existing "Category Defaults" section in Settings is renamed to "List Defaults."
2. "List Defaults" is organized by list type. Each list type has its own expandable or tabbed sub-section.
3. Within each list type sub-section:
   - Category defaults are shown as before (existing functionality, no change).
   - A "Stores" sub-section appears **only** for list types that support store assignment: `grocery`, `packing`, `project`. It does not appear for `basic`, `todo`, or `guest_list`.
4. The Stores sub-section uses the same CRUD and drag-to-reorder UX as the list-level `StoreManager`.
5. Changes in the Stores sub-section affect only `user_store_defaults` for that `list_type` — they do not modify stores on any existing list.
6. A brief explanation is shown per list type's Stores section: "These stores are added to every new [List Type] list you create."
7. Empty state message for a Stores sub-section: "No default stores yet. Add one to have it appear on every new [List Type] list."
8. Loading, error, and empty states handled explicitly per sub-section.
9. `npm run build` succeeds.

**Flow Chart:**

```
1. Settings view (src/App.jsx or Settings component)
   └─ Rename "Category Defaults" section label → "List Defaults"

2. List Defaults section — per list type (grocery, packing, project, basic, todo, guest_list)
   ├─ Render category defaults sub-section (existing, unchanged)
   └─ For grocery / packing / project only:
      └─ Render Stores sub-section → UserStoreDefaultsManager

3. src/components/UserStoreDefaultsManager.jsx (new component)
   ├─ Accepts listType prop
   ├─ Fetch user_store_defaults on mount via fetchUserStoreDefaults(userId, listType)
   ├─ Render CRUD form (mirrors StoreManager layout)
   ├─ Drag-to-reorder via @dnd-kit (same pattern as StoreManager)
   └─ Handle loading / error / empty states

4. VERIFY QUALITY
   ├─ Run lint
   └─ Run build
```

---

### S-7 — iOS: List-Scoped Store Management (Swift)

**As an** iOS user,
**I want** to manage stores from the list's context menu on iOS,
**so that** the iOS experience is consistent with the web app.

**Acceptance Criteria:**

1. The iOS store data layer reads stores filtered by `list_id` (not `user_id`).
2. Store CRUD operations on iOS pass `list_id`.
3. The standalone Stores tab (if present) is removed from the iOS tab bar or navigation.
4. A "Manage Stores" entry is added to the list detail context menu / swipe action or the list options sheet, mirroring the web's list context menu pattern. It is shown only for `grocery`, `packing`, and `project` list types; hidden for `basic`, `todo`, and `guest_list`.
5. Tapping "Manage Stores" opens the store management view scoped to the active list.
6. The "shared stores" read-only section and shared badge are removed from the iOS store management view — all stores in the list are peers.
7. All collaborators on a shared list see and can manage the same stores on iOS.
8. The app builds successfully (Xcode build succeeds).

**Flow Chart:**

```
1. iOS StoreService / ListDetailViewModel
   ├─ Replace user_id filter with list_id filter on stores fetch
   └─ Update insert/update to use list_id

2. iOS navigation
   ├─ Remove Stores tab from tab bar (if present)
   └─ Add "Manage Stores" to list detail options/context menu

3. iOS Store management view
   ├─ Remove "shared" badge / read-only logic
   └─ All stores in list treated as editable (subject to RLS)

4. VERIFY QUALITY
   └─ Xcode build succeeds
```

---

### S-8 — Enable Store Assignment for Packing and Project List Types (React Web + iOS)

**As a** user,
**I want** to assign items to stores on packing and project lists,
**so that** store assignment is available on all list types that support stores.

**Acceptance Criteria:**

1. In `src/utils/listTypes.js`, the `packing` config has `fields.store` set to `true`.
2. In `src/utils/listTypes.js`, `'store'` is added to the `packing` `sortLevels` array.
3. If `project` list type currently has `fields.store: false`, it is also set to `true` and `'store'` added to its `sortLevels`. Builder verifies at implementation time.
4. The store picker appears in `AddItemForm` and in the `ShoppingItem` expanded edit row for packing (and project if applicable) lists — no component changes needed; this follows automatically from the config change.
5. Store grouping in the sort pipeline works for packing/project lists — no pipeline changes needed (already generic).
6. In `ios-native/GatherLists/GatherLists/Utils/ListTypeConfig.swift`, the `packing` config has `store: true` and `.store` added to `sortLevels`.
7. If `project` config in Swift also has `store: false`, it is updated to match. Builder verifies.
8. The store picker appears in `EditItemSheet` for packing (and project) lists on iOS — no component changes needed.
9. `npm run build` succeeds. Xcode build succeeds.

**Flow Chart:**

```
1. src/utils/listTypes.js
   ├─ packing: fields.store → true
   ├─ packing: sortLevels → add 'store'
   ├─ project: verify fields.store; set true if false
   └─ project: sortLevels → add 'store' if missing

2. ios-native/GatherLists/GatherLists/Utils/ListTypeConfig.swift
   ├─ packing: store → true
   ├─ packing: sortLevels → add .store
   ├─ project: verify store field; set true if false
   └─ project: sortLevels → add .store if missing

3. VERIFY QUALITY
   ├─ Run lint
   ├─ Run build
   └─ Xcode build succeeds
```

---

## Story Order (Deployment)

S-1 → S-2 → S-3 → S-4 → S-5 → S-6 → S-7 → S-8

S-1 must ship before any other story. S-2 and S-3 depend on S-1. S-4 depends on S-2. S-5 depends on S-4. S-6 depends on S-2. S-7 and S-8 can run in parallel with S-5/S-6 after S-2 ships. S-8 is self-contained and can ship independently at any point.
