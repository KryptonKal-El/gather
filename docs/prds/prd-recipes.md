# PRD: Full Recipes Feature

## Introduction

Build a complete recipe management system as a first-class tab in ShoppingListAI. Users can create, view, edit, share, and browse recipes — each with a name, image, ingredients, and structured steps. Recipes integrate with shopping lists via an "Add to List" flow where users pick ingredients and choose a target list. The existing "Recipe to List" panel (hardcoded templates + paste parser) is relocated from the list detail view into the Recipes tab as a "Browse Templates" section and an import option.

## Goals

- Add a "Recipes" tab to the bottom navigation bar, positioned between Lists and Stores
- Provide full CRUD for user-created recipes (name, image, ingredients, structured steps)
- Support recipe images via both photo upload (Supabase Storage) and URL
- Enable "Add to List" flow: user selects ingredients from a recipe, picks a target shopping list, and the items are added
- Share recipes with other users (same sharing model as lists — by email)
- Move the 6 hardcoded Quick Recipe templates into a "Browse Templates" section
- Keep the paste-recipe import flow as an option when creating a new recipe
- Support AI-generated recipes in the future (not in this PRD)

## User Stories

### US-001: Create `recipes` and `recipe_ingredients` and `recipe_steps` Database Tables

**Description:** As a developer, I need database tables to persist recipes, their ingredients, and their steps so the feature has a backend.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create Supabase migration `YYYYMMDDHHMMSS_create_recipes_tables.sql`
- [ ] `recipes` table: `id` (uuid PK), `owner_id` (uuid FK → profiles, ON DELETE CASCADE), `name` (text NOT NULL), `description` (text), `image_url` (text), `ingredient_count` (int DEFAULT 0), `step_count` (int DEFAULT 0), `created_at` (timestamptz DEFAULT now()), `updated_at` (timestamptz DEFAULT now())
- [ ] `recipe_ingredients` table: `id` (uuid PK), `recipe_id` (uuid FK → recipes, ON DELETE CASCADE), `name` (text NOT NULL), `quantity` (text — free-form like "2 cups"), `sort_order` (int DEFAULT 0)
- [ ] `recipe_steps` table: `id` (uuid PK), `recipe_id` (uuid FK → recipes, ON DELETE CASCADE), `instruction` (text NOT NULL), `sort_order` (int DEFAULT 0)
- [ ] Indexes: `idx_recipes_owner_id`, `idx_recipe_ingredients_recipe_id`, `idx_recipe_steps_recipe_id`
- [ ] Enable RLS on all three tables
- [ ] RLS policies: owner can CRUD their own recipes/ingredients/steps; shared users can SELECT
- [ ] Enable Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE recipes, recipe_ingredients, recipe_steps;`
- [ ] Migration runs successfully against Supabase
- [ ] Lint passes

### US-002: Create `recipe_shares` Table and Sharing RLS

**Description:** As a developer, I need a sharing table so recipes can be shared with other users by email, following the same pattern as `list_shares`.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Add to the same migration (or a new one): `recipe_shares` table: `id` (uuid PK), `recipe_id` (uuid FK → recipes, ON DELETE CASCADE), `shared_with_email` (text NOT NULL), `added_at` (timestamptz DEFAULT now())
- [ ] Index: `idx_recipe_shares_shared_with_email`, `idx_recipe_shares_recipe_id`
- [ ] RLS policies: recipe owner can INSERT/DELETE shares; shared user (matched by email) can SELECT
- [ ] Shared users can SELECT the recipe, its ingredients, and its steps via RLS (read-only)
- [ ] Enable Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE recipe_shares;`
- [ ] Lint passes

### US-003: Create `recipe-images` Supabase Storage Bucket

**Description:** As a developer, I need a storage bucket for recipe images so users can upload photos.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Add to migration: create `recipe-images` storage bucket (public read, authenticated upload)
- [ ] Storage policies: authenticated users can upload to `recipe-images/{user_id}/*`
- [ ] Users can only delete their own images
- [ ] Max file size: 5MB
- [ ] Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- [ ] Lint passes

