# PRD: Native Swift iOS App — Phase 3: Shopping List Items

**ID:** prd-swift-shopping-list  
**Status:** Ready  
**Created:** 2026-03-09  
**Priority:** High  
**Phase:** 3 of 8  
**Depends On:** prd-swift-lists-core (Phase 2)

## Overview

Build the full shopping list item experience in the native Swift app. When a user taps into a list from the Phase 2 list browser, they land on a rich list detail view where they can add items (with history-based autocomplete), view items grouped by store then by category, check/uncheck items, edit item details (name, quantity, price, store, category), swipe-to-delete items, and undo deletions via shake gesture.

This completes the core shopping workflow — the most-used feature in Gather Lists. After this phase, users can fully manage their grocery lists on the native app.

This PRD is **Swift-only** because it's continuing the native app buildout. The React PWA already has full item functionality. Both codebases share the same Supabase backend — no backend changes are needed.

## Context: What Already Exists

### Database (shared, no changes needed)

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `items` | `id`, `list_id`, `name`, `category`, `is_checked`, `store_id`, `quantity`, `price`, `image_url`, `added_at` | FK cascade delete from `lists` |
| `history` | `id`, `user_id`, `name`, `added_at` | Deduplicated autocomplete source |
| `stores` | `id`, `user_id`, `name`, `color`, `categories` (jsonb), `sort_order` | Per-store category customization |
| `lists` | (see Phase 2) | `item_count` maintained by 3 DB triggers |

**Critical:** `item_count` on `lists` is maintained by database triggers on item insert, delete, and check/uncheck. The Swift client must NOT manually manage this field.

### Items Schema Detail

```sql
CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  category text,              -- category key (e.g. 'produce', 'dairy')
  is_checked boolean DEFAULT false,
  store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  quantity int DEFAULT 1,
  price numeric,              -- nullable, unit price
  image_url text,             -- nullable, URL to item image
  added_at timestamptz DEFAULT now()
);
```

### Category System

12 built-in categories, each with a key, display name, color, and keyword list for auto-categorization:

| Key | Name | Color | Example Keywords |
|-----|------|-------|-----------------|
| `produce` | Produce | `#4caf50` | apple, banana, lettuce, tomato |
| `dairy` | Dairy & Eggs | `#2196f3` | milk, cheese, yogurt, eggs |
| `meat` | Meat & Seafood | `#e53935` | chicken, beef, salmon, shrimp |
| `bakery` | Bakery | `#ff9800` | bread, bagels, tortillas |
| `frozen` | Frozen | `#00bcd4` | ice cream, frozen pizza |
| `pantry` | Pantry & Dry Goods | `#795548` | rice, pasta, flour, sugar |
| `beverages` | Beverages | `#9c27b0` | water, juice, coffee, tea |
| `snacks` | Snacks | `#ffc107` | chips, crackers, cookies |
| `condiments` | Condiments & Sauces | `#ff5722` | ketchup, mustard, soy sauce |
| `household` | Household | `#607d8b` | paper towels, trash bags |
| `personal_care` | Personal Care | `#e91e63` | shampoo, toothpaste |
| `other` | Other | `#9e9e9e` | (fallback) |

**Auto-categorization logic:** Match item name against keywords using 3-pass strategy:
1. Exact match (full name = keyword)
2. Multi-word phrase match (keyword is substring of name)
3. Single-word fallback (any word in name matches any keyword)

If no match, default to `other`.

**Per-store categories:** Each store can have a custom `categories` jsonb array with the same structure. When an item is assigned to a store, use that store's categories for auto-categorization. Items without a store use the 12 default categories.

### React Implementation (reference for parity)

