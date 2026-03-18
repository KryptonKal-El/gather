# PRD: List Category Management

## Introduction

Currently, categories are split across two systems:

- **Grocery lists** use store-level categories. Each store has its own `categories` JSONB column, and items assigned to a store use that store's categories. Items without a store fall back to hardcoded `DEFAULT_CATEGORIES`.
- **Packing/To-Do lists** use hardcoded type-level categories (`PACKING_CATEGORIES`, `TODO_CATEGORIES`) with no customization.
- **Basic, Guest List, Project** lists don't use categories at all.

This PRD unifies categories onto lists and introduces user-level defaults:

1. **Move categories from stores to lists.** Every list that supports categories gets its own `categories` JSONB column. The store `categories` column is removed — stores become a pure label/grouping concept.
2. **User-level default categories per list type.** Users can customize what categories new lists start with, seeded from the current system defaults.
3. **Per-list category editing.** Each list's categories can be customized independently via a new "Edit Categories" option in the list menu.
4. **"Save as Default" action.** After editing a list's categories, users can promote them to their default for that list type.

## Goals

- Unify categories onto a single entity (lists) — eliminate the split between store categories and type-level hardcoded categories
- Let users personalize default categories for each list type (Grocery, Packing, To-Do)
- Let users edit categories on any individual list (add, remove, rename, reorder, change color, edit keywords)
- Provide a "Save as Default" button on per-list category editing with confirmation
- Migrate existing store category customizations to lists and user defaults
- Remove category management from stores entirely
- Support both React web and Swift iOS platforms
- Anyone with access to a shared list can edit its categories

## User Stories

### US-001: Database — Add categories column to lists table

**Description:** As a developer, I need to store per-list categories so each list can have its own customized set.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Migration adds `categories` JSONB column to `lists` table, default `NULL`
- [ ] `NULL` means "use system defaults for the list type" (transitional state before migration populates them)
- [ ] JSONB schema matches existing category format: `[{key, name, color, keywords}]`
- [ ] Migration runs successfully against existing data
- [ ] Lint passes

### US-002: Database — Create user_category_defaults table

**Description:** As a developer, I need to store user-level default categories per list type so new lists can inherit personalized defaults.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Migration creates `user_category_defaults` table with columns: `id` (uuid PK), `user_id` (uuid FK → auth.users), `list_type` (text), `categories` (JSONB), `created_at`, `updated_at`
- [ ] Unique constraint on `(user_id, list_type)`
- [ ] RLS enabled: users can only read/write their own rows
- [ ] `updated_at` trigger reuses existing `set_updated_at()` function
- [ ] Table added to realtime publication
- [ ] Migration runs successfully
- [ ] Lint passes

### US-003: Database — Migrate store categories to lists and user defaults

**Description:** As a developer, I need to migrate existing store category customizations so users don't lose their work when categories move off stores.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Migration runs after US-001 and US-002 migrations
- [ ] For each user who has stores with customized categories (non-empty, differs from system defaults):
  - Take the store with the most categories (or first by sort_order if tied)
  - Insert that store's categories into `user_category_defaults` for list_type `grocery`
- [ ] For each existing Grocery list where `categories` is NULL:
  - If the list owner has a `user_category_defaults` row for `grocery`, copy those categories onto the list
  - Otherwise, copy `DEFAULT_CATEGORIES` (system defaults) onto the list
- [ ] For each existing Packing list: copy `PACKING_CATEGORIES` into the list's `categories` column
- [ ] For each existing To-Do list: copy `TODO_CATEGORIES` into the list's `categories` column
- [ ] After migration, no list with a category-supporting type should have `categories = NULL`
- [ ] Migration is idempotent (safe to re-run)
- [ ] Migration runs successfully against production data
- [ ] Lint passes

### US-004: Database — Remove categories column from stores

**Description:** As a developer, I need to drop the categories column from stores now that categories live on lists.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Migration drops `categories` column from `stores` table
- [ ] Migration runs after US-003 (data migration must complete first)
- [ ] No application code references `stores.categories` after this point
- [ ] Migration runs successfully
- [ ] Lint passes

### US-005: Service layer — Category resolution logic (React)

