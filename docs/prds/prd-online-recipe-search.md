# PRD: Online Recipe Search via Spoonacular API

**Status:** Ready  
**Created:** 2026-03-10  
**Branch:** `feature/online-recipe-search`  
**Depends on:** `prd-item-units` (must be implemented first — ingredient-to-list flow maps Spoonacular units to item units)

## Overview

Allow users to search for recipes online using the Spoonacular API, browse results with images, view ingredients and instructions, and either **import a recipe** into their collection or **add ingredients directly to a shopping list** — all without leaving Gather Lists. Both React (web) and native Swift (iOS) platforms.

## Problem Statement

Users currently create recipes manually or use the 6 built-in templates. There's no way to discover new recipes within the app. Users must leave Gather Lists, find a recipe elsewhere, then manually re-enter ingredients — a tedious, error-prone process that breaks the meal-planning-to-shopping workflow.

## Goals

1. Enable keyword recipe search with results showing titles and images
2. Let users preview a recipe's ingredients, instructions, and metadata before acting
3. Provide two clear actions: **Save as Recipe** (into a collection) and **Add to List** (ingredients → shopping list)
4. Keep the Spoonacular API key server-side via a Supabase Edge Function
5. Stay within the free tier (150 points/day ≈ 50 search+detail combos)
6. Work identically on React web and native Swift iOS

## Key Decisions

- **Entry point:** "Search Online" button in the collection browser (not an always-visible search bar)
- **Collection picker:** Always shown when saving a recipe — user picks every time
- **Results layout:** Default to list view with tabs to switch between list and grid
- **Add to List — ingredient names only:** Item names are ingredient names (e.g., "flour", not "2 cups flour"). Spoonacular `amount` maps to item `quantity` (rounded to integer) and `unit` maps to item `unit` field (from `prd-item-units`). Unrecognized units default to "each".

## Non-Goals

- User accounts on Spoonacular (no login/registration)
- Recipe caching or offline search results
- Diet/cuisine/meal-type filters (future enhancement — keyword search only for v1)
- Editing imported recipes before saving (users can edit after import via existing edit flow)
- Nutritional information display

## Architecture

### Edge Function: `search-recipes`

A new Supabase Edge Function following the `search-products` proxy pattern:

- **Search endpoint:** `GET /search-recipes?q=vegetarian+pasta&number=10`
  - Proxies to `GET https://api.spoonacular.com/recipes/complexSearch?query=...&number=...&apiKey=...`
  - Returns: `{ results: [{ id, title, image }], totalResults }`
  - Cost: ~1 point per call

- **Detail endpoint:** `GET /search-recipes?id=123456`
  - Proxies to `GET https://api.spoonacular.com/recipes/{id}/information?apiKey=...`
  - Returns: `{ id, title, image, servings, readyInMinutes, sourceUrl, extendedIngredients: [{ name, amount, unit, aisle }], analyzedInstructions: [{ steps: [{ number, step }] }] }`
  - Cost: ~1 point per call

- **CORS:** Same `ALLOWED_ORIGINS` as `search-products`
- **Timeout:** 5-second AbortController per request
- **Env var:** `SPOONACULAR_API_KEY` (set in Supabase dashboard)

### Data Mapping: Spoonacular → Gather Lists

| Spoonacular Field | Gather Lists Field | Notes |
|---|---|---|
| `title` | `recipe.name` | Direct mapping |
| `image` | `recipe.image_url` | Spoonacular CDN URL stored directly |
| `extendedIngredients[].name` | `recipe_ingredients.name` | Direct mapping |
| `extendedIngredients[].amount` + `unit` | `recipe_ingredients.quantity` | Combined as text: `"2 cups"` |
| `analyzedInstructions[0].steps[].step` | `recipe_steps.instruction` | First instruction set only |
| `analyzedInstructions[0].steps[].number` | `recipe_steps.sort_order` | Direct mapping |
| `readyInMinutes` | `recipe.description` | Included in auto-generated description |
| `servings` | `recipe.description` | Included in auto-generated description |
| `sourceUrl` | `recipe.description` | Attribution link in description |