- **ShoppingList** (342 lines): Groups unchecked items by store → category. Checked items in a collapsible "Checked" section at the bottom with "Clear checked" button.
- **ShoppingItem** (544 lines): Compact row with thumbnail, name (+ qty badge), store/category badges, price. Pencil icon to toggle inline edit panel. Double-tap to check/uncheck. Swipe-left to delete (80px threshold). Restore animation for undo.
- **AddItemForm** (172 lines): Text input with autocomplete dropdown from history. Optional store selector. "Add" button.
- **ShoppingListContext** (437 lines): All item CRUD actions, realtime subscriptions, restore actions for undo.
- **UndoContext** (86 lines): In-memory undo stack, shake detection, undo on shake.
- **Realtime pattern:** Subscribe to `items` table filtered by `list_id`, re-fetch all items on any change event.

### From Phase 1 & 2 (assumed complete)

- `SupabaseManager` singleton with initialized client
- `AuthViewModel` with `currentUser` (user ID + email)
- `GatherList` and `ListShare` Codable models
- `ListService` with CRUD operations and realtime subscriptions
- `ListViewModel` with `@Observable` state
- List browser view → navigation to list detail (Phase 2 built empty state + navigation)

## Design Decisions (User-Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Add item input position | **Bottom of screen** | Thumb-friendly, like iOS Reminders |
| Autocomplete presentation | **`.searchSuggestions` modifier** | Native iOS search field feel |
| Check/uncheck interaction | **Double-tap on row** | Matches React behavior for consistency |
| Swipe-to-delete | **SwiftUI `.swipeActions`** | Standard iOS pattern, feels native |
| Edit item presentation | **Context menu on long-press** | Native iOS interaction, no extra UI chrome |
| Undo mechanism | **Shake-to-undo via `UndoManager`** | iOS built-in, standard gesture |
| Store grouping | **Include in Phase 3** | Group by store if stores exist, even before Store CRUD UI (Phase 4) |

## Goals

- Implement the complete item CRUD workflow (add, view, edit, check, delete)
- Display items grouped by store then by category, with checked items at the bottom
- Provide history-based autocomplete when adding items
- Support swipe-to-delete with shake-to-undo
- Enable real-time sync so changes from the React PWA (or another device) appear immediately
- Auto-categorize new items based on keyword matching

## Non-Goals

- Item image picker / image search (Phase 7)
- Store CRUD UI (Phase 4) — but we read existing stores for grouping
- AI-powered suggestions (Phase 8)
- Recipe "Add to List" integration (Phase 6)
- Drag-to-reorder items (not in React either — items are ordered by `added_at`)
- Price subtotals per store (nice-to-have, not critical for parity)

## Credential & Service Access Plan

No external credentials required for this PRD. All data flows through the existing Supabase client initialized in Phase 1.

## User Stories

### US-001: Item Codable Model

**Description:** As a developer, I need a Swift model for shopping list items that maps to the Supabase `items` table so I can decode/encode item data.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] `Item` struct conforms to `Codable` and `Identifiable`
- [ ] Properties: `id` (UUID), `listId` (UUID), `name` (String), `category` (String?), `isChecked` (Bool), `storeId` (UUID?), `quantity` (Int), `price` (Decimal?), `imageUrl` (String?), `addedAt` (Date)
- [ ] `CodingKeys` map to snake_case column names (`list_id`, `is_checked`, `store_id`, `image_url`, `added_at`)
- [ ] Default values: `quantity = 1`, `isChecked = false`, `price = nil`, `imageUrl = nil`, `category = nil`, `storeId = nil`
- [ ] `HistoryEntry` struct: `id` (UUID), `userId` (UUID), `name` (String), `addedAt` (Date) with matching `CodingKeys`
- [ ] `Store` struct: `id` (UUID), `userId` (UUID), `name` (String), `color` (String?), `categories` (jsonb decoded as `[CategoryDef]`), `sortOrder` (Int), `createdAt` (Date) — with `CodingKeys` mapping (`user_id`, `sort_order`, `created_at`)
- [ ] `CategoryDef` struct: `key` (String), `name` (String), `color` (String), `keywords` ([String])
- [ ] Build succeeds

