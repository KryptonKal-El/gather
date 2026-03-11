# PRD: List Item Sort Preferences

## Introduction

Users currently have no control over how items are organized within a shopping list. The fixed Store → Category grouping works well for in-store shopping but doesn't suit every workflow. Some users want a category-only view when shopping at a single store, or a simple alphabetical list when building a list at home.

This feature replaces the fixed sort with a **configurable 3-level sort pipeline**. Users choose up to 3 sort levels from four options — Store, Category, Item Name, and Date Added — and arrange them in any order. The system default remains Store → Category → Item Name (ascending), preserving the current experience. Preferences are stored in Supabase and sync across devices, with a global default and optional per-list overrides.

## Sort Pipeline Model

### Sort Levels

| Level Key | Display Name | Behavior | Fixed Direction |
|-----------|-------------|----------|-----------------|
| `store` | Store | Groups items by store in the user's store `sort_order`. Items with no store go to an "Unassigned" group at the end. | Store sort_order ASC |
| `category` | Category | Groups items by category using the store's category order (if under a store group) or the default category order. "Other" category at the end. | Category order ASC |
| `name` | Item Name | Sorts items alphabetically by name (case-insensitive). | A–Z |
| `date` | Date Added | Sorts items by `added_at` timestamp. | Newest first |

### How Levels Compose

- **Level 1** creates the top-level groups with **section headers**.
- **Level 2** creates sub-groups within each Level 1 group with **sub-headers**.
- **Level 3** determines the **sort order** within the lowest group — no headers.
- Levels are optional: a user can set 1, 2, or 3 levels.
- Each option can only be used once across all levels.
- If no levels are set, the system default applies.

### System Default

```
Level 1: Store
Level 2: Category
Level 3: Item Name
```

This matches the current behavior exactly — no change for existing users.

### Example Configurations

| Configuration | Result |
|---------------|--------|
| Store → Category → Name | Current behavior + alphabetical within each category (system default) |
| Category → Name | All items grouped by category (no store grouping), alphabetical within each |
| Name | Flat A–Z list, no grouping headers |
| Date | Flat list, newest items first |
| Store → Name | Grouped by store, alphabetical within each store (no category sub-groups) |
| Category → Store → Date | Grouped by category, sub-grouped by store, newest first within each |

### Checked Items

All configurations keep checked items in a separate section at the bottom. Checked items follow the same sort pipeline as unchecked items.

## Data Model

### Sort Configuration Format

Sort configuration is stored as a JSON array of level keys:

```json
["store", "category", "name"]   // System default
["category", "name"]            // Category-first, alphabetical
["name"]                        // Simple A–Z
[]                              // Empty = use system default
```

### Preference Hierarchy

1. **Per-list override** (`lists.sort_config`, if non-null) takes priority
2. **Global default** (`user_preferences.default_sort_config`) applies to all lists without an override
3. **System default** (`["store", "category", "name"]`) applies when no preference exists

## User Stories

### US-001: User Preferences Table

**Description:** As a developer, I need a `user_preferences` table in Supabase so sort preferences (and future preferences) can be stored server-side and synced across devices.

**Acceptance Criteria:**
- [ ] New migration creates `user_preferences` table with columns: `user_id` (uuid PK, FK to auth.users), `default_sort_config` (jsonb, default `'["store", "category", "name"]'`), `created_at`, `updated_at`
- [ ] RLS policies: users can only read/update their own row
- [ ] Handle missing row gracefully in application logic (no row = system default)

### US-002: Per-List Sort Config Column

**Description:** As a developer, I need a `sort_config` column on the `lists` table so individual lists can override the global default.

**Acceptance Criteria:**
- [ ] New migration adds `sort_config` (jsonb, nullable, default NULL) to `lists` table
- [ ] NULL means "use global default" — no data migration needed
- [ ] Existing RLS policies on `lists` continue to work without modification

### US-003: Sort Pipeline Engine (React)

**Description:** As a developer, I need a sort engine that takes a list of items and a sort config and returns grouped/sorted items for rendering.

**Acceptance Criteria:**
- [ ] Utility function `applySortPipeline(items, sortConfig, stores, categories)` returns a nested structure: `{ groups: [{ key, label, subGroups: [{ key, label, items }] }] }` (depth matches number of grouping levels)
- [ ] Level 1 produces top-level groups with headers
- [ ] Level 2 produces sub-groups within Level 1 groups with sub-headers
- [ ] Level 3 sorts items within the lowest group (no headers)
- [ ] With only 1 level that is `name` or `date`, returns a flat sorted list (no groups)
- [ ] Works for all valid combinations of 1–3 levels from the 4 options
- [ ] Falls back to system default `["store", "category", "name"]` for empty or invalid config

