# PRD: Native Swift iOS App — Phase 4: Store Management

**ID:** prd-swift-stores  
**Status:** Ready  
**Created:** 2026-03-09  
**Priority:** High  
**Phase:** 4 of 8  
**Depends On:** prd-swift-shopping-list (Phase 3)

## Overview

Build the full store management experience in the native Swift app. Stores let users organize shopping list items by where they shop (Walmart, Costco, Trader Joe's, etc.). Each store has a name, color, custom sort order, and its own set of categories with keywords for auto-categorization.

Phase 3 introduced a read-only `StoreService` for grouping items by store. This phase promotes it to full CRUD and builds the Stores tab UI: browse stores, create new stores (with name + color picker), rename/recolor, delete, drag-to-reorder, and a dedicated category editor per store (add/remove/rename/reorder categories, edit keywords, copy from defaults or another store).

This PRD is **Swift-only** because it's continuing the native app buildout. The React PWA already has full store management. Both codebases share the same Supabase backend — no backend changes are needed.

## Context: What Already Exists

### Database (shared, no changes needed)

```sql
CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  color text,                  -- hex color string (e.g. '#1565c0')
  categories jsonb DEFAULT '[]',  -- array of {key, name, color, keywords[]}
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

**RLS:** Users can only read/write their own stores (`user_id = auth.uid()`).

### From Phase 3 (assumed complete)

- `Store` Codable model: `id`, `userId`, `name`, `color`, `categories` (decoded as `[CategoryDef]`), `sortOrder`, `createdAt`
- `CategoryDef` struct: `key`, `name`, `color`, `keywords`
- `StoreService` with read-only methods:
  - `fetchStores(userId:)` → `[Store]` ordered by `sort_order`
  - `subscribeStores(userId:)` → realtime subscription
- `CategoryDefinitions` with 12 default categories and `categorizeItem()` function

### React Implementation (reference for parity)

- **StoreManager** (784 lines): Full store CRUD with search, drag-to-reorder via `@dnd-kit/sortable`, inline create form, edit name/color, delete with confirm dialog, expandable per-store category editor. Responsive mobile/desktop layouts.
- **StoreCategoryEditor** (inline): Add categories (name + color), remove with confirm, rename, reorder (up/down arrows), edit keywords (comma-separated), copy categories from defaults or another store.
- **Database functions**: `createStore`, `updateStore`, `deleteStore`, `saveStoreOrder` (batch upsert for reorder).
- **Realtime**: Subscribe to `stores` table, re-fetch on any change.
- **18 preset store colors**, **18 preset category colors**.
- **New store defaults**: Empty `categories` array, `sort_order` = current store count.

## Design Decisions (User-Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Store list presentation | **Grouped inset `List`** | Standard iOS Settings-style, native feel |
| Create store presentation | **Bottom sheet (`.sheet`)** | Consistent with Phase 2 "Create List" pattern |
| Color picker | **Preset grid + iOS `ColorPicker`** | Presets for speed, native picker for custom |
| Drag-to-reorder | **Edit mode + `onMove`** | Standard iOS list editing pattern |
| Category editor | **Navigation push to dedicated view** | Proper iOS drill-down, not web-style accordion |
| Delete store | **Both swipe-to-delete + context menu** | Maximum iOS discoverability |

## Goals

- Implement full store CRUD (create, read, update, delete)
- Provide a native iOS store browsing experience in the Stores tab
- Support drag-to-reorder with Edit mode toggle
- Build a dedicated category editor screen per store with full feature parity (add, remove, rename, reorder, edit keywords, copy from defaults or another store)
- Enable real-time sync so store changes from the React PWA appear immediately

## Non-Goals

- Store-level price subtotals or analytics
- Map/location integration for stores
- Store logo/image uploads
- Sharing stores between users
- iPad-specific layouts
- Offline support / local caching

## Credential & Service Access Plan

No external credentials required for this PRD. All data flows through the existing Supabase client initialized in Phase 1.

## User Stories

### US-001: StoreService — Full CRUD Operations

**Description:** As a developer, I need to extend the read-only StoreService from Phase 3 to support create, update, delete, and reorder so the Stores tab can perform all store operations.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] `StoreService` extended with new methods:
  - `createStore(userId:, name:, color:, categories:)` → `Store` (inserts row with `sort_order` = count of existing stores, returns created store)
  - `updateStore(storeId:, updates:)` (partial update — name, color, categories)
  - `deleteStore(storeId:)` (single delete)
  - `saveStoreOrder(userId:, stores:)` (batch upsert — maps each store to its new `sort_order` index)
- [ ] `createStore` trims the store name and rejects empty names
- [ ] All methods use `SupabaseManager.shared.client`
- [ ] All methods throw descriptive errors on failure
- [ ] Existing `fetchStores` and `subscribeStores` remain unchanged
- [ ] Build succeeds

### US-002: StoreViewModel — @Observable State + Realtime

**Description:** As a developer, I need a view model that manages the store list state for the Stores tab, including realtime updates and all CRUD actions.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] `StoreViewModel` is `@Observable`
- [ ] Published properties: `stores: [Store]`, `isLoading: Bool`, `error: String?`
- [ ] On init with `userId`: fetches stores, sets up realtime subscription
- [ ] Realtime: on any Postgres change to `stores` (filtered by `user_id`), re-fetches all stores
- [ ] Action methods delegate to `StoreService`:
  - `addStore(name:, color:)` — calls `StoreService.createStore` with empty categories
  - `updateStore(_ storeId: UUID, name:, color:)` — calls `StoreService.updateStore`
  - `deleteStore(_ storeId: UUID)` — calls `StoreService.deleteStore`
  - `moveStore(from:, to:)` — reorders the local array and calls `StoreService.saveStoreOrder`
  - `updateCategories(_ storeId: UUID, categories: [CategoryDef])` — calls `StoreService.updateStore` with new categories
- [ ] Cleans up realtime subscription on deinit
- [ ] Build succeeds

### US-003: Store Browser View — List + Search + Edit Mode

**Description:** As a user, I want to see all my stores in the Stores tab so I can manage where I shop.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] Stores tab replaces `StoresPlaceholderView` with `StoreBrowserView`
- [ ] Grouped inset `List` style showing all stores ordered by `sort_order`
- [ ] Each store row shows: colored dot (store color), store name, category count label (e.g. "12 categories"), disclosure chevron
- [ ] Navigation title: "Stores"
- [ ] Toolbar: "+" button (trailing) to create store, Edit button (leading) for reorder mode
- [ ] In Edit mode: drag handles appear, `onMove` modifier reorders stores, persists new order via `StoreService.saveStoreOrder`
- [ ] Search bar (`.searchable` modifier) filters stores by name (case-insensitive substring match)
- [ ] Empty state: SF Symbol `storefront` icon + "No stores yet" + "Add a store to organize items by where you shop." hint
- [ ] Pull-to-refresh triggers full re-fetch
- [ ] Build succeeds
- [ ] Verify on device/simulator

### US-004: Create Store Sheet

**Description:** As a user, I want to create a new store with a name and color so I can organize my shopping items by location.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] Tapping "+" in the toolbar presents a `.sheet` bottom sheet
- [ ] Sheet contains: "New Store" title, name text field (placeholder "Store name"), preset color grid (18 colors matching React's `PRESET_COLORS`), iOS `ColorPicker` for custom color, "Create" button
- [ ] Preset color grid: 18 circular swatches in a flexible grid. Tapping a swatch selects it (shows checkmark or border highlight). Default selection: first preset color.
- [ ] iOS `ColorPicker` labeled "Custom Color" below the preset grid — selecting a custom color deselects any preset
- [ ] "Create" button disabled when name is empty
- [ ] Tapping "Create": creates store, dismisses sheet
- [ ] Cancel via sheet drag-to-dismiss or "Cancel" button in toolbar
- [ ] New store appears in the list immediately (realtime subscription picks it up)
- [ ] Build succeeds
- [ ] Verify on device/simulator

### US-005: Edit Store — Rename + Recolor

**Description:** As a user, I want to edit a store's name and color so I can keep my store list accurate.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] Long-press on a store row shows a context menu with "Edit Name & Color" option
- [ ] Selecting "Edit Name & Color" presents a `.sheet` with current name pre-filled and current color selected
- [ ] Same color picker layout as Create Store Sheet (preset grid + iOS `ColorPicker`)
- [ ] "Save" button persists changes via `StoreService.updateStore`
- [ ] Cancel via sheet drag-to-dismiss or "Cancel" button
- [ ] Changes appear in the list immediately (realtime)
- [ ] Build succeeds
- [ ] Verify on device/simulator

### US-006: Delete Store — Swipe + Context Menu

**Description:** As a user, I want to delete a store I no longer shop at, with a confirmation to prevent accidents.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] Swipe left on a store row reveals a red "Delete" action (`.swipeActions(edge: .trailing)`)
- [ ] Long-press context menu includes a destructive "Delete" option
- [ ] Both actions show a confirmation alert: "Delete '[store name]'?" with "Delete" (destructive) and "Cancel" buttons
- [ ] Confirming deletes the store via `StoreService.deleteStore`
- [ ] Items that had this store assigned get `store_id` set to `NULL` (handled by DB `ON DELETE SET NULL`)
- [ ] Store disappears from the list immediately (realtime)
- [ ] Build succeeds
- [ ] Verify on device/simulator

### US-007: Category Editor View — Browse + Add + Delete

**Description:** As a user, I want to view and manage the categories for a specific store so I can customize how my items are organized at that store.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] Tapping a store row navigates (push) to a `CategoryEditorView` for that store
- [ ] Navigation title: "[Store Name] Categories"
- [ ] `List` showing all categories for the store, ordered by array position
- [ ] Each category row: colored dot (category color), category name, keyword count label (e.g. "8 keywords")
- [ ] Toolbar "+" button to add a new category
- [ ] Add category: alert with text field for name. New category gets a default color (next from preset palette), empty keywords, key = `custom_\(timestamp)`
- [ ] Swipe-to-delete on a category row with confirmation alert: "Delete '[category name]'?"
- [ ] Empty state: "No categories" + hint "Add categories or copy from defaults."
- [ ] All changes persist immediately via `StoreViewModel.updateCategories`
- [ ] Build succeeds
- [ ] Verify on device/simulator

### US-008: Category Editor — Edit Name, Color, Keywords

**Description:** As a user, I want to edit a category's name, color, and keywords so auto-categorization works correctly for my store.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] Tapping a category row navigates (push) to a `CategoryDetailView`
- [ ] Category detail shows:
  - Name text field (editable, pre-filled)
  - Color: preset category color grid (18 colors) + iOS `ColorPicker`
  - Keywords section: list of current keywords as removable chips/tags. Tap "×" on a chip to remove it.
  - "Add Keyword" text field at the bottom — enter a keyword and tap "Add" (or return key)
- [ ] All changes save immediately on field change (no explicit "Save" button — auto-persist)
- [ ] Navigating back returns to the category list with updates reflected
- [ ] Build succeeds
- [ ] Verify on device/simulator

### US-009: Category Editor — Reorder + Copy

**Description:** As a user, I want to reorder categories and copy categories from defaults or another store so I can quickly set up a new store.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] Edit mode in the category list: Edit button (leading toolbar) enables drag handles + `onMove` for reordering
- [ ] Reorder persists immediately via `StoreViewModel.updateCategories` with the new array order
- [ ] Toolbar menu (trailing, "⋯" or labeled "More") with options:
  - "Copy Default Categories" — replaces current categories with the 12 defaults (with confirmation alert if categories already exist: "Replace N existing categories with defaults?")
  - "Copy from [Store Name]..." — submenu listing other stores with their colored dot + name + category count. Tapping copies that store's categories (with same confirmation if replacing)
- [ ] Copy replaces the entire categories array (not merge)
- [ ] Build succeeds
- [ ] Verify on device/simulator

### US-010: Realtime Sync — Cross-Device Verification

**Description:** As a user, I want store changes made on the web app to appear on my phone in real-time so my store list is always current.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] Creating a store on the React PWA appears in the Swift app's Stores tab within ~2 seconds
- [ ] Renaming/recoloring a store on one client reflects on the other
- [ ] Deleting a store on one client removes it on the other
- [ ] Reordering stores on one client updates the order on the other
- [ ] Editing a store's categories on one client updates the other
- [ ] Pull-to-refresh works as a manual fallback
- [ ] Realtime subscription reconnects after app returns from background
- [ ] Build succeeds
- [ ] Verify on device/simulator with two clients

## Functional Requirements

- FR-1: The Stores tab must display all user stores in a grouped inset list, ordered by `sort_order`.
- FR-2: Users must be able to create stores with a name and color via a bottom sheet.
- FR-3: Users must be able to edit a store's name and color via a bottom sheet triggered from a context menu.
- FR-4: Users must be able to delete stores via swipe-to-delete or context menu, with confirmation.
- FR-5: Users must be able to reorder stores via Edit mode with drag handles.
- FR-6: Reorder must persist the new `sort_order` values via batch upsert.
- FR-7: Each store must have a dedicated category editor view accessible via navigation push.
- FR-8: The category editor must support: add, delete, rename, recolor, edit keywords, reorder, and copy from defaults or another store.
- FR-9: The search bar must filter stores by name (case-insensitive substring match).
- FR-10: Realtime subscriptions must keep the store list in sync across devices.
- FR-11: Preset store colors must match React's 18-color palette. Preset category colors must match React's 18-color palette.
- FR-12: Items assigned to a deleted store get `store_id` set to `NULL` by database cascade — the app must not handle this manually.

## Non-Goals

- Store location/map integration
- Store logo/image uploads
- Sharing stores between users
- Price subtotals or spending analytics per store
- iPad-specific layouts
- Offline support / local caching

## Technical Considerations

- **Framework:** SwiftUI (iOS 17+)
- **State Management:** `@Observable` (Observation framework)
- **Networking:** Supabase Swift SDK v2.x — PostgREST for CRUD, Realtime for subscriptions
- **List style:** `.listStyle(.insetGrouped)` for native iOS Settings feel
- **Reorder:** SwiftUI `onMove(perform:)` modifier with `EditButton()` in toolbar
- **Color picker:** Combine custom preset grid view with SwiftUI `ColorPicker` component
- **Navigation:** `NavigationLink` for drill-down to category editor and category detail
- **Batch upsert:** `saveStoreOrder` uses Supabase `.upsert()` with `onConflict: "id"` for efficient reordering
- **Category persistence:** Categories are stored as a jsonb array on the store row. Each category edit re-writes the entire array. This is the same pattern as React.
- **Preset colors:** Define as static arrays matching React's `PRESET_COLORS` and `CATEGORY_PRESET_COLORS`

## Definition of Done

Phase 4 is complete when:

1. All 10 stories pass their acceptance criteria
2. The Stores tab shows a native grouped inset list of all user stores
3. Users can create stores with name + color via a bottom sheet
4. Users can rename/recolor stores via context menu → bottom sheet
5. Users can delete stores via swipe or context menu with confirmation
6. Users can reorder stores via Edit mode drag handles
7. Tapping a store navigates to a category editor with full functionality (add, delete, rename, recolor, reorder, edit keywords, copy)
8. Changes made on the React PWA appear in the Swift app in real-time (and vice versa)
9. No regressions in Phase 1 (auth), Phase 2 (lists), or Phase 3 (items) functionality
10. Build succeeds with no warnings related to this phase's code
11. Tested on iPhone simulator (iOS 17+)

## Success Metrics

- Store CRUD operations complete in < 1 second
- Realtime sync latency under 3 seconds between React and Swift clients
- Category editor drill-down navigation feels instant (< 300ms transition)
- All 18 preset colors render correctly and match React palette

## Open Questions

- None — all design decisions confirmed.