### US-002: Category Definitions & Auto-Categorization

**Description:** As a developer, I need the 12 default category definitions and the auto-categorization algorithm in Swift so new items can be automatically categorized.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] `CategoryDefinitions` enum/struct contains all 12 default categories with keys, display names, colors, and keyword arrays matching the React implementation exactly
- [ ] `categorizeItem(_ name: String, categories: [CategoryDef]?)` function implements 3-pass matching: exact → multi-word phrase → single-word fallback → `"other"`
- [ ] When `categories` parameter is nil or empty, uses the 12 defaults
- [ ] When `categories` are provided (from a store), uses those instead
- [ ] Case-insensitive matching
- [ ] `categorizeItem("Banana")` → `"produce"`
- [ ] `categorizeItem("Frozen Pizza")` → `"frozen"` (multi-word match)
- [ ] `categorizeItem("XYZ Widget")` → `"other"` (no match)
- [ ] Build succeeds

### US-003: ItemService — CRUD Operations

**Description:** As a developer, I need a service layer for item CRUD so view models can perform all item operations through a clean API.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] `ItemService` class with methods:
  - `fetchItems(listId:)` → `[Item]` ordered by `added_at` ascending
  - `addItem(listId:, name:, category:, storeId:)` → `Item` (inserts row, returns created item)
  - `updateItem(itemId:, updates:)` (partial update — name, category, isChecked, storeId, quantity, price, imageUrl)
  - `toggleItem(itemId:, isChecked:)` (convenience wrapper for check/uncheck)
  - `deleteItem(itemId:)` (single delete)
  - `deleteItems(itemIds:)` (batch delete for "clear checked")
  - `restoreItem(listId:, itemData:)` → `Item` (re-insert for undo)
- [ ] `addItem` capitalizes the first letter of the name (matching React behavior)
- [ ] `addItem` auto-categorizes using `categorizeItem()` with the store's categories if `storeId` is provided
- [ ] All methods use `SupabaseManager.shared.client`
- [ ] All methods throw descriptive errors on failure
- [ ] Does NOT manually update `item_count` (triggers handle it)
- [ ] Build succeeds

### US-004: HistoryService — Autocomplete Data

**Description:** As a developer, I need a service to fetch and write item history so the add-item form can offer autocomplete suggestions.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] `HistoryService` class with methods:
  - `fetchHistory(userId:)` → `[HistoryEntry]` ordered by `added_at` ascending
  - `addHistoryEntry(userId:, name:)` (insert single entry)
  - `addHistoryEntries(userId:, names:)` (batch insert)
- [ ] `subscribeHistory(userId:)` → realtime subscription (Postgres changes on `history` table, filtered by `user_id`), calls a callback or publishes to an `AsyncStream` on any change, triggering a re-fetch
- [ ] Deduplicated unique names computed from history (case-insensitive, sorted alphabetically) — a computed property or helper
- [ ] Build succeeds

### US-005: StoreService — Read-Only for Grouping

**Description:** As a developer, I need to fetch the user's stores so items can be grouped by store in the list view. Full store CRUD is Phase 4 — this is read-only.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] `StoreService` class with methods:
  - `fetchStores(userId:)` → `[Store]` ordered by `sort_order` ascending
  - `subscribeStores(userId:)` → realtime subscription (Postgres changes on `stores` table, filtered by `user_id`), triggers re-fetch on any change
- [ ] Store's `categories` jsonb decoded into `[CategoryDef]` array
- [ ] If a store has an empty `categories` array, treat it as "use defaults"
- [ ] Build succeeds

### US-006: ListDetailViewModel — @Observable State + Realtime

