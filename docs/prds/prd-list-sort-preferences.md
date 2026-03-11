# PRD: List Item Sort Preferences

## Introduction

Users currently have no control over how items are organized within a shopping list. The fixed Store → Category grouping works well for in-store shopping but doesn't suit every workflow. Some users want a simple alphabetical view when building a list, or a category-only view when they shop at a single store.

This feature adds configurable sort modes with a global default and optional per-list overrides, synced across devices via Supabase.

## Sort Modes

| Mode | Key | Behavior |
|------|-----|----------|
| Store → Category | `store-category` | Group by store (in store `sort_order`), then by category within each store (in store's category order). **Default.** |
| Category Only | `category` | Group by category (default category order), ignoring store assignment. |
| Alphabetical | `alpha` | Flat A–Z list by item name. No grouping headers. |
| Date Added | `date-added` | Flat list sorted by `added_at` descending (newest first). No grouping headers. |

All modes keep checked items at the bottom, separated from unchecked items (preserving current behavior).

## Preference Hierarchy

1. **Per-list override** (if set) takes priority
2. **Global default** (user-level) applies to all lists without an override
3. **System default** (`store-category`) applies when no preference exists

## User Stories

### US-001: User Preferences Table

**Description:** As a developer, I need a `user_preferences` table in Supabase so sort preferences (and future preferences) can be stored server-side and synced across devices.

**Acceptance Criteria:**
- [ ] New migration creates `user_preferences` table with columns: `user_id` (uuid PK, FK to auth.users), `default_sort_mode` (text, default `'store-category'`), `created_at`, `updated_at`
- [ ] RLS policies: users can only read/update their own row
- [ ] A trigger or application logic upserts a row on first access (no row required at signup — handle missing row gracefully)

### US-002: Per-List Sort Override Column

**Description:** As a developer, I need a `sort_mode` column on the `lists` table so individual lists can override the global default.

**Acceptance Criteria:**
- [ ] New migration adds `sort_mode` (text, nullable, default NULL) to `lists` table
- [ ] NULL means "use global default" — no data migration needed
- [ ] Existing RLS policies on `lists` continue to work without modification

### US-003: Preference Service Layer (React)

**Description:** As a developer, I need service functions to read/write sort preferences from Supabase on the React web app.

**Acceptance Criteria:**
- [ ] `getUserPreferences(userId)` — fetches or returns defaults if no row exists
- [ ] `updateDefaultSortMode(userId, mode)` — upserts the global default
- [ ] `updateListSortMode(listId, mode)` — sets per-list override (null to clear)
- [ ] `getEffectiveSortMode(listId)` — resolves per-list override → global default → system default

### US-004: Preference Service Layer (Swift iOS)

**Description:** As a developer, I need service functions to read/write sort preferences from Supabase on the iOS app.

**Acceptance Criteria:**
- [ ] `PreferenceService` with `fetchUserPreferences()`, `updateDefaultSortMode(_:)`, `updateListSortMode(listId:mode:)`, `effectiveSortMode(for:)` methods
- [ ] Graceful handling when no `user_preferences` row exists (use system defaults)
- [ ] Preferences cached locally so repeated reads don't hit the network

### US-005: Sort Logic — Category Only Mode (React)

**Description:** As a user, I want to sort my list by category only so I can see all items grouped by category regardless of store.

**Acceptance Criteria:**
- [ ] Items grouped by category using default category order (from `categories.js`)
- [ ] Items with no category fall under "Other" group at the end
- [ ] Within each category, items appear in `added_at` ascending order
- [ ] Checked items remain at the bottom, ungrouped

### US-006: Sort Logic — Alphabetical Mode (React)

**Description:** As a user, I want to sort my list alphabetically so I can quickly scan for items by name.

**Acceptance Criteria:**
- [ ] Items displayed in a flat list sorted A–Z by `name` (case-insensitive)
- [ ] No grouping headers
- [ ] Checked items remain at the bottom, also sorted A–Z

### US-007: Sort Logic — Date Added Mode (React)

**Description:** As a user, I want to sort my list by date added so I can see my most recently added items first.

**Acceptance Criteria:**
- [ ] Items displayed in a flat list sorted by `added_at` descending (newest first)
- [ ] No grouping headers
- [ ] Checked items remain at the bottom, sorted by most recently checked or `added_at` descending

### US-008: Sort Logic — All Modes (Swift iOS)

**Description:** As a user, I want the same four sort modes available on the iOS app.

**Acceptance Criteria:**
- [ ] `ListDetailViewModel` computed properties support all four modes: `store-category`, `category`, `alpha`, `date-added`
- [ ] Grouping behavior matches React web exactly for each mode
- [ ] Checked items remain at the bottom in all modes

### US-009: Sort Picker in List View (React)

**Description:** As a user, I want a sort control in the list header so I can quickly change how the current list is sorted.

**Acceptance Criteria:**
- [ ] Sort icon button (e.g., arrow-up-down icon) visible in the list header area
- [ ] Tapping opens a popover/dropdown showing the four sort options with the current selection indicated
- [ ] Selecting an option immediately applies the sort and persists as a per-list override
- [ ] An option to "Use default" clears the per-list override
- [ ] Works on both mobile and desktop layouts

### US-010: Sort Picker in List View (Swift iOS)

**Description:** As a user, I want a sort control in the iOS list detail view so I can quickly change how the current list is sorted.

**Acceptance Criteria:**
- [ ] Sort button in the navigation bar or list header
- [ ] Tapping presents a menu/sheet with the four sort options and current selection indicated
- [ ] Selecting an option applies the sort and persists as a per-list override
- [ ] "Use default" option clears the per-list override
- [ ] Uses native iOS patterns (e.g., `Menu` with `Picker` or action sheet)

### US-011: Default Sort in Settings (React)

**Description:** As a user, I want to set my preferred default sort mode in Settings so all lists use it unless I override one specifically.

**Acceptance Criteria:**
- [ ] New "Display" section in MobileSettings (and desktop settings area) with a "Default Sort" picker
- [ ] Shows the four sort options with the current global default selected
- [ ] Changing the selection updates `user_preferences.default_sort_mode` in Supabase
- [ ] Change takes effect immediately on all lists that don't have a per-list override

### US-012: Default Sort in Settings (Swift iOS)

**Description:** As a user, I want to set my preferred default sort mode in the iOS Settings view.

**Acceptance Criteria:**
- [ ] New "Display" section in SettingsView with a "Default Sort" picker
- [ ] Uses native segmented control or picker with the four sort options
- [ ] Current global default is pre-selected
- [ ] Changing the selection updates `user_preferences.default_sort_mode` in Supabase
- [ ] Change takes effect immediately on all lists without a per-list override

### US-013: Realtime Sync for Preferences

**Description:** As a user, I want my sort preference changes to sync across my devices so I see the same sort mode everywhere.

**Acceptance Criteria:**
- [ ] When the global default is changed on one device, other active sessions pick it up (via Supabase realtime subscription or re-fetch on focus)
- [ ] When a per-list override is changed, other devices viewing that list see the updated sort
- [ ] No full page reload required — sort updates reactively

## Technical Considerations

- **`user_preferences` is a new table** — this is the first server-synced preference. Design the table to be extensible for future preferences (e.g., `default_theme`, `collapsed_sections`, etc.) by keeping it as a single row per user with typed columns rather than a key-value store.
- **Existing `ShoppingList.jsx` grouping logic** (lines 167–260) needs to be refactored to support multiple grouping strategies. Consider extracting grouping into a utility function that takes `(items, sortMode, stores, categories) → groupedItems`.
- **Existing `ListDetailViewModel.swift`** computed properties (`groupedByStore`, `groupByCategory`) need equivalent refactoring.
- **Migration safety**: The `sort_mode` column on `lists` is nullable with no default, so existing lists are unaffected. The `user_preferences` table is new and opt-in.
- **The `lists` table already has realtime subscriptions** in both platforms, so per-list `sort_mode` changes will propagate automatically through existing channels.
- **Category order for "Category Only" mode**: Use the default category order from `categories.js` / `CategoryDefinitions.swift`. If the user has custom categories on a store, those won't apply in category-only mode since there's no store context.

## Credential & Service Access Plan

No external credentials required for this PRD. All data is stored in the existing Supabase instance.

## Definition of Done

- [ ] `user_preferences` table exists in Supabase with RLS policies
- [ ] `lists.sort_mode` column exists (nullable)
- [ ] All four sort modes render correctly on React web (store-category, category, alpha, date-added)
- [ ] All four sort modes render correctly on iOS (same four modes, matching behavior)
- [ ] Sort picker in list header works on React (mobile + desktop) and iOS
- [ ] Default sort picker in Settings works on React and iOS
- [ ] Changing default on one device syncs to other devices
- [ ] Per-list overrides take priority over the global default
- [ ] Checked items remain at the bottom in all modes
- [ ] No regression in existing store-category grouping behavior
