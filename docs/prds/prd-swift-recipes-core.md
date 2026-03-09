# PRD: Native Swift iOS App — Phase 5: Recipes & Collections Core

**ID:** prd-swift-recipes-core  
**Status:** Ready  
**Created:** 2026-03-09  
**Priority:** High  
**Phase:** 5 of 8  
**Depends On:** prd-swift-stores (Phase 4)

## Overview

Build the full recipes and collections experience in the native Swift app. Users can organize recipes into collections (like folders), browse collections, drill into a collection to see its recipes, view recipe details (ingredients, steps, hero image), create and edit recipes via a bottom sheet form, delete recipes and collections, and share collections with other users by email.

This phase delivers the **complete recipe feature** except for recipe image upload, add-to-list flow, templates, and text import — those are deferred to Phase 6. The recipe detail view includes ingredient checkboxes (prepped for add-to-list), but the cross-tab list picker is Phase 6.

This PRD is **Swift-only** because it's continuing the native app buildout. The React PWA already has full recipe and collection management. Both codebases share the same Supabase backend — no backend changes are needed.

## Design Decisions (User-Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Collection navigation | **NavigationStack** with push: collections → recipes → detail (3-level drill-down) | Standard iOS Settings-app pattern |
| Recipe form presentation | **Bottom sheet** (`.sheet`) | Consistent with Phase 2 create-list and Phase 4 create-store |
| Recipe detail view | **NavigationStack push** with scrollable content | Standard iOS drill-down |
| Ingredient checkboxes | **Include now** — prep UI for Phase 6 add-to-list | Avoids rework when add-to-list lands |
| Collection sharing | **Include in Phase 5** | Gets recipe feature closer to parity sooner |

## Context: What Already Exists

### Database (shared, no changes needed)

All tables, RLS policies, realtime subscriptions, and storage buckets already exist from the React PRDs:

**`collections` table:**
| Column | Type | Default |
|--------|------|---------|
| `id` | uuid PK | `gen_random_uuid()` |
| `owner_id` | uuid FK → profiles, CASCADE | — |
| `name` | text NOT NULL | — |
| `emoji` | text | nullable |
| `description` | text | nullable |
| `is_default` | boolean NOT NULL | `false` |
| `sort_order` | int NOT NULL | `0` |
| `created_at` | timestamptz | `now()` |
| `updated_at` | timestamptz | `now()` |

**`collection_shares` table:**
| Column | Type | Default |
|--------|------|---------|
| `id` | uuid PK | `gen_random_uuid()` |
| `collection_id` | uuid FK → collections, CASCADE | — |
| `shared_with_email` | text NOT NULL | — |
| `shared_by` | uuid FK → profiles | — |
| `permission` | text NOT NULL, CHECK (read\|write) | `'write'` |
| `added_at` | timestamptz | `now()` |

Unique constraint on `(collection_id, shared_with_email)`.

**`recipes` table:**
| Column | Type | Default |
|--------|------|---------|
| `id` | uuid PK | `gen_random_uuid()` |
| `owner_id` | uuid FK → profiles, CASCADE | — |
| `name` | text NOT NULL | — |
| `description` | text | nullable |
| `image_url` | text | nullable |
| `ingredient_count` | int | `0` |
| `step_count` | int | `0` |
| `collection_id` | uuid FK → collections, RESTRICT, NOT NULL | — |
| `created_at` | timestamptz | `now()` |
| `updated_at` | timestamptz | `now()` |

**`recipe_ingredients` table:**
| Column | Type | Default |
|--------|------|---------|
| `id` | uuid PK | `gen_random_uuid()` |
| `recipe_id` | uuid FK → recipes, CASCADE | — |
| `name` | text NOT NULL | — |
| `quantity` | text | nullable (free-form, e.g., "2 cups") |
| `sort_order` | int | `0` |

**`recipe_steps` table:**
| Column | Type | Default |
|--------|------|---------|
| `id` | uuid PK | `gen_random_uuid()` |
| `recipe_id` | uuid FK → recipes, CASCADE | — |
| `instruction` | text NOT NULL | — |
| `sort_order` | int | `0` |