**Description:** As a developer, I need a view model that manages the item list state for a single list, including realtime updates, store data, and history.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] `ListDetailViewModel` is `@Observable`
- [ ] Published properties: `items: [Item]`, `stores: [Store]`, `history: [HistoryEntry]`, `isLoading: Bool`, `error: String?`
- [ ] Computed properties:
  - `uncheckedItems: [Item]` (items where `isChecked == false`)
  - `checkedItems: [Item]` (items where `isChecked == true`)
  - `groupedByStore: [(store: Store?, items: [Item])]` — groups unchecked items by `storeId`. Items with no store or unknown store go into an "Unassigned" group. Store order follows `sort_order`.
  - `uniqueHistoryNames: [String]` — deduplicated, alphabetically sorted names from history
- [ ] `groupByCategory(_ items: [Item], store: Store?) -> [(category: CategoryDef, items: [Item])]` — groups items by category using the store's custom categories (or defaults). Uncategorized items go into "Other". Category order follows the category array order.
- [ ] On init with `listId` and `userId`: fetches items, stores, history; sets up realtime subscriptions for all three
- [ ] Realtime: on any Postgres change to `items` (filtered by `list_id`), re-fetches all items
- [ ] Realtime: on any Postgres change to `stores` (filtered by `user_id`), re-fetches all stores
- [ ] Realtime: on any Postgres change to `history` (filtered by `user_id`), re-fetches all history
- [ ] Action methods delegate to `ItemService` and `HistoryService`:
  - `addItem(name:, storeId:)` — calls `ItemService.addItem` + `HistoryService.addHistoryEntry`
  - `toggleItem(_ item: Item)` — calls `ItemService.toggleItem`
  - `deleteItem(_ item: Item)` — calls `ItemService.deleteItem`, pushes to `UndoManager`
  - `updateItem(_ itemId: UUID, updates:)` — calls `ItemService.updateItem`
  - `clearChecked()` — calls `ItemService.deleteItems` for all checked item IDs, pushes to `UndoManager`
  - `restoreItem(listId:, itemData:)` — calls `ItemService.restoreItem`
- [ ] Cleans up all realtime subscriptions on deinit
- [ ] Build succeeds

### US-007: Add Item Bar — Bottom Input with Autocomplete

**Description:** As a user, I want a text field at the bottom of the list to quickly add items, with suggestions from my past items, so adding groceries is fast.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] Sticky input bar pinned to the bottom of the screen (above the safe area / home indicator)
- [ ] Text field with placeholder "Add an item..."
- [ ] As user types, `.searchSuggestions` modifier shows matching items from history (case-insensitive substring match)
- [ ] Tapping a suggestion fills the text field with that name
- [ ] "Add" button (or return key) submits: creates item, adds history entry, clears text field
- [ ] If stores exist, show a store picker (compact menu or segmented control) next to the input so user can optionally assign a store on add
- [ ] New item auto-categorized based on name + selected store's categories
- [ ] Item name capitalized (first letter uppercase)
- [ ] Empty input: "Add" button disabled, return key does nothing
- [ ] Input field remains focused after adding (for rapid entry of multiple items)
- [ ] Build succeeds
- [ ] Verify on device/simulator

### US-008: Item List View — Store + Category Grouping

**Description:** As a user, I want to see my items organized by store and then by category so I can shop efficiently aisle by aisle.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] List view shows unchecked items grouped by store (if stores exist), then by category within each store
- [ ] Each store section has a header showing store name with colored dot, item count, and a collapse/expand chevron
- [ ] Tapping a store header collapses/expands that section
- [ ] Items without a store appear in an "Unassigned" section (or directly by category if no stores exist at all)
- [ ] Within each store (or the flat list), items are grouped by category. Category header shows: colored dot, category name, item count
- [ ] Each item row shows: item name, quantity badge (if qty > 1, show "(qty)"), store badge (colored pill), category badge (colored pill), price (if set, formatted as "$X.XX")
- [ ] Double-tap on an item row toggles checked/unchecked
- [ ] Checked items appear in a separate "Checked (N)" section at the bottom of the list
- [ ] "Clear checked" button in the checked section header — taps shows confirmation alert, then deletes all checked items
- [ ] Empty state: "Your list is empty." with hint "Add items below."
- [ ] Pull-to-refresh triggers a full re-fetch of items
- [ ] Build succeeds
- [ ] Verify on device/simulator