### US-004: Recipe Database Service Layer

**Description:** As a developer, I need Supabase CRUD functions for recipes so the UI can create, read, update, and delete recipes.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `src/services/recipeDatabase.js` with the following exports:
- [ ] `createRecipe(userId, recipe)` — inserts recipe row + ingredient rows + step rows in a single transaction, returns recipe ID
- [ ] `updateRecipe(userId, recipeId, updates)` — updates recipe fields (name, description, image_url)
- [ ] `deleteRecipe(userId, recipeId)` — deletes recipe (cascades to ingredients, steps, shares)
- [ ] `updateRecipeIngredients(recipeId, ingredients)` — replaces all ingredients for a recipe (delete + insert)
- [ ] `updateRecipeSteps(recipeId, steps)` — replaces all steps for a recipe (delete + insert)
- [ ] `uploadRecipeImage(userId, recipeId, file)` — uploads to `recipe-images/{userId}/{recipeId}`, returns public URL, updates recipe.image_url
- [ ] `subscribeRecipes(userId, callback)` — initial fetch + Realtime subscription for user's own recipes
- [ ] `subscribeRecipeDetail(recipeId, callback)` — fetches recipe + ingredients + steps, subscribes to changes
- [ ] `shareRecipe(recipeId, email)` — inserts into `recipe_shares`
- [ ] `unshareRecipe(recipeId, email)` — deletes from `recipe_shares`
- [ ] `subscribeSharedRecipeRefs(email, callback)` — like `subscribeSharedListRefs` but for recipes
- [ ] All functions follow the same error handling pattern as `src/services/database.js` (try/catch, descriptive Error with cause)
- [ ] All functions have JSDoc comments
- [ ] Lint passes

### US-005: `useRecipes` Hook for State Management

**Description:** As a developer, I need a React hook to manage recipe state (own recipes, shared recipes, active recipe) so components can consume recipe data.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `src/hooks/useRecipes.js`
- [ ] Hook subscribes to user's own recipes via `subscribeRecipes`
- [ ] Hook subscribes to shared recipe refs via `subscribeSharedRecipeRefs`
- [ ] Exposes: `recipes` (own), `sharedRecipes` (shared refs), `activeRecipeId`, `activeRecipe` (detail data including ingredients + steps)
- [ ] Exposes actions: `createRecipe`, `updateRecipe`, `deleteRecipe`, `updateIngredients`, `updateSteps`, `uploadImage`, `shareRecipe`, `unshareRecipe`, `selectRecipe`
- [ ] `selectRecipe(id)` triggers `subscribeRecipeDetail` and populates `activeRecipe`
- [ ] Cleans up subscriptions on unmount
- [ ] Lint passes

### US-006: Add "Recipes" Tab to Bottom Navigation

**Description:** As a user, I want a "Recipes" tab in the bottom toolbar so I can access my recipes from anywhere in the app.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Add a 4th tab to `BottomTabBar.jsx` with id `'recipes'`, label `'Recipes'`, and a book/utensils SVG icon
- [ ] Tab is positioned between "Lists" and "Stores" (order: Lists, Recipes, Stores, Settings)
- [ ] Update `PropTypes.oneOf` to include `'recipes'`
- [ ] Update `useMobileNav.js`: add `'recipes'` to valid tab values, add `openRecipeId` state for recipe detail push/pop (same pattern as `openListId`)
- [ ] Update `App.jsx`: add `activeTab === 'recipes'` branch in `renderMobileContent()` (render placeholder for now — wired in US-008)
- [ ] Tab icons remain evenly spaced with 4 tabs (verify visually)
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-007: Recipe List Screen (Mobile)