**Storage:** `recipe-images` bucket (public, 5MB limit, jpeg/png/webp). Path: `{userId}/{recipeId}.{ext}`.

**RLS:** Uses `SECURITY DEFINER` helper functions (`is_recipe_owner`, `is_collection_owner`, `is_collection_shared_with_me`, `has_collection_write_permission`) to avoid recursion. Recipes visible to owner OR shared collection members. Insert/update/delete restricted to owner or users with write permission on the collection.

**Realtime:** `recipes`, `recipe_ingredients`, `recipe_steps`, `collections`, `collection_shares` all in `supabase_realtime` publication.

### Swift Codebase (what Phase 5 builds on)

Phase 1–4 established these patterns that Phase 5 follows:

- **Services:** Static `struct` with `SupabaseManager.shared.client`, async/throws functions, private DTOs with `CodingKeys` for snake_case mapping (see `ListService.swift`, `StoreService.swift`)
- **ViewModels:** `@Observable @MainActor final class`, `nonisolated(unsafe)` for Realtime channels/tasks, `RealtimeChannelV2` for subscriptions, `postgresChange(AnyAction.self, ...)` pattern, re-fetch on any change event (see `ListViewModel.swift`)
- **Views:** SwiftUI with `@Environment` for view models, `.sheet` for creation flows, `NavigationStack` for drill-down, `.searchable` for search bars, `.confirmationDialog` for destructive actions, `EmojiPickerView` for emoji selection (see `ListBrowserView.swift`, `CreateListSheet.swift`, `ShareListSheet.swift`)
- **Models:** `Codable, Identifiable, Hashable` structs with `CodingKeys` for snake_case (see `GatherList.swift`, `ListShare.swift`, `Store.swift`, `Item.swift`)

### React Patterns (reference for parity)

- **RecipeSelector.jsx** (1434 lines): Two-state component — collection list ↔ recipe list within collection. Search, 3-dot menus, inline rename with emoji picker, new collection form, move-to-collection picker, templates section. Owned/shared collections with different menu options based on ownership.
- **MobileRecipeDetail.jsx** (426 lines): Hero image, checkable ingredients, numbered steps, 3-dot menu (edit/delete/move to collection), "Add to List" button for checked ingredients, move-to-collection picker modal.
- **RecipeForm.jsx** (601 lines): Full-screen form with name, image (upload or URL), drag-to-reorder ingredients and steps via `@dnd-kit`, text import overlay.
- **ShareCollectionModal.jsx** (200 lines): Email input, collaborator list with remove, portal-rendered modal.
- **DeleteCollectionDialog.jsx** (85 lines): Two options when collection has recipes — move to default or delete all.
- **RecipeContext.jsx** (332 lines): State shape: `{ collections, sharedCollections, activeCollectionId, recipes (derived), allRecipes, sharedCollectionRecipes, activeRecipeId, activeRecipe }`. Realtime subscriptions for owned collections, shared collections, owned recipes, shared collection recipes.
- **recipeDatabase.js** (951 lines): Full CRUD + sharing + subscriptions for recipes, ingredients, steps, collections, collection_shares. `ensureDefaultCollection` auto-creates "My Recipes" (📖).

## User Stories

### US-001: Data Models — Recipe, Ingredient, Step, Collection, CollectionShare

**Description:** Create Codable model structs for all recipe and collection database tables so the service layer can decode Supabase responses.

**Acceptance Criteria:**