**Description:** As a developer, I need to update the category resolution chain to use list-level categories instead of store categories.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] New resolution order: list's `categories` column → user defaults for list type → system defaults for list type
- [ ] New utility function `getEffectiveCategories(list, userCategoryDefaults)` returns the resolved categories array
- [ ] `categorizeItem()` uses effective list categories (not store categories) for auto-categorization
- [ ] Sort pipeline category grouping uses effective list categories (not store categories)
- [ ] Remove all references to `store.categories` in category resolution paths
- [ ] Update `ShoppingListContext` to no longer read categories from stores
- [ ] `DEFAULT_CATEGORIES` remains as the system default for Grocery; `PACKING_CATEGORIES` for Packing; `TODO_CATEGORIES` for To-Do
- [ ] Existing items retain their category keys (no re-categorization)
- [ ] Lint passes

### US-006: Service layer — Category resolution logic (Swift)

**Description:** As a developer, I need the same updated category resolution on iOS.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Mirror React resolution: list categories → user defaults → system defaults
- [ ] New `CategoryService` (or extend existing service) with `getEffectiveCategories(list:, userDefaults:)`
- [ ] Auto-categorization uses list categories instead of store categories
- [ ] Sort pipeline uses list categories
- [ ] Remove `categories` property from `Store` model
- [ ] Remove all store-category resolution from `SortPipeline.swift` and `ListDetailViewModel`
- [ ] Existing items retain their category keys
- [ ] Build succeeds on iOS simulator
- [ ] Lint passes

### US-007: Remove store category editor — React web

**Description:** As a developer, I need to remove the category editor from store management since categories now live on lists.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Remove `StoreCategoryEditor` component from `StoreManager.jsx` (or extract to reusable component first)
- [ ] Remove "categories" section from store create/edit flows
- [ ] Remove "Copy from Defaults" / "Copy from Store" category actions in store management
- [ ] Store creation no longer seeds categories
- [ ] Store model no longer includes `categories` field in React services
- [ ] No broken references or dead imports
- [ ] Verify in browser — store management still works without category sections
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-008: Remove store category editor — Swift iOS

**Description:** As a developer, I need to remove the category editor from store management on iOS.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Remove `CategoryEditorView` navigation from `StoreBrowserView`
- [ ] Remove `CategoryDetailView` navigation from store flows
- [ ] Remove `categories` from `Store` model struct
- [ ] Remove `updateCategories` from `StoreViewModel`
- [ ] Store creation / edit sheets no longer reference categories
- [ ] No broken references or dead code
- [ ] Build succeeds on iOS simulator
- [ ] Lint passes

### US-009: Per-list category editor — React web

**Description:** As a user, I want to edit categories on a specific list so I can organize items the way I want.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] New "Edit Categories" option in the list action menu (three-dot or equivalent)
- [ ] Opens a category editor UI (adapt patterns from the old `StoreCategoryEditor`)
- [ ] Supports: add, remove (with confirm), rename, reorder (drag), change color, and keyword editing
- [ ] Full keyword editing per category (same depth as the old store editor)
- [ ] Changes save to the list's `categories` column immediately
- [ ] Available to both list owner and shared users
- [ ] Only shown for list types that support categories (Grocery, Packing, To-Do)
- [ ] Not shown for Basic, Guest List, Project
- [ ] Verify in browser
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-010: Per-list category editor — Swift iOS

**Description:** As a user, I want to edit categories on a specific list from the iOS app.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] New "Edit Categories" option in list detail menu / context menu
- [ ] Opens a category editor view (adapt patterns from the old `CategoryEditorView` / `CategoryDetailView`)
- [ ] Supports: add, remove (with confirm), rename, reorder, change color, and keyword editing
- [ ] Full keyword editing per category
- [ ] Changes save to the list's `categories` column immediately
- [ ] Available to both list owner and shared users
- [ ] Only shown for list types that support categories (Grocery, Packing, To-Do)
- [ ] Build succeeds on iOS simulator
- [ ] Lint passes

### US-011: "Save as Default" button — React web

**Description:** As a user, after customizing a list's categories I want to save them as my default for that list type so future lists start the same way.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] "Save as Default for [List Type]" button visible in the per-list category editor
- [ ] Tapping shows a confirmation dialog: "This will replace your default [List Type] categories with this list's categories. Continue?"
- [ ] On confirm, upserts to `user_category_defaults` for the current list type
- [ ] On cancel, no changes
- [ ] Visual feedback on success (toast or inline confirmation)
- [ ] Verify in browser
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-012: "Save as Default" button — Swift iOS