### "Add to List" Direct Flow

When users choose "Add to List" instead of saving as a recipe:
- `extendedIngredients[].name` → item name (ingredient name only, e.g., "flour")
- `extendedIngredients[].amount` → item quantity (rounded to nearest integer, minimum 1)
- `extendedIngredients[].unit` → item unit (mapped to `ITEM_UNITS` from `prd-item-units`; unrecognized units default to "each")
- Items are passed to the existing `AddToListModal` (React) / `AddToListSheet` (Swift)
- Existing `categorizeItem()` handles grocery categorization

### Unit Mapping: Spoonacular → Gather Lists Item Units

| Spoonacular Unit | Gather Lists Unit | Notes |
|---|---|---|
| `cups`, `cup` | `cups` | Direct |
| `tablespoons`, `tablespoon`, `Tbsp`, `Tbsps` | `tbsp` | Normalize |
| `teaspoons`, `teaspoon`, `Tsp`, `Tsps` | `tsp` | Normalize |
| `ounces`, `ounce`, `oz` | `oz` | Direct |
| `pounds`, `pound`, `lb`, `lbs` | `lb` | Normalize |
| `grams`, `gram`, `g` | `g` | Direct |
| `kilograms`, `kilogram`, `kg` | `kg` | Direct |
| `milliliters`, `milliliter`, `ml` | `ml` | Direct |
| `liters`, `liter`, `L` | `L` | Direct |
| `pinch`, `pinches` | `pinch` | Direct |
| `dozen` | `dozen` | Direct |
| _(anything else)_ | `each` | Fallback — quantity set to rounded amount |

## User Stories

### US-001: Supabase Edge Function — Recipe Search Proxy

**As a** developer  
**I want** a `search-recipes` Edge Function that proxies Spoonacular API calls  
**So that** the API key stays server-side and both platforms use one endpoint

**Acceptance Criteria:**
- New Edge Function at `supabase/functions/search-recipes/index.ts`
- Supports `?q=<query>&number=<count>` for search (default number=10)
- Supports `?id=<recipeId>` for detail fetch
- Uses `SPOONACULAR_API_KEY` env var
- CORS headers match `search-products` pattern (`ALLOWED_ORIGINS`)
- 5-second timeout via AbortController
- Returns JSON with `{ results, source: "spoonacular" }` for search
- Returns JSON with full recipe detail for id lookup
- Returns `{ error }` with appropriate HTTP status on failure
- Handles missing API key gracefully (503 with message)

### US-002: React — Recipe Search UI

**As a** user on the web app  
**I want** to search for recipes online from the Recipes tab  
**So that** I can discover new recipes without leaving Gather Lists

**Acceptance Criteria:**
- New `OnlineRecipeSearch.jsx` component with CSS Module
- Accessible from the Recipes tab via a "Search Online" button in the collection browser
- Search input with debounced API calls (300ms debounce)
- Results default to **list view** (thumbnail + title rows) with tabs to switch between list and grid
- Grid view: 2 columns on mobile, 3 on desktop, image cards with title overlay
- List view: compact rows with small thumbnail + title, consistent with existing recipe list style
- Loading skeleton state while fetching
- Empty state: "No recipes found for '{query}'"
- Error state: "Search unavailable. Try again later."
- Tapping a result opens recipe preview (US-004)
- Bold, clean visual treatment consistent with existing UI
- Mobile-responsive (works at 700px and 480px breakpoints)

### US-003: Swift — Recipe Search UI

**As a** user on the iOS app  
**I want** to search for recipes online from the Recipes tab  
**So that** I can discover new recipes without leaving the app

**Acceptance Criteria:**
- New `OnlineRecipeSearchView.swift`
- Accessible from the Recipes tab via a "Search Online" button in `CollectionBrowserView`
- Search input with debounced API calls (300ms debounce, using Combine or Swift concurrency)
- Results default to **list view** with tabs to switch between list and grid
- List view: compact rows with small AsyncImage thumbnail + title
- Grid view: 2-column LazyVGrid with image cards + title overlay
- AsyncImage with placeholder for recipe images
- Loading state with ProgressView
- Empty state: "No recipes found for '{query}'"
- Error state: "Search unavailable. Try again later."
- Tapping a result navigates to recipe preview (US-005)