### US-009: Item Context Menu — Long-Press Edit

**Description:** As a user, I want to long-press an item to edit its details so I can change the name, quantity, price, store, or category without leaving the list.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] Long-press on any item row shows a native iOS context menu
- [ ] Context menu sections:
  - **Edit Name:** Opens an alert with a text field pre-filled with current name. Save updates the item name.
  - **Quantity:** Shows stepper-style options: "−" (decrease, min 1), current value displayed, "+" (increase). Or: submenu with 1–10 + "Custom..." option.
  - **Price:** Opens an alert with a numeric text field. Pre-filled with current price (or empty). Save updates price. "Remove Price" option if price is set.
  - **Store:** Submenu listing all stores + "No store". Selecting a store updates `storeId`. Current store shown with checkmark.
  - **Category:** Submenu listing all categories (from assigned store or defaults) + "No category". Current category shown with checkmark. Selecting updates `category`.
  - **Delete:** Red destructive button. Deletes item immediately (no confirmation for single item — undo via shake covers it).
- [ ] All changes persist immediately via `ItemService.updateItem`
- [ ] When store changes, item is re-categorized automatically (if no manual category was set? or always? — match React: always keeps existing category unless user explicitly changes it)
- [ ] Build succeeds
- [ ] Verify on device/simulator

### US-010: Swipe-to-Delete with `.swipeActions`

**Description:** As a user, I want to swipe left on an item to quickly delete it, using the standard iOS gesture I'm familiar with.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] Swipe left on any item row reveals a red "Delete" action (using `.swipeActions(edge: .trailing)`)
- [ ] Tapping the delete action removes the item from the list
- [ ] Deletion pushes an undo action to `UndoManager` (restored in US-011)
- [ ] Row animates out on delete (SwiftUI default List animation)
- [ ] Swipe works on both unchecked and checked items
- [ ] Build succeeds
- [ ] Verify on device/simulator

### US-011: Shake-to-Undo via UndoManager

**Description:** As a user, I want to shake my phone to undo the last delete so I can recover items I removed by accident.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] When an item is deleted (swipe or context menu), register an undo action with the view's `UndoManager`
- [ ] When checked items are cleared, register a single undo action that restores all cleared items
- [ ] Shaking the device triggers the iOS system "Undo" alert ("Undo Delete Item?")
- [ ] Confirming undo calls `ItemService.restoreItem` (or `restoreItems` for batch) to re-insert the item(s) with original data (name, category, isChecked, store, quantity, price, imageUrl)
- [ ] Restored items appear back in the list (realtime subscription picks them up)
- [ ] Undo stack depth: at least the last action (iOS `UndoManager` supports multi-level undo natively)
- [ ] If no undo actions are available, shake does nothing (no empty alert)
- [ ] Build succeeds
- [ ] Verify on device/simulator

### US-012: Realtime Sync — Cross-Device Verification

**Description:** As a user, I want changes made on the web app (or another device) to appear on my phone in real-time so my list is always current.

**Documentation:** No  
**Tools:** No  
**Considerations:** none

**Acceptance Criteria:**

- [ ] Adding an item on the React PWA appears on the Swift app within ~2 seconds (without manual refresh)
- [ ] Checking/unchecking an item on one client reflects on the other
- [ ] Deleting an item on one client removes it on the other
- [ ] Editing item details (name, qty, price, store, category) on one client updates the other
- [ ] Creating a new store on the React PWA updates the store grouping on the Swift app
- [ ] Pull-to-refresh works as a manual fallback
- [ ] Realtime subscription reconnects after app returns from background
- [ ] Build succeeds
- [ ] Verify on device/simulator with two clients

## Functional Requirements