**Description:** As a user, I want the same "Save as Default" action on iOS.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] "Save as Default for [List Type]" button in the per-list category editor view
- [ ] Confirmation alert: "This will replace your default [List Type] categories with this list's categories. Continue?"
- [ ] On confirm, upserts to `user_category_defaults`
- [ ] On cancel, no changes
- [ ] Success feedback (alert or HUD)
- [ ] Build succeeds on iOS simulator
- [ ] Lint passes

### US-013: Manage default categories in Settings — React web

**Description:** As a user, I want to manage my default categories per list type from the Settings page.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] New "Category Defaults" section in Settings
- [ ] List type tabs or selector (Grocery, Packing, To-Do) — only types that support categories
- [ ] Each type shows its current user defaults (or system defaults if no custom set)
- [ ] Full category editor: add, remove, rename, reorder, change color, keyword editing
- [ ] "Reset to System Defaults" button with confirmation dialog
- [ ] Changes save to `user_category_defaults` immediately
- [ ] Verify in browser
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-014: Manage default categories in Settings — Swift iOS

**Description:** As a user, I want to manage my default categories per list type from iOS Settings.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] New "Category Defaults" row in SettingsView, navigates to a new view
- [ ] List type picker (Grocery, Packing, To-Do)
- [ ] Each type shows current user defaults (or system defaults if uncustomized)
- [ ] Full category editor: add, remove, rename, reorder, change color, keyword editing
- [ ] "Reset to System Defaults" button with confirmation
- [ ] Changes save to `user_category_defaults` immediately
- [ ] Build succeeds on iOS simulator
- [ ] Lint passes

### US-015: List creation — seed categories from user defaults

**Description:** As a user, when I create a new list it should start with my customized default categories (or system defaults if I haven't customized).

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] React: `ListSelector` create flow populates new list's `categories` from user defaults → system defaults for the selected type
- [ ] Swift: `CreateListSheet` populates new list's `categories` the same way
- [ ] User default lookup is for the selected list type
- [ ] If user has no custom defaults for the type, system defaults are used
- [ ] Categories are copied (not referenced) — editing the list later doesn't affect defaults
- [ ] Basic, Guest List, and Project lists are created with `categories = NULL` (they don't use categories)
- [ ] Lint passes

### US-016: List creation — optional category preview (collapsed by default)

**Description:** As a user, I want to optionally preview and customize categories before creating a list.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] "Customize Categories" expandable/collapsible section in the create list flow (both platforms)
- [ ] Collapsed by default to keep creation flow fast
- [ ] Shows what categories will be seeded based on selected list type
- [ ] User can edit before creating (inline editor)
- [ ] If left collapsed, defaults are used automatically
- [ ] Only shown for list types that support categories (Grocery, Packing, To-Do)
- [ ] Verify in browser (React)
- [ ] Build succeeds on iOS simulator (Swift)
- [ ] Works in both light and dark mode (React)
- [ ] Lint passes

### US-017: List type change resets categories with confirmation

**Description:** As a user, when I change a list's type (e.g., Grocery → Packing), the categories should reset to the new type's defaults with a confirmation.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] When user changes list type to a category-supporting type, show confirmation: "Changing to [New Type] will reset this list's categories to your [New Type] defaults. Continue?"
- [ ] On confirm, replace the list's `categories` with user defaults for new type (or system defaults)
- [ ] On cancel, type change is aborted
- [ ] When changing to a non-category type (Basic, Guest List, Project), set `categories = NULL` without confirmation
- [ ] When changing from a non-category type to a category type, populate categories from defaults (no confirmation needed — nothing to lose)
- [ ] Works on both React web and Swift iOS
- [ ] Lint passes

## Functional Requirements