### US-004: React — Recipe Preview & Actions

**As a** user on the web app  
**I want** to preview an online recipe's ingredients and instructions  
**So that** I can decide whether to save it or add ingredients to my list

**Acceptance Criteria:**
- New `OnlineRecipePreview.jsx` component (modal or slide-over panel)
- Shows: recipe image (large hero), title, servings, prep time, source attribution link
- Lists all ingredients with amounts and units
- Lists all instruction steps numbered
- Two action buttons:
  - **"Save as Recipe"** → opens collection picker, then creates recipe with ingredients + steps in chosen collection
  - **"Add to List"** → opens existing `AddToListModal` with ingredients array
- Loading state while fetching recipe detail from edge function
- Close/back button to return to search results
- Bold, clean visual treatment

### US-005: Swift — Recipe Preview & Actions

**As a** user on the iOS app  
**I want** to preview an online recipe's ingredients and instructions  
**So that** I can decide whether to save it or add ingredients to my list

**Acceptance Criteria:**
- New `OnlineRecipePreviewView.swift`
- Navigation push from search results
- Shows: recipe image (hero), title, servings, prep time, source attribution
- Lists all ingredients with amounts and units
- Lists all instruction steps numbered
- Two action buttons:
  - **"Save as Recipe"** → sheet to pick collection, then calls `RecipeService.createRecipe` + `addIngredients` + `addSteps`
  - **"Add to List"** → opens existing `AddToListSheet` with ingredients array
- Loading state with ProgressView while fetching detail
- Navigation bar back button to return to search results

### US-006: React — Save Online Recipe to Collection

**As a** user on the web app  
**I want** to save an online recipe into one of my collections  
**So that** I can access it later and add its ingredients to shopping lists