- FR-1: The app must display all items for the active list, grouped by store (if stores exist) then by category within each store/section.
- FR-2: Unchecked items appear at the top; checked items appear in a collapsible "Checked" section at the bottom.
- FR-3: The add-item input must be pinned to the bottom of the screen for thumb-friendly access.
- FR-4: Autocomplete suggestions must appear as the user types, sourced from the `history` table (deduplicated, case-insensitive).
- FR-5: New items must be auto-categorized using the 3-pass keyword matching algorithm, respecting per-store category customizations.
- FR-6: New item names must be capitalized (first letter uppercase).
- FR-7: Double-tap on an item row must toggle its checked state.
- FR-8: Swiping left on an item row must reveal a red delete action (native `.swipeActions`).
- FR-9: Long-pressing an item must show a context menu with edit options for name, quantity, price, store, category, and delete.
- FR-10: All deletions (single item, clear checked) must be undoable via iOS shake gesture using `UndoManager`.
- FR-11: Realtime subscriptions on `items`, `stores`, and `history` tables must keep the view in sync across devices.
- FR-12: The app must NOT manually update `item_count` on the `lists` table (database triggers manage this).
- FR-13: A "Clear checked" button must appear in the checked section header, with a confirmation alert before deleting.

## Non-Goals

- Item images / image picker (Phase 7 — `imageUrl` field exists but is not surfaced in UI yet)
- Store CRUD UI (Phase 4) — stores are read-only for grouping purposes in this phase
- AI-powered item suggestions (Phase 8)
- Price subtotals per store section
- Drag-to-reorder items within a list
- Offline support / local caching (items are always fetched from Supabase)
- iPad-specific layouts

## Technical Considerations

- **Framework:** SwiftUI (iOS 17+)
- **State Management:** `@Observable` (Observation framework)
- **Networking:** Supabase Swift SDK v2.x — PostgREST for CRUD, Realtime for subscriptions
- **UndoManager:** Use SwiftUI's `@Environment(\.undoManager)` to access the view's undo manager. Register undo actions with descriptive action names.
- **Realtime pattern:** Mirror the React approach — subscribe to Postgres changes, re-fetch entire dataset on any event. Do NOT try to apply incremental updates from change payloads.
- **Category data:** Embed the 12 default categories as a static array in Swift. Store categories are decoded from the `categories` jsonb column.
- **Decimal handling:** Use `Decimal` type for `price` to avoid floating-point issues. Format with `NumberFormatter` (currency style, 2 decimal places).
- **Memory management:** Ensure realtime channel subscriptions are removed in `deinit` to prevent leaks.

## Definition of Done

Phase 3 is complete when:

1. All 12 stories pass their acceptance criteria
2. A user can tap into a list from the Phase 2 browser and see all items grouped by store → category
3. A user can add items with autocomplete, and items auto-categorize correctly
4. Double-tap toggles checked state; checked items sink to the bottom
5. Swipe-left deletes items; shake undoes the last deletion
6. Long-press context menu allows editing all item fields
7. Changes made on the React PWA appear in the Swift app in real-time (and vice versa)
8. No regressions in Phase 1 (auth) or Phase 2 (list browser) functionality
9. Build succeeds with no warnings related to this phase's code
10. Tested on iPhone simulator (iOS 17+)

## Success Metrics

- Item add-to-list takes ≤ 2 taps (type name + tap Add / return key)
- Realtime sync latency under 3 seconds between React and Swift clients
- Shake-to-undo successfully restores deleted items
- All 12 category auto-assignments match the React implementation's results for the same input

## Open Questions

- Should changing an item's store automatically re-categorize it? (React keeps the existing category when store changes — recommend matching this behavior)
- Should we show store-level price subtotals? (React has this but it's low-priority — recommending deferral)
- When history grows large (1000+ entries), should we limit autocomplete suggestions to the most recent N? (React doesn't — monitor performance)
