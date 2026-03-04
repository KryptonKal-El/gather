# PRD: Recipe Collections

**Status:** Ready
**Created:** 2026-03-04
**Author:** Planner
**Origin:** Promoted from `docs/tasks/promotions/recipe-collections.md`
**Size:** Large (L)

## Overview

Introduce a "Collections" grouping layer above recipes. Collections become the primary unit of organization and sharing, replacing per-recipe sharing. Users create named collections (e.g., "Weeknight Dinners", "Holiday Baking"), add recipes to them, and share entire collections collaboratively with other users.

**Key decisions:**
- Each recipe belongs to exactly one collection (`collection_id` FK)
- No limit on collections per user
- Sharing is email-based (consistent with existing `list_shares` and `recipe_shares` patterns)
- Shared users can add/remove recipes within a shared collection (collaborative)
- Unsharing immediately revokes access (clean cut — no copies retained)
- Default "My Recipes" collection is fully editable (deletable/renameable); orphaned recipes auto-move to a new default
- Deleting a collection prompts the user: delete all recipes or move them to the default collection
- Mobile navigation: iOS drill-down (tap collection → recipe list → back)
- Desktop navigation: sidebar replaces flat recipe list with two states (collection list → recipe list within selected collection)

## Problem Statement

Recipes currently exist as a flat list with per-recipe sharing. As users accumulate recipes, the flat list becomes hard to navigate. Sharing is tedious because each recipe must be shared individually. There is no way to organize recipes into logical groups.

## Current State

| Component | What Exists |
|-----------|-------------|
| `recipes` table | Flat list, `owner_id` FK, no grouping concept |
| `recipe_shares` table | Per-recipe email-based sharing, read-only for recipients |
| `recipeDatabase.js` | 12 exported functions: CRUD, sharing, subscriptions |
| `RecipeContext.jsx` | State: `recipes`, `sharedRecipes`, `activeRecipeId`, `activeRecipe` |
| `RecipeSelector.jsx` | Flat list with "My Recipes" section, "Shared with me" section, templates |
| `ShareRecipeModal.jsx` | Per-recipe share/unshare via email |
| `App.jsx` | Desktop sidebar/content split; mobile push/pop nav |
| RLS | Owner can CRUD; shared users can SELECT via `recipe_shares` lookup |
| Realtime | All 4 recipe tables in `supabase_realtime` publication |

---

## User Stories

### Phase 1: Database & Service Foundation

#### US-001: Create Collections Schema Migration
**Priority:** High
**Estimated Effort:** Medium
**Files:** `supabase/migrations/YYYYMMDDHHMMSS_create_collections.sql`

Create the `collections` table, `collection_shares` table, add `collection_id` to `recipes`, and set up RLS policies.

**Schema — `collections` table:**
| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `uuid` | PRIMARY KEY | `gen_random_uuid()` |
| `owner_id` | `uuid` | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | — |
| `name` | `text` | NOT NULL | — |
| `emoji` | `text` | nullable | — |
| `description` | `text` | nullable | — |
| `is_default` | `boolean` | NOT NULL | `false` |
| `sort_order` | `int` | NOT NULL | `0` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |

**Schema — `collection_shares` table:**
| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `uuid` | PRIMARY KEY | `gen_random_uuid()` |
| `collection_id` | `uuid` | NOT NULL, FK → `collections(id)` ON DELETE CASCADE | — |
| `shared_with_email` | `text` | NOT NULL | — |
| `shared_by` | `uuid` | NOT NULL, FK → `profiles(id)` | — |
| `permission` | `text` | NOT NULL, CHECK IN (`read`, `write`) | `'write'` |
| `added_at` | `timestamptz` | NOT NULL | `now()` |