- [ ] Create `Models/Recipe.swift` with struct `Recipe: Codable, Identifiable, Hashable` — fields: `id` (UUID), `ownerId` (UUID), `name` (String), `description` (String?), `imageUrl` (String?), `ingredientCount` (Int), `stepCount` (Int), `collectionId` (UUID), `createdAt` (Date), `updatedAt` (Date). `CodingKeys` mapping snake_case.
- [ ] Create `Models/RecipeIngredient.swift` with struct `RecipeIngredient: Codable, Identifiable, Hashable` — fields: `id` (UUID), `recipeId` (UUID), `name` (String), `quantity` (String?), `sortOrder` (Int). `CodingKeys` mapping snake_case.
- [ ] Create `Models/RecipeStep.swift` with struct `RecipeStep: Codable, Identifiable, Hashable` — fields: `id` (UUID), `recipeId` (UUID), `instruction` (String), `sortOrder` (Int). `CodingKeys` mapping snake_case.
- [ ] Create `Models/RecipeCollection.swift` with struct `RecipeCollection: Codable, Identifiable, Hashable` — fields: `id` (UUID), `ownerId` (UUID), `name` (String), `emoji` (String?), `description` (String?), `isDefault` (Bool), `sortOrder` (Int), `createdAt` (Date), `updatedAt` (Date). `CodingKeys` mapping snake_case. **Note:** Name the struct `RecipeCollection` to avoid collision with Swift's `Collection` protocol.
- [ ] Create `Models/CollectionShare.swift` with struct `CollectionShare: Codable, Identifiable` — fields: `id` (UUID), `collectionId` (UUID), `sharedWithEmail` (String), `sharedBy` (UUID?), `permission` (String), `addedAt` (Date). `CodingKeys` mapping snake_case.
- [ ] All models use `UUID` for IDs, `Date` for timestamps
- [ ] Build succeeds

---

### US-002: RecipeService — Collection CRUD & Default Collection

**Description:** Create a service layer for collection operations following the same static-struct pattern as `ListService` and `StoreService`.

**Acceptance Criteria:**

- [ ] Create `Services/RecipeService.swift` as `struct RecipeService` with `private static var client: SupabaseClient { SupabaseManager.shared.client }`
- [ ] `fetchCollections(userId: UUID) async throws -> [RecipeCollection]` — fetches all owned collections ordered by `sort_order`, `created_at`
- [ ] `createCollection(userId: UUID, name: String, emoji: String?, description: String?) async throws -> RecipeCollection` — inserts and returns the new collection
- [ ] `updateCollection(collectionId: UUID, name: String?, emoji: String?, description: String?) async throws` — partial update, only non-nil fields
- [ ] `deleteCollection(collectionId: UUID) async throws` — deletes the collection (caller must handle recipes first — DB has RESTRICT FK)
- [ ] `ensureDefaultCollection(userId: UUID) async throws -> RecipeCollection` — checks for an existing `is_default = true` collection; if none exists, creates one named "My Recipes" with emoji "📖" and `is_default = true`; returns the default collection either way
- [ ] Private DTOs (`NewCollection`, `CollectionUpdate`) with `CodingKeys` for snake_case, matching the `ListService` pattern
- [ ] All functions follow async/throws error pattern
- [ ] Build succeeds

---

### US-003: RecipeService — Recipe CRUD & Ingredients/Steps

**Description:** Add recipe CRUD functions to RecipeService, including ingredient and step management.

**Acceptance Criteria:**

- [ ] `fetchRecipes(userId: UUID) async throws -> [Recipe]` — fetches all owned recipes ordered by `created_at` descending
- [ ] `fetchRecipesForCollection(collectionId: UUID) async throws -> [Recipe]` — fetches recipes in a specific collection ordered by `created_at` descending
- [ ] `createRecipe(userId: UUID, name: String, description: String?, collectionId: UUID, ingredients: [(name: String, quantity: String?)], steps: [String]) async throws -> Recipe` — inserts recipe row, then ingredient rows (with `sort_order` = array index), then step rows (with `sort_order` = array index). Updates `ingredient_count` and `step_count` on the recipe. Returns the recipe.
- [ ] `updateRecipe(recipeId: UUID, name: String?, description: String?) async throws` — updates recipe fields
- [ ] `deleteRecipe(recipeId: UUID) async throws` — deletes recipe (ingredients/steps cascade)
- [ ] `updateRecipeIngredients(recipeId: UUID, ingredients: [(name: String, quantity: String?)]) async throws` — deletes all existing ingredients for the recipe, inserts new ones with `sort_order`, updates `ingredient_count` on the recipe
- [ ] `updateRecipeSteps(recipeId: UUID, steps: [String]) async throws` — deletes all existing steps for the recipe, inserts new ones with `sort_order`, updates `step_count` on the recipe
- [ ] `fetchRecipeDetail(recipeId: UUID) async throws -> (recipe: Recipe, ingredients: [RecipeIngredient], steps: [RecipeStep])` — fetches recipe + its ingredients (ordered by `sort_order`) + its steps (ordered by `sort_order`)
- [ ] `moveRecipeToCollection(recipeId: UUID, collectionId: UUID) async throws` — updates `collection_id` on the recipe
- [ ] Private DTOs with `CodingKeys` for inserts
- [ ] Build succeeds