- FR-1: Add `categories` JSONB column to `lists` table (nullable)
- FR-2: Create `user_category_defaults` table with RLS and realtime
- FR-3: Migrate existing store categories to list categories and user Grocery defaults
- FR-4: Drop `categories` column from `stores` table after migration
- FR-5: Category resolution chain: per-list → user defaults → system defaults
- FR-6: Remove all store-category logic from both platforms (editor UI, models, services, sort pipeline)
- FR-7: Per-list category editor accessible from list menu (both platforms) with full editing (add, remove, rename, reorder, color, keywords)
- FR-8: "Save as Default for [List Type]" button with confirmation in per-list editor
- FR-9: Settings section for managing defaults per list type (both platforms)
- FR-10: "Reset to System Defaults" in the settings editor
- FR-11: New list creation seeds categories from user defaults or system defaults
- FR-12: Optional category preview during list creation (collapsed by default)
- FR-13: List type change resets categories to new type's defaults with confirmation
- FR-14: Category editing only available for Grocery, Packing, and To-Do list types
- FR-15: Shared list users can edit that list's categories

## Non-Goals

- No per-store categories (this is the system being replaced)
- No syncing categories between lists (each list is independent after creation)
- No bulk operations across multiple lists' categories
- No category "templates" or "presets" beyond the system defaults and user defaults
- No re-categorization of existing items when categories change (items keep their current category key)
- No category support for Basic, Guest List, or Project list types

## Design Considerations

- **Reuse existing editor patterns:** The `StoreCategoryEditor` (React) and `CategoryEditorView`/`CategoryDetailView` (Swift) implement the full category editing UI. Extract and adapt these as a reusable `CategoryEditor` component for list context before removing the store-specific versions.
- **List menu placement:** "Edit Categories" should sit near "Edit List" or "Sort" in the list's action menu.
- **Settings placement:** "Category Defaults" should go under the existing Settings sections, after appearance/profile.
- **Type filtering:** Only show category editing for Grocery, Packing, and To-Do. Basic, Guest List, and Project don't use categories.
- **Creation flow:** The "Customize Categories" section should be visually subtle when collapsed — just a chevron and label, not a large empty area.

## Technical Considerations

- **Framework:** React (Vite) + SwiftUI
- **Database:** Postgres via Supabase
- **Category format:** `[{key: string, name: string, color: string, keywords: string[]}]` — same format currently used in stores
- **Migration order matters:** US-001 (add column) → US-002 (new table) → US-003 (data migration) → US-004 (drop store column). The app code changes (US-005–US-008) should deploy alongside or after US-003, before US-004.
- **Store simplification:** After removing categories from stores, the `stores` table becomes: `id, user_id, name, color, sort_order, created_at`. Stores are purely a label/grouping for items — they no longer carry category configuration.
- **Sort pipeline impact:** The sort pipeline currently reads categories from stores for the "category" sort level. After this change, it reads from the list's categories instead. The `getCategoryInfo()` function in both `sortPipeline.js` and `SortPipeline.swift` needs to accept list categories instead of looking them up from stores.
- **Realtime:** `user_category_defaults` on realtime so Settings changes propagate. List `categories` changes already covered by existing `lists` realtime subscription.
- **Backward compatibility:** During deployment, there may be a brief window where the app expects list categories but the migration hasn't run. The fallback chain (list → user defaults → system defaults) handles this gracefully since NULL triggers the fallback.

## Success Metrics

- Users can create a new list with personalized starting categories
- Users can customize any list's categories without affecting other lists
- Category customization accessible in under 3 taps/clicks from the list view
- No data loss during store → list category migration
- Store management UI is simpler after category removal
- No regression in list creation, item categorization, or sort pipeline performance

## Credential & Service Access Plan

No external credentials required for this PRD.

## Definition of Done

- All four database migrations applied and verified (add list categories, create user_category_defaults, migrate store data, drop store categories)
- Category resolution chain works on both platforms: per-list → user defaults → system defaults
- All store-category code removed from both platforms (editor, models, services, sort pipeline)
- Per-list category editor accessible from list menu on React web and Swift iOS with full editing depth (including keywords)
- "Save as Default for [List Type]" button works with confirmation on both platforms
- Settings section for managing defaults per list type on both platforms with "Reset to System Defaults"
- New list creation seeds categories from user defaults (or system defaults)
- Category preview available (collapsed) during list creation on both platforms
- List type change resets categories with confirmation on both platforms
- Category editing only appears for Grocery, Packing, and To-Do list types
- Shared list users can edit categories on lists shared with them
- All existing items retain their category keys (no unintended re-categorization)
- Existing store category customizations migrated to user Grocery defaults
- Build succeeds on both platforms
- Lint passes on all changed files