**Description:** As a user, I want to see all my recipes on the Recipes tab, with search and a button to create new ones, matching the layout of the Lists screen.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `src/components/RecipeSelector.jsx` and `RecipeSelector.module.css`
- [ ] Fixed header with "My Recipes" title and `+ New` button (same layout pattern as `ListSelector`)
- [ ] Search bar below the header — filters recipes by name
- [ ] Scrollable list of recipe cards: recipe image thumbnail (or placeholder icon if no image), recipe name, ingredient count (e.g., "8 ingredients"), step count (e.g., "5 steps")
- [ ] Tapping a recipe card navigates to recipe detail (calls `handleOpenRecipe` from nav hook)
- [ ] "Shared with me" section below own recipes (same pattern as shared lists in `ListSelector`)
- [ ] Empty state when no recipes exist: "No recipes yet. Tap + to create one."
- [ ] Three-dot menu per recipe: Edit, Share, Delete (with confirmation)
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-008: Wire Recipe List Screen into App.jsx

**Description:** As a developer, I need the recipe list screen wired into the main app so switching to the Recipes tab shows the recipe list with push/pop transitions to detail view.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Initialize `useRecipes` hook in `App.jsx`
- [ ] `renderMobileContent()` → `activeTab === 'recipes'` renders `RecipeSelector` with slide container (same push/pop pattern as lists)
- [ ] Tapping a recipe pushes to `MobileRecipeDetail` (US-010) with iOS-style slide animation
- [ ] Back button pops back to recipe list with slide animation
- [ ] `renderDesktopContent()` → add recipe selector in sidebar or as a separate section (follow existing desktop layout pattern)
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-009: Create/Edit Recipe Screen

**Description:** As a user, I want to create a new recipe or edit an existing one, entering a name, image, ingredients, and steps.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `src/components/RecipeForm.jsx` and `RecipeForm.module.css`
- [ ] Full-screen modal or pushed view with nav bar (Back / "New Recipe" or "Edit Recipe" / Save)
- [ ] **Recipe Name** — text input, required
- [ ] **Recipe Image** — tap to choose: upload photo (camera/gallery via file input) OR paste image URL; shows preview; optional
- [ ] **Ingredients** — structured list of individual inputs; each ingredient has `name` (required) and `quantity` (optional, free-form text like "2 cups"); "Add ingredient" button at bottom; swipe-to-delete or delete icon per ingredient; drag-to-reorder
- [ ] **Steps** — structured list of individual inputs; each step is a separate text field; numbered automatically; "Add step" button at bottom; swipe-to-delete or delete icon per step; drag-to-reorder
- [ ] Save button calls `createRecipe` or `updateRecipe` + `updateIngredients` + `updateSteps`
- [ ] Image upload calls `uploadRecipeImage` and stores returned URL
- [ ] Validation: name is required, at least 1 ingredient
- [ ] Loading state while saving
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-010: Recipe Detail Screen (Mobile)

**Description:** As a user, I want to view a recipe's full details — image, ingredients, steps — with options to edit, share, add ingredients to a shopping list, or delete.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `src/components/MobileRecipeDetail.jsx` and `MobileRecipeDetail.module.css`
- [ ] Nav bar with back button, recipe name as title, and action buttons (share, edit)
- [ ] Hero image at top (full-width, or placeholder if no image)
- [ ] Ingredients section with checkboxes next to each ingredient (for selecting which to add to list)
- [ ] Steps section with numbered steps
- [ ] "Add to List" button — enabled when at least 1 ingredient is checked; tapping opens a list picker (see US-011)
- [ ] Edit button opens `RecipeForm` in edit mode
- [ ] Share button opens share modal (see US-012)
- [ ] Three-dot menu with Delete option (confirmation dialog)
- [ ] For shared recipes (not owned): read-only view, no edit/delete, but "Add to List" still works
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-011: "Add to List" Flow

**Description:** As a user, I want to select ingredients from a recipe and add them to a shopping list of my choice so I can quickly build a grocery list from a recipe.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `src/components/AddToListModal.jsx` and `AddToListModal.module.css`
- [ ] Modal/bottom sheet shows: list of selected ingredients (read-only summary), dropdown or scrollable list of user's shopping lists to pick from, "Add Items" button
- [ ] Tapping "Add Items" calls `addItems` on the chosen list — uses the existing `parseRecipeText` / ingredient-to-item logic to strip quantities and categorize
- [ ] Success confirmation: "Added N items to [list name]" toast/banner
- [ ] If no lists exist, show "Create a list first" message with a link/button to Lists tab
- [ ] Modal closes after successful add
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-012: Share Recipe Modal