---

### US-004: RecipeService — Collection Sharing

**Description:** Add collection sharing functions to RecipeService, following the same pattern as `ListService` share operations and `ShareListSheet`.

**Acceptance Criteria:**

- [ ] `shareCollection(collectionId: UUID, email: String, sharedBy: UUID) async throws` — normalizes email (lowercase, trimmed), inserts into `collection_shares` with `permission = 'write'`
- [ ] `unshareCollection(collectionId: UUID, email: String) async throws` — deletes the matching `collection_shares` row
- [ ] `fetchCollectionShares(collectionId: UUID) async throws -> [CollectionShare]` — fetches all share records for the collection
- [ ] `fetchSharedCollections(email: String) async throws -> [RecipeCollection]` — fetches collections shared with this email by joining `collection_shares` → `collections`, or by fetching share records then fetching the collections
- [ ] All email inputs normalized to lowercase/trimmed (match `ListService.shareList` pattern)
- [ ] Private DTOs with `CodingKeys` for inserts
- [ ] Build succeeds

---

### US-005: RecipeViewModel — @Observable State & Realtime

**Description:** Create the main view model for recipes and collections, following the `ListViewModel` pattern with @Observable, realtime subscriptions, and state management.

**Acceptance Criteria:**

- [ ] Create `ViewModels/RecipeViewModel.swift` as `@Observable @MainActor final class RecipeViewModel`
- [ ] **State properties:** `collections: [RecipeCollection]`, `sharedCollections: [RecipeCollection]`, `activeCollectionId: UUID?`, `activeRecipeId: UUID?`, `activeRecipeDetail: (recipe: Recipe, ingredients: [RecipeIngredient], steps: [RecipeStep])?`, `isLoading: Bool`, `error: String?`, `searchQuery: String`
- [ ] **Computed properties:** `activeCollectionRecipes: [Recipe]` (filtered by `activeCollectionId`), `filteredCollections: [RecipeCollection]` (filtered by `searchQuery`)
- [ ] **Init:** takes `userId: UUID, userEmail: String`. On init, calls `loadData()` then `setupRealtimeSubscriptions()`
- [ ] **loadData():** Fetches owned collections (+ ensures default), shared collections, and all owned recipes in parallel. Sets `activeCollectionId` to the default collection.
- [ ] **Realtime channels:** Subscribe to `collections` (filtered by `owner_id`), `collection_shares` (filtered by `shared_with_email`), and `recipes` (filtered by `owner_id`). On any change event, re-fetch all data (same pattern as `ListViewModel`).
- [ ] `nonisolated(unsafe)` for channel/task properties, proper `deinit` cancellation (match `ListViewModel`)
- [ ] **Collection actions:** `createCollection(name:emoji:description:)`, `updateCollection(id:name:emoji:description:)`, `deleteCollection(id:deleteRecipes:)` — if `deleteRecipes` is false, moves recipes to default collection first; if the active collection is deleted, falls back to default
- [ ] **Recipe actions:** `createRecipe(name:description:ingredients:steps:)` — creates in `activeCollectionId`, `updateRecipe(id:name:description:)`, `deleteRecipe(id:)`, `updateIngredients(recipeId:ingredients:)`, `updateSteps(recipeId:steps:)`, `moveRecipe(recipeId:toCollectionId:)`
- [ ] **Selection actions:** `selectCollection(id:)` — sets `activeCollectionId`, clears `activeRecipeId`; `selectRecipe(id:)` — sets `activeRecipeId`, fetches recipe detail
- [ ] **Share actions:** `shareCollection(id:email:)`, `unshareCollection(id:email:)`
- [ ] **Refresh:** `refresh()` async function for pull-to-refresh
- [ ] Build succeeds

---

### US-006: Collection Browser View — List + Search + Create