**Acceptance Criteria:**
- Collection picker UI (always shown — dropdown or small modal showing all user's collections)
- On save, creates recipe via `RecipeContext.createRecipe()` with:
  - `name` = Spoonacular title
  - `description` = auto-generated from servings, prep time, and source URL
  - `image_url` = Spoonacular image URL
  - `collection_id` = user's chosen collection
- Creates ingredients via `updateIngredients()` with name + quantity text
- Creates steps via `updateSteps()` with instruction text
- Success toast: "Recipe saved to {collection name}"
- Navigates to the newly created recipe detail after save
- Handles errors gracefully with toast message

### US-007: Swift — Save Online Recipe to Collection

**As a** user on the iOS app  
**I want** to save an online recipe into one of my collections  
**So that** I can access it later and add its ingredients to shopping lists

**Acceptance Criteria:**
- Collection picker sheet showing user's collections (similar to `AddToListSheet` list picker pattern)
- On save, calls `RecipeService.createRecipe()` then `addIngredients()` and `addSteps()`
- Maps Spoonacular data → Gather Lists models (see Data Mapping table)
- Success feedback: brief toast/alert "Recipe saved to {collection}"
- Navigates to the newly created recipe detail after save
- Handles errors gracefully with alert

### US-008: React — Add Online Recipe Ingredients to Shopping List

**As a** user on the web app  
**I want** to add ingredients from an online recipe directly to my shopping list  
**So that** I can quickly shop for a recipe without saving it first

**Acceptance Criteria:**
- "Add to List" button on recipe preview opens existing `AddToListModal`
- Ingredients mapped as individual items:
  - Item name = ingredient name only (e.g., "flour", "salt")
  - Item quantity = Spoonacular `amount` rounded to nearest integer (minimum 1)
  - Item unit = Spoonacular `unit` mapped to `ITEM_UNITS` (see Unit Mapping table); unrecognized units default to "each"
- Uses existing `categorizeItem()` for auto-categorization
- All existing `AddToListModal` behavior preserved (list picker, success toast)

### US-009: Swift — Add Online Recipe Ingredients to Shopping List

**As a** user on the iOS app  
**I want** to add ingredients from an online recipe directly to my shopping list  
**So that** I can quickly shop for a recipe without saving it first

**Acceptance Criteria:**
- "Add to List" button on recipe preview opens existing `AddToListSheet`
- Ingredients mapped as individual items:
  - Item name = ingredient name only (e.g., "flour", "salt")
  - Item quantity = Spoonacular `amount` rounded to nearest integer (minimum 1)
  - Item unit = Spoonacular `unit` mapped to `ItemUnit` constants (see Unit Mapping table); unrecognized units default to "each"
- Uses existing `ItemService.addIngredientItems(listId:ingredients:)` flow (may need signature update to accept unit)
- All existing `AddToListSheet` behavior preserved (list picker, success message, auto-dismiss)

### US-010: Spoonacular Attribution

**As a** product owner  
**I want** proper Spoonacular attribution displayed where required  
**So that** we comply with their API terms of use

**Acceptance Criteria:**
- "Powered by Spoonacular" text with link shown on search results page (both platforms)
- Source URL attribution in imported recipe descriptions
- Attribution meets Spoonacular's free tier requirements

## Credential & Service Access Plan

| Service | Credential Type | Related Stories | Request Timing | Fallback Behavior |
|---------|----------------|-----------------|----------------|-------------------|
| Spoonacular API | API key (`SPOONACULAR_API_KEY`) | US-001 through US-010 | Upfront — edge function is non-functional without it | Edge function returns 503 "Recipe search not configured" |

**Setup steps:**
1. Sign up at https://spoonacular.com/food-api (free, no credit card)
2. Copy API key from dashboard
3. Set in Supabase dashboard: Project Settings → Edge Functions → Secrets → `SPOONACULAR_API_KEY`

## Definition of Done

Implementation is complete when:

1. **Edge Function deployed:** `search-recipes` is deployed to Supabase, handles both search and detail queries, and keeps the API key server-side
2. **React search works:** Users can search via "Search Online" button, see results in list/grid views with toggle, preview details, save to a collection (always picker), or add ingredients to a list
3. **Swift search works:** Identical functionality on the native iOS app using SwiftUI views and existing services
4. **Data integrity:** Imported recipes appear correctly in the user's collection with all ingredients (name + quantity) and all steps (instruction + order)
5. **Unit mapping:** "Add to List" correctly maps Spoonacular units to Gather Lists `ITEM_UNITS`; unrecognized units gracefully default to "each"
6. **Add to List flow:** Direct ingredient-to-list works on both platforms using existing `AddToListModal`/`AddToListSheet` without regression
7. **Attribution:** Spoonacular attribution is visible on search results per API terms
8. **Error handling:** Network failures, empty results, missing API key, and timeout scenarios all handled gracefully on both platforms
9. **Visual quality:** UI is bold and clean, mobile-responsive on web (700px, 480px breakpoints), and follows existing Gather Lists design patterns
10. **No regressions:** Existing recipe creation, editing, collection management, and add-to-list flows are unaffected

## Flag Review

| Story | Support Article? | Tools? | Test Intensity | Reasoning |
|-------|------------------|--------|----------------|-----------|
| US-001: Edge Function proxy | ❌ No | ❌ No | medium | Backend infrastructure, no user-facing docs |
| US-002: React search UI | ✅ Yes | ❌ No | medium | New user-facing feature |
| US-003: Swift search UI | ✅ Yes | ❌ No | medium | New user-facing feature |
| US-004: React preview & actions | ✅ Yes | ❌ No | medium | New user workflow |
| US-005: Swift preview & actions | ✅ Yes | ❌ No | medium | New user workflow |
| US-006: React save to collection | ✅ Yes | ❌ No | medium | Part of new user workflow |
| US-007: Swift save to collection | ✅ Yes | ❌ No | medium | Part of new user workflow |
| US-008: React add to list | ❌ No | ❌ No | low | Reuses existing AddToListModal |
| US-009: Swift add to list | ❌ No | ❌ No | low | Reuses existing AddToListSheet |
| US-010: Attribution | ❌ No | ❌ No | low | Static text/link |

**Note:** Support article content can be consolidated into one article covering the online recipe search feature across both platforms.