**Description:** As a user, I want to share my recipe with another user by email so they can view it.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `src/components/ShareRecipeModal.jsx` and `ShareRecipeModal.module.css` (follow `ShareListModal` pattern)
- [ ] Email input + "Share" button
- [ ] Shows list of currently shared emails with remove button
- [ ] Calls `shareRecipe` / `unshareRecipe` from `useRecipes`
- [ ] Error handling: invalid email, already shared
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-013: Browse Templates Section

**Description:** As a user, I want to browse pre-built recipe templates so I can get inspiration and quickly add template ingredients to a list or save a template as my own recipe.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Add a "Browse Templates" section/button on the `RecipeSelector` screen (below the recipe list, or as a tab/toggle)
- [ ] Shows the 6 existing `RECIPE_TEMPLATES` from `src/services/recipes.js` as cards
- [ ] Tapping a template shows its details (name, description, ingredient list)
- [ ] Two actions per template: "Save as Recipe" (creates a new recipe pre-filled with template data) and "Add to List" (opens the Add to List modal with template ingredients selected)
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-014: Import Recipe via Paste

**Description:** As a user, I want to paste a recipe's ingredient list when creating a new recipe so I don't have to type each ingredient manually.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Add an "Import from Text" option in `RecipeForm` (button or option when tapping `+ New`)
- [ ] Opens a textarea where user pastes ingredient text (one per line)
- [ ] Uses existing `parseRecipeText` from `src/services/recipes.js` to parse lines into structured ingredients
- [ ] Parsed ingredients are pre-populated into the ingredients list in the form — user can edit before saving
- [ ] Existing `RecipePanel` import from the list detail view is removed (replaced by this flow)
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-015: Remove RecipePanel from List Detail Views

**Description:** As a developer, I need to remove the old RecipePanel from the list detail view since the recipe-to-list functionality now lives in the Recipes tab.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Remove `RecipePanel` import and usage from `MobileListDetail.jsx` (the "Recipe to List" button and bottom sheet overlay)
- [ ] Remove `RecipePanel` import and usage from desktop `renderDesktopContent()` in `App.jsx`
- [ ] Remove `onAddItems` prop threading that was only used for RecipePanel (keep it if still used for other purposes)
- [ ] Verify no broken imports or unused CSS
- [ ] Do NOT delete `RecipePanel.jsx` or `recipes.js` yet — the parsing logic is reused by US-014, and templates by US-013
- [ ] Lint passes

### US-016: Recipe Desktop Layout

**Description:** As a user on desktop, I want to view and manage recipes in the desktop layout alongside my lists.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Desktop layout shows recipe selector as a sidebar section or separate view (follow existing desktop pattern — sidebar + content area)
- [ ] Selecting a recipe shows the detail view in the content area with all the same functionality as mobile (ingredients, steps, add to list, edit, share, delete)
- [ ] `RecipeForm` works on desktop (modal or inline, matching existing desktop patterns)
- [ ] `ShareRecipeModal` works on desktop
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-017: Update project.json

**Description:** As a developer, I need `docs/project.json` updated to reflect the new recipes capability.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Add `"recipes": true` to `capabilities` in `docs/project.json`
- [ ] Lint passes

## Functional Requirements

- FR-1: Users can create recipes with a name (required), optional image, at least 1 ingredient, and optional steps
- FR-2: Recipe ingredients are structured with name and optional free-form quantity
- FR-3: Recipe steps are structured, individually editable, and reorderable
- FR-4: Recipe images can be uploaded (camera/gallery, stored in Supabase Storage) or provided as a URL
- FR-5: Users can select specific ingredients from a recipe and add them to any of their shopping lists
- FR-6: The ingredient-to-list pipeline strips quantities and categorizes items (reuses existing `parseRecipeText` / `categorizeItem` logic)
- FR-7: Recipes can be shared by email — shared users have read-only access with ability to "Add to List"
- FR-8: The bottom tab bar shows 4 tabs: Lists, Recipes, Stores, Settings
- FR-9: The Recipes screen matches the iOS-style layout of the Lists screen (fixed header, search, scrollable content, push/pop detail transitions)
- FR-10: The 6 hardcoded recipe templates are available in a "Browse Templates" section
- FR-11: The old RecipePanel is removed from list detail views — its functionality is replaced by the Recipes tab
- FR-12: Recipe data syncs in real-time via Supabase Realtime (same pattern as lists)