**Description:** Build the root view of the Recipes tab — a collection browser showing owned and shared collections with search, create, and management actions.

**Acceptance Criteria:**

- [ ] Create `Views/Recipes/CollectionBrowserView.swift`
- [ ] `NavigationStack` wrapping the entire view for 3-level drill-down (collections → recipes → detail)
- [ ] `.navigationTitle("Recipes")`
- [ ] `.searchable(text:)` bound to view model's `searchQuery` for filtering collections by name
- [ ] **Toolbar:** `+` button that presents `CreateCollectionSheet` as a `.sheet`
- [ ] **"My Collections" section:** Grouped inset `List` showing owned collections — each row shows emoji (or 📁 default) + name + recipe count badge + chevron. `NavigationLink` pushes to `CollectionRecipeListView`
- [ ] **"Shared with Me" section:** Shows shared collections — each row shows emoji + name + "Shared" badge + chevron. `NavigationLink` pushes to `CollectionRecipeListView`
- [ ] **Swipe actions on owned collections:** `.swipeActions(edge: .trailing)` with Delete (red, destructive). Delete shows `.confirmationDialog` with two options: "Delete collection and N recipes" vs "Move N recipes to [Default] and delete" (same as React `DeleteCollectionDialog`)
- [ ] **Context menu on owned collections:** Rename, Share, Delete
- [ ] **Context menu on shared collections:** Leave (unshare self)
- [ ] **Empty state:** When no collections exist — icon + "No collections yet" + "Create one to organize your recipes" text
- [ ] **Loading state:** `ProgressView` while `isLoading` is true and collections are empty
- [ ] Pull-to-refresh via `.refreshable { await viewModel.refresh() }`
- [ ] Build succeeds

---

### US-007: Create Collection Sheet

**Description:** Bottom sheet for creating a new collection with name and emoji picker, consistent with Phase 2 `CreateListSheet` and Phase 4 create-store patterns.

**Acceptance Criteria:**