**Schema — `recipes` modification:**
- Add `collection_id uuid` column (nullable initially for migration, NOT NULL after data migration)
- Add FK constraint → `collections(id)` ON DELETE SET NULL (so collection deletion doesn't cascade-delete recipes)
- Add index on `collection_id`

**RLS Policies — `collections`:**
- SELECT: `owner_id = auth.uid()` OR exists in `collection_shares` where `shared_with_email = auth.jwt()->>'email'`
- INSERT: `owner_id = auth.uid()`
- UPDATE: `owner_id = auth.uid()`
- DELETE: `owner_id = auth.uid()`

**RLS Policies — `collection_shares`:**
- SELECT: `shared_with_email = auth.jwt()->>'email'` OR is collection owner (use `is_collection_owner()` helper)
- INSERT: is collection owner
- DELETE: is collection owner

**RLS Policy Updates — `recipes`:**
- UPDATE existing SELECT policy: owner can see own recipes OR recipe is in a collection shared with user's email
- The new policy replaces the `recipe_shares`-based lookup with a `collection_shares`-based lookup
- INSERT/UPDATE/DELETE: owner can modify own recipes, AND shared users with `write` permission on the recipe's collection can INSERT/DELETE recipes in that collection

**Helper function:**
```sql
CREATE OR REPLACE FUNCTION is_collection_owner(collection_uuid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM collections WHERE id = collection_uuid AND owner_id = auth.uid());
$$;
```

**Realtime:** Add `collections` and `collection_shares` to `supabase_realtime` publication.

**Indexes:**
- `idx_collections_owner_id` on `collections(owner_id)`
- `idx_collection_shares_collection_id` on `collection_shares(collection_id)`
- `idx_collection_shares_shared_with_email` on `collection_shares(shared_with_email)`
- `idx_recipes_collection_id` on `recipes(collection_id)`

**Acceptance Criteria:**
- `collections` table exists with all columns and constraints
- `collection_shares` table exists with unique constraint on `(collection_id, shared_with_email)`
- `recipes.collection_id` column exists (nullable at this stage)
- All RLS policies pass: owner CRUD, shared user SELECT + recipe INSERT/DELETE in shared collection
- Helper function `is_collection_owner()` works correctly
- Both new tables added to Realtime publication
- Migration applies cleanly on a fresh database and on the existing production database
- No RLS recursion issues (use SECURITY DEFINER helper pattern from recipe fix)

---

#### US-002: Data Migration — Existing Recipes to Default Collections
**Priority:** High
**Estimated Effort:** Medium
**Files:** `supabase/migrations/YYYYMMDDHHMMSS_migrate_recipes_to_collections.sql`

Migrate all existing data to the collections model. This must run after US-001.

**Migration steps (all in one transaction):**
1. For each distinct `owner_id` in `recipes`, create a default collection: `INSERT INTO collections (owner_id, name, emoji, is_default) VALUES (owner_id, 'My Recipes', '📖', true)`
2. Update all existing recipes: `SET collection_id = (SELECT id FROM collections WHERE owner_id = recipes.owner_id AND is_default = true)`
3. For each distinct `(shared_by, shared_with_email)` pair in `recipe_shares`:
   - Create a collection owned by `shared_by` named "Shared Recipes" (or group by some heuristic)
   - Move the shared recipes into that collection
   - Create a `collection_shares` row for `shared_with_email` on that collection
4. After all recipes have a `collection_id`, alter column to `NOT NULL`
5. Drop `recipe_shares` table (or rename to `recipe_shares_archive` for safety)

**Acceptance Criteria:**
- Every existing recipe has a non-null `collection_id` after migration
- Every existing user with recipes has a default collection (`is_default = true`)
- Existing recipe share relationships are preserved — previously shared users can still see the same recipes, now via collection shares
- `collection_id` is NOT NULL after migration
- `recipe_shares` table is dropped or archived
- Migration is idempotent (can run safely if collections already exist)
- No data loss — recipe count before and after migration matches

---

#### US-003: Service Layer — Collection CRUD
**Priority:** High
**Estimated Effort:** Medium
**Files:** `src/services/recipeDatabase.js`

Add collection CRUD functions to the existing recipe database service.

**New exports:**
- `createCollection(userId, { name, emoji, description })` → returns UUID
- `updateCollection(collectionId, { name?, emoji?, description? })` → void
- `deleteCollection(userId, collectionId)` → void (does NOT cascade-delete recipes — caller handles that)
- `getCollections(userId)` → array of owned collections
- `subscribeCollections(userId, callback)` → unsubscribe function (fetch + Realtime on `collections` filtered by `owner_id`)
- `ensureDefaultCollection(userId)` → returns UUID of default collection (creates one if missing)

**Modified exports:**
- `createRecipe(userId, recipe)` — add required `collectionId` parameter
- `moveRecipeToCollection(recipeId, collectionId)` — new function to reassign a recipe

**Acceptance Criteria:**
- All new functions handle errors with contextual messages and `{ cause }` wrapping (match existing pattern)
- `createCollection` returns the new UUID
- `deleteCollection` throws if attempting to delete the last remaining collection for a user
- `subscribeCollections` delivers initial data and reacts to Realtime changes
- `ensureDefaultCollection` is idempotent — returns existing default if one exists
- `createRecipe` requires `collectionId` and fails without it
- `moveRecipeToCollection` updates `recipes.collection_id` and `updated_at`

---

#### US-004: Service Layer — Collection Sharing
**Priority:** High
**Estimated Effort:** Medium
**Files:** `src/services/recipeDatabase.js`

Add collection sharing functions. These replace the existing per-recipe sharing functions.

**New exports:**
- `shareCollection(collectionId, email)` → void
- `unshareCollection(collectionId, email)` → void
- `getCollectionShares(collectionId)` → array of `{ id, email, addedAt }`
- `subscribeSharedCollections(email, callback)` → unsubscribe function (Realtime on `collection_shares`)
- `addRecipeToSharedCollection(userId, collectionId, recipe)` → returns recipe UUID (for shared users adding recipes)
- `removeRecipeFromSharedCollection(userId, recipeId, collectionId)` → void (for shared users removing their own added recipes)

**Removed exports (after migration is complete):**
- `shareRecipe` — replaced by `shareCollection`
- `unshareRecipe` — replaced by `unshareCollection`
- `getRecipeShares` — replaced by `getCollectionShares`
- `subscribeSharedRecipeRefs` — replaced by `subscribeSharedCollections`

**Acceptance Criteria:**
- `shareCollection` normalizes email to lowercase/trimmed (match existing pattern)
- `shareCollection` rejects sharing with the collection owner's own email
- `unshareCollection` removes the `collection_shares` row
- `subscribeSharedCollections` delivers collections (with recipe counts) shared with the given email
- Shared users can add recipes to a collection they have write access to
- Shared users can only remove recipes they themselves added (not the owner's recipes)
- All functions follow existing error handling patterns

---

### Phase 2: Context & State Management

#### US-005: RecipeContext — Collection State
**Priority:** High
**Estimated Effort:** Medium
**Files:** `src/context/RecipeContext.jsx`

Refactor RecipeContext to add collection state and actions.

**New state:**
- `collections` — array of owned collections
- `sharedCollections` — array of collections shared with the user
- `activeCollectionId` — currently selected collection UUID (defaults to the default collection)

**New actions:**
- `createCollection(data)` → UUID
- `updateCollection(collectionId, updates)` → void
- `deleteCollection(collectionId, { deleteRecipes: boolean })` → void
  - If `deleteRecipes` is false, moves recipes to the default collection first
  - If `deleteRecipes` is true, deletes all recipes in the collection
- `selectCollection(collectionId)` → void (sets `activeCollectionId`, clears `activeRecipeId`)
- `moveRecipe(recipeId, targetCollectionId)` → void

**Modified state:**
- `recipes` — now filtered to show only recipes in the `activeCollectionId` collection
- `sharedRecipes` — removed (replaced by `sharedCollections` and recipes within them)

**New subscriptions:**
- `subscribeCollections(userId, setCollections)` when `userId` changes
- `subscribeSharedCollections(userEmail, setSharedCollections)` when `userEmail` changes

**Modified actions:**
- `createRecipe(recipe)` — passes `activeCollectionId` as the `collectionId`
- `shareRecipe` / `unshareRecipe` / `getShares` — removed from context value

**New actions for collection sharing:**
- `shareCollection(collectionId, email)` → void
- `unshareCollection(collectionId, email)` → void
- `getCollectionShares(collectionId)` → array

**Acceptance Criteria:**
- `collections` state is populated on mount and stays in sync via Realtime
- `sharedCollections` state is populated on mount for the user's email
- `activeCollectionId` defaults to the user's default collection on first load
- Selecting a collection updates `activeCollectionId` and clears `activeRecipeId`
- `recipes` array only contains recipes for the active collection
- `deleteCollection` with `deleteRecipes: false` moves recipes before deleting
- `deleteCollection` with `deleteRecipes: true` deletes recipes then the collection
- If the active collection is deleted, `activeCollectionId` falls back to the default collection
- All existing recipe actions (create, update, delete, upload image, update ingredients/steps) continue to work

---

### Phase 3: UI — Collection Navigation

#### US-006: RecipeSelector — Collection List View
**Priority:** High
**Estimated Effort:** Large
**Files:** `src/components/RecipeSelector.jsx`, `src/components/RecipeSelector.module.css`

Replace the flat recipe list with a two-state sidebar: collection list → recipe list within selected collection.

**Collection list view (default state):**
- Header: "Collections" title + "+ New" button (creates a new collection)
- Search bar: filters collections by name
- "My Collections" section: owned collections, each showing emoji + name + recipe count + chevron
- "Shared with me" section: shared collections, each showing emoji + name + owner name + recipe count + "Shared" badge + chevron
- 3-dot menu on owned collections: Rename, Share, Delete
- 3-dot menu on shared collections: Leave (unshare self)
- Tapping a collection transitions to the recipe list view for that collection

**Collection list item layout:**
```
[emoji] Collection Name                    (5) >
```

**Acceptance Criteria:**
- Collections are listed with emoji, name, and recipe count
- Owned and shared collections are in separate sections
- Search filters collections by name
- "+ New" opens an inline form or modal to create a collection (name + emoji picker)
- 3-dot menu renders as bottom sheet on mobile, dropdown on desktop (match existing pattern)
- Rename opens an inline edit or modal
- Delete shows a confirmation dialog with two options: "Delete recipes too" or "Move recipes to [default collection]"
- "Leave" on a shared collection removes the user's access after confirmation
- Empty state: "No collections yet. Create one to organize your recipes."
- Works in both light and dark mode
- Mobile: full-screen list with sticky header
- Desktop: sidebar column (same position as current recipe list)

---

#### US-007: RecipeSelector — Recipe List Within Collection
**Priority:** High
**Estimated Effort:** Medium
**Files:** `src/components/RecipeSelector.jsx`, `src/components/RecipeSelector.module.css`

When a collection is selected, show the recipe list within it with back navigation to the collection list.

**Recipe list view (after tapping a collection):**
- Header: "← Back" button + collection name + collection emoji
- Search bar: filters recipes within this collection by name
- Recipe list: same layout as current (thumbnail, name, ingredient/step counts, chevron, 3-dot menu)
- "+ New Recipe" button in the header or as a FAB
- For shared collections: "+ Add Recipe" button visible (collaborative)
- 3-dot menu on owned recipes: Edit, Move to Collection, Delete
- 3-dot menu on recipes in shared collections (added by current user): Edit, Remove from Collection
- 3-dot menu on recipes in shared collections (added by others): View only
- Templates section at the bottom (same as current — "Browse Templates")

**"Move to Collection" action:**
- Opens a modal/picker showing all owned collections (excluding the current one)
- Selecting a collection moves the recipe

**Acceptance Criteria:**
- Back button returns to collection list view
- Recipe list shows only recipes in the selected collection
- Search filters recipes by name within the collection
- New recipe creation adds the recipe to the currently selected collection
- "Move to Collection" shows a collection picker and moves the recipe on selection
- Templates section remains functional
- Shared collection members can add new recipes (write access)
- Shared collection members can remove recipes they added
- Mobile: iOS push/pop transition from collection list to recipe list (match existing nav pattern)
- Desktop: sidebar smoothly transitions between collection list and recipe list
- Works in both light and dark mode

---

#### US-008: ShareCollectionModal — Collection-Level Sharing
**Priority:** High
**Estimated Effort:** Medium
**Files:** `src/components/ShareCollectionModal.jsx` (new), `src/components/ShareCollectionModal.module.css` (new)

Create a new modal for sharing collections. This replaces `ShareRecipeModal.jsx`.

**Behavior:**
- On mount: fetches existing shares via `getCollectionShares(collectionId)`
- Email input + "Share" button to add collaborators
- Validation: non-empty, valid email, not the owner, not already shared
- People with access list: owner with "Owner" badge, then each share with email + "Remove" button
- Portal-rendered to `document.body` (match existing pattern)
- Close triggers: backdrop click, Escape key, X button
- Header shows: "Share [Collection Name]"
- Subtitle: "People you share with can add and view recipes in this collection."

**Acceptance Criteria:**
- Modal opens when "Share" is selected from collection 3-dot menu
- Existing shares are displayed on open
- Adding a collaborator inserts a `collection_shares` row and refreshes the list
- Removing a collaborator deletes the row and refreshes
- Validation prevents sharing with self, duplicates, and invalid emails
- Error states are shown inline
- Loading states during share/unshare operations
- Works in both light and dark mode
- Renders as portal (same as current ShareRecipeModal)

---

### Phase 4: Wiring & Integration

#### US-009: App.jsx — Desktop Layout Wiring
**Priority:** High
**Estimated Effort:** Medium
**Files:** `src/App.jsx`

Update `renderRecipesView()` and modal wiring in App.jsx for collection awareness.

**Changes:**
- Replace `sharingRecipeId` state with `sharingCollectionId`
- `RecipeSelector.onShareClick` now receives a collection (not a recipe)
- `ShareRecipeModal` rendering → `ShareCollectionModal` rendering, wired to collection sharing actions
- `RecipeSelector.onCreate` for collections → `recipeActions.createCollection`
- `RecipeSelector.onSelect` for collections → `recipeActions.selectCollection`
- Ensure recipe-level actions (edit, delete, create, upload) still flow correctly through the selected collection
- Desktop tab switcher ("Lists" / "Recipes") remains unchanged

**Acceptance Criteria:**
- Desktop recipes view renders the two-state collection sidebar
- Selecting a collection shows its recipes in the sidebar
- Selecting a recipe from the sidebar shows its detail in the content area
- Share modal opens for collections (not individual recipes)
- Creating a recipe adds it to the currently active collection
- All existing recipe flows (edit, delete, image upload, add to list) continue to work
- Template save creates recipe in the active collection
- No regressions in the Lists view

---

#### US-010: Mobile Navigation — Collection Drill-Down
**Priority:** High
**Estimated Effort:** Medium
**Files:** `src/App.jsx`, `src/hooks/useMobileNav.js`

Update mobile navigation to support the collection → recipe → detail drill-down.

**Navigation stack:**
1. Collection list (root of Recipes tab)
2. Recipe list within selected collection (push)
3. Recipe detail (push)

**Changes to `useMobileNav`:**
- New state: `openCollectionId` for tracking which collection is open
- Push from collection list → recipe list within collection
- Push from recipe list → recipe detail (existing behavior)
- Back from recipe detail → recipe list (existing)
- Back from recipe list → collection list (new)
- Browser history integration for all levels

**Acceptance Criteria:**
- Tapping a collection pushes to the recipe list view with iOS slide transition
- Tapping a recipe pushes to detail view (existing behavior preserved)
- Back button at each level works correctly
- Browser back button navigates through the full stack
- Tab switching returns to collection list (root)
- Transitions are smooth 300ms slides (match existing)
- No flicker or layout shift during transitions

---

#### US-011: MobileRecipeDetail — Collection Context
**Priority:** Medium
**Estimated Effort:** Small
**Files:** `src/components/MobileRecipeDetail.jsx`

Update the recipe detail view to show collection context and support collection-aware actions.

**Changes:**
- Show collection name as a breadcrumb or subtitle below the recipe name (e.g., "in Weeknight Dinners")
- "Move to Collection" action in the 3-dot menu (owned recipes only)
- For shared collection recipes: show who added the recipe if available
- Remove the per-recipe "Share" button from the nav bar (sharing is now at collection level)

**Acceptance Criteria:**
- Collection name is visible on the detail view
- "Move to Collection" opens a collection picker
- Share button is removed from the recipe detail nav bar
- "Add to List" functionality continues to work
- Works on both mobile and desktop
- Works in both light and dark mode

---

### Phase 5: Cleanup & Polish

#### US-012: Remove Per-Recipe Sharing Code
**Priority:** Medium
**Estimated Effort:** Small
**Files:** `src/components/ShareRecipeModal.jsx`, `src/components/ShareRecipeModal.module.css`, `src/services/recipeDatabase.js`, `src/context/RecipeContext.jsx`

Remove all per-recipe sharing code that has been replaced by collection sharing.

**Removals:**
- Delete `ShareRecipeModal.jsx` and `ShareRecipeModal.module.css`
- Remove from `recipeDatabase.js`: `shareRecipe`, `unshareRecipe`, `getRecipeShares`, `subscribeSharedRecipeRefs`
- Remove from `RecipeContext.jsx`: `shareRecipe`, `unshareRecipe`, `getShares` actions; `sharedRecipes` state
- Remove `sharingRecipeId` state from App.jsx (replaced by `sharingCollectionId` in US-009)
- Remove any remaining `recipe_shares` references in RLS policies (handled by migration in US-002)

**Acceptance Criteria:**
- No references to `recipe_shares`, `shareRecipe`, `unshareRecipe`, `ShareRecipeModal` remain in application code
- `recipeDatabase.js` no longer exports removed functions
- `RecipeContext` no longer exposes removed actions or state
- Build succeeds with no unused import warnings
- Lint passes

---

#### US-013: Default Collection Auto-Creation on Sign-Up
**Priority:** Medium
**Estimated Effort:** Small
**Files:** `src/context/RecipeContext.jsx` or `src/context/AuthContext.jsx`

Ensure new users automatically get a default "My Recipes" collection on first sign-in.

**Approach:**
- In RecipeContext, after `subscribeCollections` delivers initial data, check if any collection has `is_default: true`
- If not, call `ensureDefaultCollection(userId)` to create one
- Set `activeCollectionId` to the default collection

**Acceptance Criteria:**
- A brand-new user who has never created a recipe sees a "My Recipes" default collection
- The default collection is created automatically on first load
- Existing users who went through the data migration already have a default collection (no duplicate)
- `ensureDefaultCollection` is idempotent

---

#### US-014: Collection Emoji Picker
**Priority:** Low
**Estimated Effort:** Small
**Files:** `src/components/RecipeSelector.jsx` (or new `CollectionForm.jsx`)

When creating or editing a collection, allow the user to pick an emoji. Reuse the existing native emoji picker pattern from the lists feature (prd-native-emoji-picker).

**Acceptance Criteria:**
- Emoji picker appears when creating a new collection
- Emoji picker appears when renaming/editing a collection
- Selected emoji is saved to `collections.emoji`
- Emoji displays next to collection name in the collection list
- Default emoji for new collections: 📖 (or user can clear it)
- Reuses the same emoji picker component/pattern as lists

---

#### US-015: Delete Collection Confirmation Dialog
**Priority:** Medium
**Estimated Effort:** Small
**Files:** `src/components/RecipeSelector.jsx` (or new `DeleteCollectionDialog.jsx`)

When deleting a collection that contains recipes, show a confirmation dialog with two options.

**Dialog content:**
- Title: "Delete [Collection Name]?"
- If collection has recipes:
  - Option A: "Delete collection and all [N] recipes" (destructive, red)
  - Option B: "Move [N] recipes to [Default Collection Name] and delete collection" (safe, primary)
  - Cancel button
- If collection is empty:
  - Simple confirmation: "Delete this empty collection?"
  - Delete + Cancel buttons

**Acceptance Criteria:**
- Dialog shows recipe count
- "Move recipes" option moves all recipes to the default collection, then deletes the collection
- "Delete all" option deletes all recipes and the collection
- If deleting the default collection: auto-create a new default collection first, move recipes there, then delete the old one
- Cancel dismisses without action
- Works in both light and dark mode

---

## Credential & Service Access Plan

No external credentials required for this PRD. All changes use existing Supabase project (database, Realtime, RLS). No new API keys or third-party services.

---

## Definition of Done

Implementation is complete when all of the following are true:

1. **Database:** `collections` and `collection_shares` tables exist with correct schema, constraints, indexes, and RLS policies. `recipes.collection_id` is NOT NULL with FK constraint. `recipe_shares` table is dropped or archived.
2. **Data migration:** All existing recipes are assigned to owner-specific default collections. All existing recipe shares are migrated to collection shares. No data loss.
3. **Service layer:** All new collection CRUD and sharing functions are exported and working. Old per-recipe sharing functions are removed.
4. **Context:** RecipeContext exposes collection state and actions. Recipe list is filtered by active collection. Subscriptions for collections and shared collections are active.
5. **UI — Collections:** Collection list displays owned and shared collections with emoji, name, recipe count. CRUD operations (create, rename, delete) work. Emoji picker works.
6. **UI — Recipes in Collection:** Recipe list within a selected collection works with search, 3-dot menus, and all existing recipe actions. "Move to Collection" action works.
7. **UI — Sharing:** ShareCollectionModal replaces ShareRecipeModal. Collection sharing via email works. Shared users see shared collections and can add/view recipes.
8. **UI — Navigation:** Mobile drill-down (collections → recipes → detail) with iOS push/pop transitions. Desktop sidebar two-state navigation. Browser back button works at all levels.
9. **Collaboration:** Shared collection members can add new recipes and remove their own added recipes. They cannot delete recipes added by others or the collection owner.
10. **Cleanup:** No references to `recipe_shares`, `ShareRecipeModal`, or per-recipe sharing remain in application code.
11. **Quality:** Lint passes. Build succeeds. Works in both light and dark mode. No regressions in Lists view or other features.

---

## Risk Areas

| Risk | Mitigation |
|------|------------|
| **Data migration complexity** — grouping per-recipe shares into per-collection shares requires heuristic logic | Keep migration simple: create one "Shared Recipes" collection per sharer. Users can reorganize after. |
| **RLS recursion** — `collections` SELECT → `collection_shares` → back to `collections` | Use `SECURITY DEFINER` helper function pattern (proven in `is_recipe_owner()` fix) |
| **Breaking change for shared users** — shared recipes are reorganized into collections | Migration preserves access — same recipes visible, just grouped differently |
| **Mobile nav depth** — 3-level drill-down may feel deep | Each level has clear back navigation; matches iOS native patterns |
| **Collaborative writes** — shared users adding recipes to collections needs careful RLS | RLS INSERT on `recipes` must check `collection_shares.permission = 'write'` for the target collection |

---

## Story Dependency Graph

```
US-001 (Schema) ──→ US-002 (Data Migration) ──→ US-012 (Cleanup)
    │                                                  ↑
    ├──→ US-003 (Service CRUD) ──→ US-005 (Context) ──┤
    │                                    │             │
    ├──→ US-004 (Service Sharing) ───────┤             │
    │                                    │             │
    │                              US-006 (Collection List UI)
    │                                    │
    │                              US-007 (Recipe List in Collection)
    │                                    │
    │                              US-008 (ShareCollectionModal)
    │                                    │
    │                              US-009 (App.jsx Wiring)
    │                                    │
    │                              US-010 (Mobile Nav)
    │                                    │
    │                              US-011 (Detail View)
    │
    └──→ US-013 (Default Collection Auto-Create)
    └──→ US-014 (Emoji Picker) — can be done anytime after US-006
    └──→ US-015 (Delete Confirmation) — can be done anytime after US-006
```

**Critical path:** US-001 → US-003/US-004 → US-005 → US-006 → US-007 → US-009 → US-010

**Parallelizable:** US-003 and US-004 can be done in parallel after US-001. US-013, US-014, US-015 are independent.
