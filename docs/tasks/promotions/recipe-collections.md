# Promotion: Recipe Collections

## Status: pending_prd
## Promoted: 2026-03-04
## Origin: Ad-hoc feature analysis during builder session
## Target: @planner for PRD creation

---

## Feature Summary

Introduce a "Collections" grouping layer above recipes. Collections become the primary unit of organization and sharing, replacing per-recipe sharing. Users create named collections, add recipes inside them, and share entire collections with other users.

## Problem Statement

Currently, recipes exist as a flat list with per-recipe sharing. As users accumulate recipes, the flat list becomes hard to navigate. Sharing is tedious because each recipe must be shared individually. There is no way to organize recipes into logical groups (e.g., "Weeknight Dinners", "Holiday Baking", "Meal Prep").

## Proposed Solution

- **Collections**: A new entity that groups recipes. Each user can create multiple collections with a name, emoji, and optional description.
- **Collection-level sharing**: Replace `recipe_shares` with `collection_shares`. When a collection is shared, the recipient sees all recipes within it.
- **Two-level navigation**: The RecipeSelector UI changes from a flat recipe list to a collection list → recipe list within selected collection.
- **Default collection**: Every user gets a "My Recipes" default collection for uncategorized recipes.

---

## Current Data Model

### Recipes Tables
- `recipes` (id, user_id, title, description, servings, prep_time, cook_time, image_url, created_at, updated_at)
- `recipe_ingredients` (id, recipe_id, text, order_index)
- `recipe_steps` (id, recipe_id, text, order_index)
- `recipe_shares` (id, recipe_id, shared_with_email, shared_by, created_at)

### RLS Policies (recipe_shares)
- Users can view shares for recipes they own or are shared with
- Users can create shares for recipes they own
- Users can delete shares for recipes they own
- Located in: `supabase/migrations/20260304120000_create_recipes.sql` (lines 193-219)

### Reference Pattern (list_shares)
- `list_shares` table follows the same pattern and can serve as reference
- Located in: `supabase/migrations/20260227213403_initial_schema.sql`

---

## Proposed Data Model

### New Tables
- `collections` (id, user_id, name, emoji, description, is_default, sort_order, created_at, updated_at)
- `collection_shares` (id, collection_id, shared_with_email, shared_by, created_at)

### Modified Tables
- `recipes` — Add `collection_id` (FK to collections, nullable during migration)

### Dropped Tables (after migration)
- `recipe_shares` — Replaced by `collection_shares`

### Migration Strategy
1. Create `collections` table
2. Create `collection_shares` table
3. Add `collection_id` column to `recipes` (nullable)
4. Create default "My Recipes" collection for each existing user
5. Assign all existing recipes to their owner's default collection
6. Migrate `recipe_shares` → `collection_shares` (group shared recipes by sharer, create collections)
7. Make `collection_id` NOT NULL
8. Drop `recipe_shares` table (or keep as archive)

---

## Affected Files and Systems

### Service Layer
- `src/services/recipeDatabase.js` — Major changes:
  - New CRUD: createCollection, updateCollection, deleteCollection, getCollections
  - New sharing: shareCollection, unshareCollection, getCollectionShares
  - Modified: createRecipe (needs collection_id), recipe queries (join through collection)
  - Removed: shareRecipe, unshareRecipe, getRecipeShares, subscribeSharedRecipeRefs
  - New subscriptions: subscribeCollections, subscribeSharedCollections

### Context Layer
- `src/context/RecipeContext.jsx` — Major refactor:
  - New state: collections, activeCollectionId, sharedCollections
  - New actions: collection CRUD, collection sharing, setActiveCollection
  - Modified: recipe operations need collection context
  - Current sharing actions (lines 121-136) replaced with collection sharing

### UI Components
- `src/components/RecipeSelector.jsx` — Major refactor:
  - Currently: flat recipe list with search, 3-dot menus, shared section, templates
  - Proposed: collection list → recipe list within selected collection
  - Two-panel or drill-down navigation pattern
  - Collection-level actions (share, rename, delete)
- `src/components/ShareRecipeModal.jsx` → Rename to `ShareCollectionModal.jsx`:
  - Change from recipe-level to collection-level sharing
  - Update props, API calls, copy text
- `src/App.jsx` — Desktop layout wiring:
  - `renderRecipesView` (lines 523-575) needs collection awareness
  - `ShareRecipeModal` rendering (lines 696-709) → ShareCollectionModal

### Database
- New migration file for collections schema
- RLS policies for collections and collection_shares
- Data migration for existing recipes and shares

---

## Scope Assessment

**Size: Large (L)** — This is a significant feature involving:
- New database tables + migration with data transformation
- New service layer functions (collections CRUD + sharing)
- Major context refactor (new state management for collections)
- Significant UI changes (two-level navigation, new modals)
- Existing feature modification (sharing model changes from recipe-level to collection-level)

**Risk areas:**
- Data migration: Moving existing shares from per-recipe to per-collection requires careful grouping logic
- Breaking change: Removing recipe-level sharing means shared recipes need to be re-organized into collections
- UI complexity: Two-level navigation needs to feel intuitive, especially on mobile
- RLS policies: New policies for collections + ensuring recipes within shared collections are visible

---

## Recommended Story Breakdown

1. **DB Migration: Create collections tables** — Create `collections` and `collection_shares` tables, add `collection_id` to recipes, RLS policies
2. **Service Layer: Collection CRUD** — createCollection, updateCollection, deleteCollection, getCollections, subscribeCollections
3. **Context: Collection state management** — Add collections state, activeCollectionId, collection actions to RecipeContext
4. **UI: Collection list in RecipeSelector** — Replace flat recipe list with collection-level navigation
5. **UI: Recipe list within collection** — Show recipes for selected collection, back navigation
6. **Service Layer: Collection sharing** — shareCollection, unshareCollection, getCollectionShares, subscribeSharedCollections
7. **Context: Collection sharing state** — Add shared collections state and actions
8. **UI: ShareCollectionModal** — New modal for collection-level sharing (replaces ShareRecipeModal)
9. **Data Migration: Existing recipes → default collection** — Assign existing recipes to auto-created default collections
10. **Data Migration: recipe_shares → collection_shares** — Migrate existing share relationships
11. **Cleanup: Remove recipe-level sharing** — Remove old shareRecipe functions, old modal, old RLS policies

---

## Open Questions for @planner

1. Should there be a limit on collections per user?
2. Can a recipe belong to multiple collections, or exactly one?
3. What happens to shared recipes when a collection is unshared? (soft-remove access vs. copy recipes)
4. Should the default "My Recipes" collection be deletable/renameable?
5. Should collection sharing use email (like current recipe_shares) or add user-id-based sharing?
6. Mobile UX: drill-down (collection tap → recipe list) vs. horizontal swipe between collections?