- [ ] Create `Views/Recipes/CreateCollectionSheet.swift`
- [ ] `.sheet` presentation (presented from CollectionBrowserView's `+` toolbar button)
- [ ] `NavigationStack` with title "New Collection", Cancel + Save toolbar buttons
- [ ] **Name field:** `TextField` for collection name, required (Save disabled when empty)
- [ ] **Emoji picker:** Reuse `EmojiPickerView` component from Phase 2. Default emoji: 📖. Tapping the emoji opens the picker.
- [ ] **Description field:** Optional `TextField` for description
- [ ] **Save action:** Calls `viewModel.createCollection(name:emoji:description:)`, dismisses on success
- [ ] **Loading state:** `ProgressView` on Save button while creating
- [ ] Build succeeds

---

### US-008: Collection Recipe List View — Browse Recipes Within Collection

**Description:** When a collection is tapped in the browser, push to a recipe list showing all recipes within that collection, with search, create, and management actions.

**Acceptance Criteria:**

- [ ] Create `Views/Recipes/CollectionRecipeListView.swift`
- [ ] Takes `collection: RecipeCollection` and `viewModel: RecipeViewModel` as parameters
- [ ] `.navigationTitle(collection.name)` with the collection emoji in the title or as a leading element
- [ ] `.searchable(text:)` for filtering recipes within this collection by name
- [ ] **Toolbar:** `+` button that presents `RecipeFormSheet` as a `.sheet`
- [ ] **Recipe rows:** Each row shows recipe image thumbnail (async loaded from `imageUrl`, or a placeholder icon if none) + name + subtitle showing "N ingredients · M steps". `NavigationLink` pushes to `RecipeDetailView`
- [ ] **Swipe actions on owned recipes:** `.swipeActions(edge: .trailing)` with Delete (red, destructive, with `.confirmationDialog`)
- [ ] **Context menu on owned recipes:** Edit, Move to Collection, Delete
- [ ] **Context menu on recipes in shared collections (added by current user):** Edit, Remove
- [ ] **Context menu on recipes in shared collections (added by others):** View only (no destructive actions)
- [ ] **"Move to Collection" action:** Presents a picker sheet listing all owned collections (excluding current). Selecting one calls `viewModel.moveRecipe(recipeId:toCollectionId:)`
- [ ] **Empty state:** When collection has no recipes — icon + "No recipes yet" + "Tap + to create one"
- [ ] On appear, calls `viewModel.selectCollection(id: collection.id)` to set the active collection
- [ ] Build succeeds

---

### US-009: Create/Edit Recipe Sheet

**Description:** Bottom sheet form for creating a new recipe or editing an existing one. Includes name, description, structured ingredients (with quantity), and structured steps. Image upload is deferred to Phase 6.

**Acceptance Criteria:**

- [ ] Create `Views/Recipes/RecipeFormSheet.swift`
- [ ] `.sheet` presentation from recipe list's `+` button (create mode) or from context menu "Edit" (edit mode)
- [ ] `NavigationStack` with title "New Recipe" or "Edit Recipe", Cancel + Save toolbar buttons
- [ ] **Recipe name:** `TextField`, required (Save disabled when empty)
- [ ] **Description:** Optional `TextField` (or `TextEditor` for multiline)
- [ ] **Ingredients section:** Header "Ingredients" with `+ Add` button. Each ingredient row has two fields: name (`TextField`, required) and quantity (`TextField`, optional, placeholder "e.g., 2 cups"). Swipe-to-delete on each ingredient (`.onDelete`). Drag-to-reorder via `.onMove` in edit mode. At least 1 ingredient required for Save.
- [ ] **Steps section:** Header "Steps" with `+ Add` button. Each step row has a numbered label (auto-incremented) and instruction `TextField`. Swipe-to-delete on each step (`.onDelete`). Drag-to-reorder via `.onMove` in edit mode.
- [ ] **Edit mode:** Pre-populates all fields from `RecipeViewModel.activeRecipeDetail`. On save, calls `updateRecipe` + `updateIngredients` + `updateSteps`.
- [ ] **Create mode:** Empty form. On save, calls `createRecipe` with the active collection.
- [ ] **Validation:** Name required, at least 1 ingredient with a non-empty name. Show inline validation messages.
- [ ] **Loading state:** `ProgressView` overlay while saving
- [ ] **Dismiss on success**
- [ ] Build succeeds

---

### US-010: Recipe Detail View — Scrollable Content + Ingredient Checkboxes

**Description:** Pushed view showing full recipe details — hero image (if present), checkable ingredients, numbered steps, and action menu.

**Acceptance Criteria:**

- [ ] Create `Views/Recipes/RecipeDetailView.swift`
- [ ] Takes `recipeId: UUID` and `viewModel: RecipeViewModel`. On appear, calls `viewModel.selectRecipe(id:)` to fetch detail.
- [ ] **Navigation title:** Recipe name
- [ ] **Hero image:** If `imageUrl` is non-nil, show `AsyncImage` full-width at top with placeholder and loading states. Aspect ratio fill, max height ~250pt, clipped. If no image, omit the section entirely (no empty placeholder).
- [ ] **Description:** If non-nil, show below hero image in `.secondary` style
- [ ] **Ingredients section:** "Ingredients" header with count badge. Each ingredient shows a **checkbox** (tappable circle) + quantity (if present, in `.secondary`) + name. Checked state is local `@State` only (not persisted — prep for Phase 6 add-to-list). Checked ingredients get strikethrough styling.
- [ ] **Steps section:** "Steps" header with count badge. Each step shows a numbered circle (1, 2, 3...) + instruction text. Read-only.
- [ ] **Toolbar menu (3-dot / ellipsis):** For owned recipes: Edit (presents `RecipeFormSheet`), Move to Collection (presents collection picker), Delete (`.confirmationDialog`). For shared collection recipes the user added: Edit, Remove. For shared collection recipes added by others: no menu or view-only.
- [ ] **Loading state:** `ProgressView` while `activeRecipeDetail` is nil and loading
- [ ] **Scrollable:** Entire content in a `ScrollView` (not a `List`)
- [ ] Build succeeds

---

### US-011: Share Collection Sheet

**Description:** Sheet for managing collection sharing — add and remove collaborators by email. Follows the `ShareListSheet` pattern exactly.

**Acceptance Criteria:**

- [ ] Create `Views/Recipes/ShareCollectionSheet.swift`
- [ ] Takes `collection: RecipeCollection`, `viewModel: RecipeViewModel`, `ownerEmail: String`
- [ ] **Layout:** Matches `ShareListSheet` structure — `NavigationStack` with "Share [Collection Name]" title, "Done" toolbar button, add collaborator section at top, collaborator list below
- [ ] **Add section:** `TextField` for email + "Add" button. Validation: non-empty, contains `@` and `.`, not the owner's email, not already shared. Error banner shown inline.
- [ ] **Collaborator list:** `List` with `Section("Collaborators")` showing each share's email + added date + trash button. `.onDelete` for swipe-to-delete.
- [ ] **Loading states:** `ProgressView` on Add button while adding, `ProgressView` on individual row while removing, `ProgressView` with "Loading collaborators..." when list is empty and loading
- [ ] **Empty state:** "No collaborators yet" with icon and subtitle
- [ ] On appear, fetches shares via `RecipeService.fetchCollectionShares`
- [ ] Add calls `viewModel.shareCollection(id:email:)`, then re-fetches shares
- [ ] Remove calls `viewModel.unshareCollection(id:email:)`, then re-fetches shares
- [ ] Handles duplicate/UNIQUE constraint errors with "This person already has access" message
- [ ] Build succeeds

---

### US-012: Wire Recipes Tab — Replace Placeholder in MainTabView

**Description:** Replace `RecipesPlaceholderView` with the real `CollectionBrowserView` wired to a `RecipeViewModel`, and pass the view model through the environment.

**Acceptance Criteria:**

- [ ] In `MainTabView.swift`, replace `RecipesPlaceholderView()` with `CollectionBrowserView()`
- [ ] Create `RecipeViewModel` in `MainTabView` (or in `GatherListsApp.swift` at the app level) using the authenticated user's `userId` and `email`, and inject via `.environment(recipeViewModel)`
- [ ] `CollectionBrowserView` reads `RecipeViewModel` from `@Environment`
- [ ] All child views (`CollectionRecipeListView`, `RecipeDetailView`, `RecipeFormSheet`, `ShareCollectionSheet`, `CreateCollectionSheet`) access the view model via `@Environment` or explicit parameter passing (match the pattern used by lists)
- [ ] Remove `RecipesPlaceholderView` struct entirely
- [ ] Tab icon stays `"book"`, label stays `"Recipes"`
- [ ] Build succeeds on iPhone simulator
- [ ] Full navigation flow works: tap Recipes tab → see collections → tap collection → see recipes → tap recipe → see detail → back works at each level

---

### US-013: Rename Collection — Inline Edit

**Description:** Allow renaming a collection and changing its emoji from the context menu.

**Acceptance Criteria:**

- [ ] "Rename" in the collection context menu presents an edit sheet (`.sheet`) with pre-filled name and emoji
- [ ] Reuse `EmojiPickerView` for emoji editing
- [ ] Save calls `viewModel.updateCollection(id:name:emoji:description:)`
- [ ] Updated collection appears immediately in the browser (optimistic local update or realtime-driven refresh)
- [ ] Build succeeds

---

### US-014: Realtime Sync — Cross-Device Verification

**Description:** Verify that all recipe and collection changes sync in real-time across devices/sessions, matching the `ListViewModel` realtime behavior.

**Acceptance Criteria:**

- [ ] **Collections channel:** Subscribes to `collections` table filtered by `owner_id`. Any INSERT/UPDATE/DELETE triggers full data re-fetch.
- [ ] **Collection shares channel:** Subscribes to `collection_shares` table filtered by `shared_with_email`. Any change triggers re-fetch of shared collections.
- [ ] **Recipes channel:** Subscribes to `recipes` table filtered by `owner_id`. Any change triggers re-fetch of recipes (and updates `activeCollectionRecipes` computed property).
- [ ] Duplicate channel guard: `guard channel == nil` before setting up (match `ListViewModel` pattern)
- [ ] Proper `deinit`: Cancel all tasks, unsubscribe all channels
- [ ] Creating a recipe on the React web app shows it in the Swift app within seconds (and vice versa)
- [ ] Sharing a collection on React shows the shared collection in Swift within seconds
- [ ] Deleting a recipe on one client removes it from the other
- [ ] Build succeeds

## Functional Requirements

- FR-1: Users see a collection browser as the root of the Recipes tab, showing owned and shared collections
- FR-2: Tapping a collection drills into a recipe list filtered to that collection
- FR-3: Tapping a recipe drills into a full detail view with hero image, ingredients, and steps
- FR-4: Users can create collections with name + emoji via a bottom sheet
- FR-5: Users can rename collections and change their emoji
- FR-6: Users can delete collections — with the choice to move recipes to default or delete all
- FR-7: A default "My Recipes" (📖) collection is auto-created for new users
- FR-8: Users can create recipes with name, description, structured ingredients (name + quantity), and structured steps
- FR-9: Users can edit recipe name, description, ingredients, and steps
- FR-10: Users can delete recipes with confirmation
- FR-11: Users can move recipes between collections
- FR-12: Recipe ingredients have checkboxes (local state only — add-to-list flow is Phase 6)
- FR-13: Users can share collections by email — shared users can view and add recipes
- FR-14: Shared users can remove recipes they added, but not recipes added by others
- FR-15: All data syncs in real-time via Supabase Realtime
- FR-16: Navigation follows iOS 3-level drill-down: collections → recipes → detail

## Non-Goals (Deferred to Phase 6)

- No recipe image upload (display existing `image_url` only — upload is Phase 6)
- No "Add to List" cross-tab flow (checkboxes are prepped but the list picker modal is Phase 6)
- No recipe templates (6 hardcoded templates are Phase 6)
- No text import / paste import (Phase 6)
- No recipe image search or product search
- No AI-generated recipes

## Technical Considerations

- **Model naming:** Use `RecipeCollection` (not `Collection`) to avoid collision with Swift's `Collection` protocol.
- **Service pattern:** Follow `ListService` and `StoreService` — static struct, `SupabaseManager.shared.client`, async/throws, private DTOs with `CodingKeys`.
- **ViewModel pattern:** Follow `ListViewModel` — `@Observable @MainActor`, `nonisolated(unsafe)` for Realtime channels, re-fetch-all on change events.
- **NavigationStack:** Single `NavigationStack` at the `CollectionBrowserView` level wrapping all 3 levels of drill-down. Use `NavigationLink(value:)` + `.navigationDestination(for:)` for type-safe navigation.
- **Recipe detail fetch:** `selectRecipe(id:)` fetches the full detail (recipe + ingredients + steps) on demand, not upfront. This keeps the recipe list lightweight.
- **Default collection:** `ensureDefaultCollection` is called during `RecipeViewModel.loadData()` — same pattern as React's `RecipeContext`.
- **Delete collection with RESTRICT FK:** The app must either move or delete recipes before calling `deleteCollection`, since the DB has `ON DELETE RESTRICT` on `recipes.collection_id`. The view model handles this in `deleteCollection(id:deleteRecipes:)`.
- **Ingredient/step rewrite pattern:** `updateRecipeIngredients` and `updateRecipeSteps` use a delete-all-then-reinsert pattern (same as React). This is simple and avoids diffing complexity.

## Credential & Service Access Plan

No external credentials required for this PRD. All functionality uses the existing Supabase project (database, storage, realtime, auth).

## Definition of Done

Implementation is complete when:

1. The Recipes tab shows a collection browser with owned and shared sections
2. Users can create, rename, and delete collections with emoji picker
3. A default "My Recipes" (📖) collection is auto-created for new users
4. Tapping a collection shows its recipes in a drill-down list
5. Users can create recipes with name, description, ingredients (name + quantity), and steps
6. Users can edit and delete recipes
7. Users can move recipes between collections
8. Recipe detail view shows hero image (if present), checkable ingredients, and numbered steps
9. Users can share collections by email, with collaborators able to view and add recipes
10. All changes sync in real-time across devices
11. Full 3-level NavigationStack drill-down works with proper back navigation
12. `RecipesPlaceholderView` is removed from `MainTabView`
13. Build succeeds on iPhone simulator
14. No regression in Lists, Stores, Settings, or Auth functionality