### US-004: Sort Pipeline Engine (Swift iOS)

**Description:** As a developer, I need the same sort pipeline engine for the iOS app.

**Acceptance Criteria:**
- [ ] `SortPipeline` utility with `apply(items:config:stores:categories:)` method returning a nested grouped structure
- [ ] Same grouping/sorting behavior as the React implementation for all valid configurations
- [ ] Level 1 = section headers, Level 2 = sub-headers, Level 3 = sort within lowest group
- [ ] Falls back to system default for empty or invalid config

### US-005: Preference Service Layer (React)

**Description:** As a developer, I need service functions to read/write sort preferences from Supabase on the React web app.

**Acceptance Criteria:**
- [ ] `getUserPreferences(userId)` — fetches user_preferences row or returns defaults if no row exists
- [ ] `updateDefaultSortConfig(userId, config)` — upserts the global default sort config
- [ ] `updateListSortConfig(listId, config)` — sets per-list sort config override (null to clear)
- [ ] `getEffectiveSortConfig(list, userPreferences)` — resolves per-list → global → system default

### US-006: Preference Service Layer (Swift iOS)

**Description:** As a developer, I need service functions to read/write sort preferences from Supabase on the iOS app.

**Acceptance Criteria:**
- [ ] `PreferenceService` with `fetchUserPreferences()`, `updateDefaultSortConfig(_:)`, `updateListSortConfig(listId:config:)`, `effectiveSortConfig(for:userPreferences:)` methods
- [ ] Graceful handling when no `user_preferences` row exists (use system defaults)
- [ ] Preferences cached locally so repeated reads don't hit the network

### US-007: Wire Sort Pipeline into ShoppingList (React)

**Description:** As a developer, I need to replace the existing hardcoded Store → Category grouping in `ShoppingList.jsx` with the sort pipeline engine, driven by the effective sort config for the current list.

**Acceptance Criteria:**
- [ ] `ShoppingList.jsx` calls `applySortPipeline()` with the effective sort config instead of the current hardcoded grouping logic
- [ ] Renders section headers for Level 1 groups, sub-headers for Level 2 groups
- [ ] Flat sort modes (single level `name` or `date`) render without any group headers
- [ ] Existing collapse/expand behavior for store sections still works when `store` is Level 1
- [ ] Checked items section at the bottom uses the same sort pipeline
- [ ] With system default config `["store", "category", "name"]`, output is identical to the current behavior
- [ ] Verify in browser

### US-008: Wire Sort Pipeline into ListDetailView (Swift iOS)

**Description:** As a developer, I need to replace the existing hardcoded grouping in `ListDetailViewModel` with the sort pipeline engine, driven by the effective sort config.

**Acceptance Criteria:**
- [ ] `ListDetailViewModel` uses `SortPipeline.apply()` with the effective sort config
- [ ] `ListDetailView` renders section headers for Level 1, sub-headers for Level 2
- [ ] Flat sort modes render as plain lists without section headers
- [ ] Existing collapse/expand behavior works when `store` is Level 1
- [ ] Checked items section uses the same sort pipeline
- [ ] With system default config, output is identical to current behavior

### US-009: Sort Picker UI (React)

**Description:** As a user, I want a sort picker in the list header where I can configure the sort levels by adding, removing, and reordering them.

**Acceptance Criteria:**
- [ ] Sort icon button in the list header area (both mobile and desktop)
- [ ] Tapping opens a popover/sheet showing the current sort levels as an ordered list
- [ ] Each level row has a drag handle (☰) to reorder and an ✕ button to remove
- [ ] An "+ Add Level" button shows a picker with the remaining unused options
- [ ] A "Use Default" button clears the per-list override (reverts to global default)
- [ ] Changes persist immediately as a per-list override via `updateListSortConfig()`
- [ ] The list re-sorts in real time as levels are added/removed/reordered
- [ ] Maximum 3 levels; "+ Add Level" hidden when 3 are set
- [ ] Each option can only appear once across all levels
- [ ] Verify in browser

### US-010: Sort Picker UI (Swift iOS)

**Description:** As a user, I want a sort picker in the iOS list detail view where I can configure the sort levels.