## Non-Goals

- No AI-generated recipes in this PRD (future enhancement — scaffolding supports it)
- No meal planning or calendar integration
- No nutrition information or calorie tracking
- No recipe categories or tags (future enhancement)
- No recipe import from external URLs (e.g., scraping recipe websites)
- No recipe export (PDF, print)
- No recipe versioning or history
- No comments on shared recipes

## Technical Considerations

- **Database pattern:** Follow existing migration structure. Use `gen_random_uuid()` for PKs, `timestamptz DEFAULT now()` for timestamps. RLS follows the same owner-based + sharing patterns as lists.
- **Realtime:** Subscribe to `recipes`, `recipe_ingredients`, `recipe_steps`, `recipe_shares` — same channel pattern as lists/items.
- **Storage:** `recipe-images` bucket mirrors the `item-images` and `profile-images` bucket patterns.
- **Navigation:** No router exists — all navigation is state-driven via `useMobileNav` hook + conditional rendering in `App.jsx`. The Recipes tab follows the same push/pop pattern as Lists.
- **Reuse:** `parseRecipeText`, `RECIPE_TEMPLATES`, `stripQuantity`, `categorizeItem` are all reused. `ShareRecipeModal` follows `ShareListModal` pattern. `RecipeSelector` follows `ListSelector` pattern.
- **Ingredient quantities:** Stored as free-form text ("2 cups", "1/2 lb") in `recipe_ingredients.quantity`, not parsed into number + unit, since display fidelity matters. Parsing only happens when converting to shopping list items.
- **Drag-to-reorder:** For ingredients and steps in the form. Consider a lightweight library or manual drag implementation — keep it simple.

## Credential & Service Access Plan

No external credentials required for this PRD. All functionality uses the existing Supabase project (database, storage, realtime, auth).

## Definition of Done

Implementation is complete when:

1. The "Recipes" tab appears in the bottom toolbar between Lists and Stores
2. Users can create a recipe with name, image (upload or URL), ingredients (structured, reorderable), and steps (structured, reorderable)
3. Users can view recipe details with hero image, ingredients, and numbered steps
4. Users can select ingredients from a recipe and add them to any shopping list via a list picker
5. Users can share recipes by email — shared users see the recipe read-only and can add ingredients to their own lists
6. The "Browse Templates" section shows the 6 pre-built recipe templates with "Save as Recipe" and "Add to List" actions
7. The "Import from Text" option lets users paste an ingredient list that gets parsed into structured ingredients
8. The old RecipePanel is removed from list detail views (both mobile and desktop)
9. All recipe data persists in Supabase with real-time sync
10. Desktop layout supports full recipe CRUD and viewing
11. All screens work in both light and dark mode
12. `docs/project.json` reflects the new recipes capability
13. No regression in existing lists, stores, sharing, or auth functionality

## Success Metrics

- Users can create a recipe and add its ingredients to a list in under 60 seconds
- Recipe detail view loads in under 1 second
- Zero regression in existing feature functionality
- Recipe sharing works identically to list sharing (same UX patterns)

## Open Questions

- Should we add a recipe count badge on the Recipes tab? (Deferred)
- Should "Browse Templates" be expandable with community-contributed templates in the future? (Deferred)
- Should recipes support multiple images (gallery)? (Deferred — single image for now)
- Should we add a "Cook mode" view that shows one step at a time in large text? (Deferred)
- How should the desktop layout handle recipes — separate sidebar section, or integrate with the existing sidebar? (Builder to decide based on existing desktop patterns)