**Acceptance Criteria:**
- [ ] Sort button in the navigation bar or toolbar
- [ ] Tapping presents a sheet showing the current sort levels as a reorderable list
- [ ] Each level row has drag-to-reorder and a delete action (swipe or button)
- [ ] An "Add Level" button shows remaining unused options
- [ ] A "Use Default" button clears the per-list override
- [ ] Changes persist immediately via `updateListSortConfig()`
- [ ] The list re-sorts in real time
- [ ] Maximum 3 levels; each option used only once
- [ ] Uses native iOS patterns (e.g., `EditMode`, `onMove`, `onDelete`)

### US-011: Default Sort Config in Settings (React)

**Description:** As a user, I want to configure my default sort levels in Settings so all lists use my preferred sort unless I override one specifically.

**Acceptance Criteria:**
- [ ] New "Display" section in MobileSettings (and desktop settings area)
- [ ] Shows a "Default Sort" control with the same level-based UI as the list sort picker (drag to reorder, add/remove levels)
- [ ] Current global default is pre-populated
- [ ] Changes update `user_preferences.default_sort_config` in Supabase
- [ ] Change takes effect immediately on all lists without a per-list override
- [ ] Verify in browser

### US-012: Default Sort Config in Settings (Swift iOS)

**Description:** As a user, I want to configure my default sort levels in the iOS Settings view.

**Acceptance Criteria:**
- [ ] New "Display" section in SettingsView
- [ ] Same level-based sort config UI as the list sort picker
- [ ] Current global default is pre-populated
- [ ] Changes update `user_preferences.default_sort_config` in Supabase
- [ ] Change takes effect immediately on all lists without a per-list override

### US-013: Realtime Sync for Preferences

**Description:** As a user, I want my sort preference changes to sync across my devices so I see the same sort configuration everywhere.

**Acceptance Criteria:**
- [ ] When the global default is changed on one device, other active sessions pick it up (via Supabase realtime subscription or re-fetch on focus)
- [ ] When a per-list override is changed, other devices viewing that list see the updated sort (per-list config travels through the existing `lists` realtime channel)
- [ ] No full page reload required — sort updates reactively

## Technical Considerations

- **`user_preferences` is a new table** — this is the first server-synced preference. Design the table to be extensible for future preferences (e.g., `default_theme`, `collapsed_sections`) by keeping it as a single row per user with typed columns rather than a key-value store.
- **Sort config is JSONB** — stored as a JSON array of strings (e.g., `["store", "category", "name"]`). Validate on write that values are from the allowed set and no duplicates.
- **Existing `ShoppingList.jsx` grouping logic** (lines 167–260) will be replaced entirely by the sort pipeline engine. The pipeline should be a pure utility function for testability.
- **Existing `ListDetailViewModel.swift`** computed properties (`groupedByStore`, `groupByCategory`) will be replaced by `SortPipeline.apply()`.
- **Migration safety**: The `sort_config` column on `lists` is nullable JSONB, so existing lists are unaffected. The `user_preferences` table is new with no required rows.
- **The `lists` table already has realtime subscriptions** in both platforms, so per-list `sort_config` changes will propagate automatically through existing channels.
- **Category order context**: When `category` is used as a level under `store`, use the store's custom category order. When `category` is Level 1 (no store context), use the default category order from `categories.js` / `CategoryDefinitions.swift`.
- **Rendering depth**: The component tree needs to handle variable nesting depth (0, 1, or 2 levels of grouping). Consider a recursive `SortGroup` component or a flat list with indentation based on group depth.

## Credential & Service Access Plan

No external credentials required for this PRD. All data is stored in the existing Supabase instance.

## Definition of Done

- [ ] `user_preferences` table exists in Supabase with RLS policies and `default_sort_config` JSONB column
- [ ] `lists.sort_config` JSONB column exists (nullable)
- [ ] Sort pipeline engine works correctly for all valid 1–3 level combinations on both platforms
- [ ] System default `["store", "category", "name"]` produces identical output to the previous hardcoded behavior
- [ ] Sort picker with drag-to-reorder, add/remove levels works in React list view (mobile + desktop)
- [ ] Sort picker with equivalent UX works in iOS list detail view
- [ ] Default sort config editor works in React Settings and iOS Settings
- [ ] Per-list overrides take priority over the global default
- [ ] Changes sync across devices via Supabase
- [ ] Checked items remain at the bottom in all configurations
- [ ] No regression in existing store-category grouping behavior for users who never touch sort settings
