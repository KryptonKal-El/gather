# PRD: Native Swift iOS App — Phase 6: Recipes Advanced (Image Upload, Add-to-List, Templates, Text Import)

**ID:** prd-swift-recipes-advanced  
**Status:** Ready  
**Created:** 2026-03-09  
**Priority:** High  
**Phase:** 6 of 8  
**Depends On:** prd-swift-recipes-core (Phase 5)

## Overview

Complete the recipes feature in the native Swift app by adding the four capabilities deferred from Phase 5: recipe image upload (camera + photo library + URL paste), add-to-list flow (check ingredients then pick a shopping list), recipe templates (6 hardcoded starter recipes), and text import from clipboard. Together with Phase 5, this brings the Swift recipe experience to full parity with the React PWA.

This PRD is **Swift-only** — the React PWA already has all four features. Both codebases share the same Supabase backend. No backend changes are needed.

## Design Decisions (User-Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Photo picker approach | **Camera + PhotosPicker + URL paste** (full suite) | Native-first — shoot, pick from library, or paste a URL |
| Add-to-list presentation | **Bottom sheet** (`.sheet`) with list of shopping lists | Consistent with all other creation flows in the app |
| Template presentation | **Section at the bottom of CollectionBrowserView** | Matches React layout — templates below owned/shared sections |
| Text import approach | **iOS clipboard integration** — "Import from Clipboard" button reads `UIPasteboard` | Native iOS pattern — no overlay needed, instant paste |

## Context: What Already Exists

### Database & Storage (shared, no changes needed)

All tables, RLS policies, storage buckets, and edge functions already exist:

- **`recipe-images` storage bucket:** Public, 5MB limit, jpeg/png/webp. Path: `{userId}/{recipeId}.{ext}`. Upsert enabled.
- **`recipes.image_url`:** Text column storing the public URL of the recipe image.
- **`items` table:** Shopping list items with `name`, `category`, `is_checked`, `list_id`, `quantity`, `price`, `store_id`, `image_url`.
- **`categorizeItem()`:** Already ported to Swift in `CategoryDefinitions.swift` (Phase 3) — 12 categories, 3-pass keyword matching.

### Swift Codebase (what Phase 6 builds on)

Phase 5 establishes the full recipe infrastructure:

- **Models:** `Recipe`, `RecipeIngredient`, `RecipeStep`, `RecipeCollection`, `CollectionShare` — all Codable with CodingKeys
- **RecipeService:** Collection CRUD, recipe CRUD, ingredient/step management, collection sharing, `ensureDefaultCollection`
- **RecipeViewModel:** @Observable with realtime subscriptions, collection/recipe state, CRUD actions
- **Views:** `CollectionBrowserView`, `CollectionRecipeListView`, `RecipeDetailView`, `RecipeFormSheet`, `ShareCollectionSheet`, `CreateCollectionSheet`
- **RecipeDetailView:** Already has ingredient checkboxes with local `@State` checked set — prepped for add-to-list
- **RecipeFormSheet:** Create/edit form with ingredients and steps — ready for image and import additions

Phase 3 established:

- **`CategoryDefinitions.swift`:** `categorizeItem(_:)` function — the Swift port of the React categorizer. Used by `ListDetailViewModel` for auto-categorizing items on add.
- **`ItemService.swift`:** `addItem()` and batch insert patterns for shopping list items.

### React Patterns (reference for parity)

- **Image upload:** File picker + URL paste. Upload happens AFTER recipe save (needs `recipeId`). Path: `{userId}/{recipeId}.{ext}`. Upsert mode. Updates `image_url` on recipe row.
- **Add-to-list:** Checkbox ingredients → "Add N to List" button → `AddToListModal` with list picker → batch insert with `categorizeItem()`. Quantity from recipe is NOT transferred (shopping list quantity defaults to 1).
- **Templates:** 6 hardcoded templates (name, description, ingredient names). Shown in a card grid below recipe list. Expand to preview → "Save as Recipe" (creates in active collection) or "Add to List" (opens list picker).
- **Text import:** `parseRecipeText()` splits by newlines, strips bullets, filters section headers, runs `stripQuantity()` to extract ingredient names, deduplicates. Fills form ingredient fields with empty quantities.

## User Stories

### US-001: StorageService — Supabase Storage Upload Helper

**Description:** Create a reusable service for uploading files to Supabase Storage buckets. This is the first storage usage in the Swift app — establishes the pattern for future needs.

**Acceptance Criteria:**

- [ ] Create `Services/StorageService.swift` as `struct StorageService` with `private static var client: SupabaseClient { SupabaseManager.shared.client }`
- [ ] `uploadRecipeImage(userId: UUID, recipeId: UUID, imageData: Data, fileExtension: String) async throws -> String` — uploads to `recipe-images` bucket at path `{userId}/{recipeId}.{ext}`, upsert mode, returns the public URL string
- [ ] `getPublicUrl(bucket: String, path: String) -> String` — returns the public URL for a file in a bucket
- [ ] After upload, updates the recipe's `image_url` via `RecipeService` (or directly via Supabase update)
- [ ] Handles upload errors with descriptive error messages
- [ ] Build succeeds

---

### US-002: RecipeService — Image URL Update

**Description:** Add a function to update just the `image_url` field on a recipe, used after storage upload or when pasting a URL.

**Acceptance Criteria:**

- [ ] Add `updateRecipeImage(recipeId: UUID, imageUrl: String) async throws` to `RecipeService` — updates `image_url` and `updated_at` on the recipe row
- [ ] Add `removeRecipeImage(recipeId: UUID) async throws` — sets `image_url` to null and updates `updated_at`
- [ ] Private DTO with `CodingKeys` for the update
- [ ] Build succeeds

---

### US-003: RecipeFormSheet — Image Section (Camera + Photo Library + URL Paste)

**Description:** Add an image section to the recipe create/edit form with three options: take a photo with camera, pick from photo library, or paste a URL. Upload happens on recipe save.

**Acceptance Criteria:**

- [ ] Add an image section at the top of `RecipeFormSheet` (above name field)
- [ ] **When no image is set:** Show a dashed placeholder area with camera icon and "Add Photo" text. Tapping it shows a menu with three options: "Take Photo", "Choose from Library", "Paste Image URL"
- [ ] **"Take Photo":** Opens the camera via `UIImagePickerController` (wrapped in `UIViewControllerRepresentable`) with `.sourceType = .camera`. Captures a photo, stores as `Data` in local state, shows preview.
- [ ] **"Choose from Library":** Opens `PhotosPicker` from `PhotosUI` framework. On selection, loads the image `Data`, stores in local state, shows preview.
- [ ] **"Paste Image URL":** Shows an inline `TextField` for entering a URL. On confirm, stores the URL string, shows `AsyncImage` preview.
- [ ] **When image is set (file or URL):** Show the image preview (local `Data` → `UIImage` → `Image`, or `AsyncImage` for URL) with an "✕" button to remove and a "Change" button to replace
- [ ] **Image data is stored in local `@State`** — not uploaded yet. Upload happens in save handler.
- [ ] **On save (create mode):** Recipe is created first (to get `recipeId`), then image is uploaded via `StorageService.uploadRecipeImage`, then `image_url` is updated on the recipe
- [ ] **On save (edit mode):** If image changed, upload new image via `StorageService.uploadRecipeImage` (upsert overwrites), then update `image_url`. If image removed, call `RecipeService.removeRecipeImage`.
- [ ] **If image is a URL (not a file):** No upload — just set `image_url` directly on the recipe
- [ ] Compress large images before upload — resize to max 1200px on longest edge, JPEG compression quality 0.8
- [ ] `import PhotosUI` for `PhotosPicker`, `import UIKit` for camera
- [ ] Build succeeds

---

### US-004: RecipeViewModel — Image Upload Actions

**Description:** Add image upload/remove actions to RecipeViewModel so views can trigger uploads through the view model.

**Acceptance Criteria:**

- [ ] `uploadRecipeImage(recipeId: UUID, imageData: Data, fileExtension: String) async throws` — calls `StorageService.uploadRecipeImage`, then updates local recipe state with the new `imageUrl`
- [ ] `updateRecipeImageUrl(recipeId: UUID, imageUrl: String) async throws` — for URL-pasted images, calls `RecipeService.updateRecipeImage` directly
- [ ] `removeRecipeImage(recipeId: UUID) async throws` — calls `RecipeService.removeRecipeImage`, clears local recipe state `imageUrl`
- [ ] Error handling with `error` property for UI display
- [ ] Build succeeds

---

### US-005: RecipeTextParser — Port parseRecipeText & stripQuantity to Swift

**Description:** Port the React text parsing logic to Swift so clipboard-pasted ingredient lists can be parsed into structured ingredient data.

**Acceptance Criteria:**

- [ ] Create `Services/RecipeTextParser.swift` (or `Utils/RecipeTextParser.swift`)
- [ ] `struct RecipeTextParser` with static functions
- [ ] `static func parseRecipeText(_ text: String) -> [(name: String, category: String)]` — splits by newlines, strips bullet prefixes (`-`, `*`, `•`), filters empty lines and section headers (`instructions`, `directions`, `steps`, `method`), runs `stripQuantity` on each line, deduplicates by lowercase name, skips names shorter than 2 characters, capitalizes first letter, auto-categorizes via `CategoryDefinitions.categorizeItem`
- [ ] `static func stripQuantity(_ line: String) -> String` — removes parenthetical notes `(...)`, removes everything after comma, strips leading numbers/fractions (`[\d./\s-]+`), strips measurement unit words (cups, tbsp, tsp, oz, lbs, grams, ml, cloves, slices, pieces, cans, packages, bunches, heads, stalks, sprigs, pinch, dash, handful — with plural variants), strips trailing "of". Falls back to original minus numbers if stripping removed everything.
- [ ] Unit pattern covers all units from the React implementation: `cups?`, `tablespoons?`, `teaspoons?`, `oz`, `ounces?`, `lbs?`, `pounds?`, `grams?`, `kg`, `ml`, `liters?`, `quarts?`, `pints?`, `gallons?`, `cloves?`, `slices?`, `pieces?`, `cans?`, `packages?`, `bunches?`, `heads?`, `stalks?`, `sprigs?`, `pinch(es)?`, `dash(es)?`, `handful(s)?`
- [ ] Verified against test cases: `"2 cups flour"` → `"Flour"`, `"1/2 lb ground beef"` → `"Ground beef"`, `"3 cloves garlic, minced"` → `"Garlic"`, `"1 can tomato sauce (15 oz)"` → `"Tomato sauce"`
- [ ] Build succeeds

---

### US-006: RecipeFormSheet — Import from Clipboard Button

**Description:** Add an "Import from Clipboard" button to the ingredients section of RecipeFormSheet. Tapping it reads the system clipboard, parses it, and appends the extracted ingredients to the form.

**Acceptance Criteria:**

- [ ] Add an "Import from Clipboard" button in the ingredients section header (next to "+ Add" button), with a `clipboard` SF Symbol icon
- [ ] On tap: reads `UIPasteboard.general.string`
- [ ] If clipboard is empty or nil, show a brief inline message: "Nothing on clipboard"
- [ ] If clipboard has text, parse via `RecipeTextParser.parseRecipeText()`
- [ ] If parsing returns 0 results, show inline message: "No ingredients found in clipboard text"
- [ ] If parsing returns results, append them to the existing ingredients list (keep non-empty existing rows, append parsed ones with empty quantity fields)
- [ ] Show a brief success indicator: "Added N ingredients from clipboard"
- [ ] Each imported ingredient gets a generated `UUID` id and empty `quantity` string
- [ ] Does NOT clear the clipboard after reading
- [ ] Build succeeds

---

### US-007: Add-to-List Service Function — Batch Insert Items

**Description:** Create a function to batch-insert ingredients as shopping list items, with auto-categorization. This bridges the recipe and shopping list domains.

**Acceptance Criteria:**

- [ ] Add to `ItemService.swift` (or create a new helper): `static func addIngredientItems(listId: UUID, ingredients: [(name: String, quantity: String?)]) async throws` — for each ingredient, creates an item row with: `list_id = listId`, `name = ingredient.name`, `category = CategoryDefinitions.categorizeItem(ingredient.name)`, `is_checked = false`, `quantity = 1` (numeric default, NOT the recipe's measurement string)
- [ ] Batch insert via single Supabase `.insert()` call (array of rows)
- [ ] Handles empty ingredient list gracefully (no-op)
- [ ] Build succeeds

---

### US-008: AddToListSheet — List Picker Bottom Sheet

**Description:** A bottom sheet that shows the user's shopping lists and lets them pick one to add recipe ingredients to. Presented from RecipeDetailView after selecting ingredients.

**Acceptance Criteria:**

- [ ] Create `Views/Recipes/AddToListSheet.swift`
- [ ] Takes `ingredients: [(name: String, quantity: String?)]` and an `onDismiss` callback
- [ ] `.sheet` presentation from RecipeDetailView
- [ ] **Header:** "Add N Ingredients to List" with a summary showing up to 5 ingredient names, then "and X more..." if more
- [ ] **List picker:** Shows all user's shopping lists (from `ListViewModel`) — each row shows emoji + name. First list pre-selected with a checkmark.
- [ ] **Tap a list** to select it (single-select, checkmark moves)
- [ ] **"Add Items" button** at the bottom — calls `ItemService.addIngredientItems(listId:ingredients:)`, shows success state ("Added N items to [List Name]" with checkmark), then auto-dismisses after 1.5 seconds
- [ ] **Loading state:** `ProgressView` while inserting
- [ ] **Error state:** Inline error message if insert fails
- [ ] **Empty state:** If user has no lists — "Create a list first" message (no create flow here — user goes to Lists tab)
- [ ] Reads `ListViewModel` from `@Environment` for the list of shopping lists
- [ ] Build succeeds

---

### US-009: RecipeDetailView — Add-to-List Button + Wiring

**Description:** Wire the "Add to List" button in RecipeDetailView to the AddToListSheet. The button is enabled when ingredients are checked.

**Acceptance Criteria:**

- [ ] Add an "Add to List" button at the bottom of the ingredients section in `RecipeDetailView`
- [ ] Button text: "Add N to List" when N > 0 ingredients are checked, "Select ingredients to add" when none are checked (disabled state)
- [ ] Button style: Prominent, full-width, matching the app's accent color
- [ ] On tap: Collects checked ingredients as `[(name: String, quantity: String?)]` pairs from the recipe detail, presents `AddToListSheet` as a `.sheet`
- [ ] After successful add, clear all checkmarks (reset the checked set)
- [ ] Build succeeds

---

### US-010: Recipe Templates — Data & Service

**Description:** Define the 6 hardcoded recipe templates in Swift and add helper functions for "Save as Recipe" and "Add to List" actions.

**Acceptance Criteria:**

- [ ] Create `Models/RecipeTemplate.swift` with struct `RecipeTemplate: Identifiable` — fields: `id` (String), `name` (String), `description` (String), `ingredients` ([String])
- [ ] Define `static let all: [RecipeTemplate]` with the 6 templates matching React exactly:
  1. Spaghetti Bolognese — 10 ingredients
  2. Chicken Stir Fry — 9 ingredients
  3. Tacos — 10 ingredients
  4. Caesar Salad — 8 ingredients
  5. Pancakes — 9 ingredients
  6. Grilled Salmon — 9 ingredients
- [ ] Ingredient names match React exactly (lowercase in data, capitalized on display)
- [ ] Build succeeds

---

### US-011: RecipeViewModel — Template Actions

**Description:** Add actions to RecipeViewModel for saving a template as a recipe and for preparing template ingredients for add-to-list.

**Acceptance Criteria:**

- [ ] `saveTemplateAsRecipe(template: RecipeTemplate) async throws` — creates a recipe in the active collection with template name, description, ingredients (capitalized, empty quantity, `sortOrder` = index), and no steps. Returns silently on success.
- [ ] `templateIngredientsForList(template: RecipeTemplate) -> [(name: String, quantity: String?)]` — returns template ingredients as capitalized name strings with nil quantity, ready for `AddToListSheet`
- [ ] Build succeeds

---

### US-012: CollectionBrowserView — Templates Section

**Description:** Add a "Recipe Templates" section at the bottom of the collection browser, below "My Collections" and "Shared with Me". Shows template cards that expand to show details with "Save as Recipe" and "Add to List" actions.

**Acceptance Criteria:**

- [ ] Add a `Section("Recipe Templates")` at the bottom of the `List` in `CollectionBrowserView`
- [ ] Each template shows as a row: template name + description + "N ingredients" badge
- [ ] Tapping a template row expands an inline detail view (using `DisclosureGroup` or a `@State` expanded ID toggle) showing: the ingredient list (capitalized), and two action buttons
- [ ] **"Save as Recipe" button:** Calls `viewModel.saveTemplateAsRecipe(template:)`. Shows brief success feedback ("Saved to [Collection Name]"). Uses the currently active collection (or default if none selected).
- [ ] **"Add to List" button:** Calls `viewModel.templateIngredientsForList(template:)` and presents `AddToListSheet` with those ingredients
- [ ] Only one template expanded at a time (tapping another collapses the previous)
- [ ] Build succeeds

---

### US-013: RecipeDetailView — 3-Dot Menu "Add to List" for Shared Recipes

**Description:** For recipes in shared collections (where the user is not the owner), the 3-dot menu should include "Add to List" as a way to get ingredients without editing.

**Acceptance Criteria:**

- [ ] In `RecipeDetailView`, for recipes in shared collections added by others (view-only): the toolbar ellipsis menu shows "Add to List" — this checks ALL ingredients and presents `AddToListSheet`
- [ ] For recipes the user owns or added: "Add to List" is available in the toolbar menu as well (in addition to the inline button below ingredients)
- [ ] "Add to List" from the menu adds ALL ingredients (ignores checkbox state — selects everything)
- [ ] Build succeeds

---

### US-014: Image Compression Helper

**Description:** Create a utility to compress and resize images before uploading to Supabase Storage, keeping uploads fast and storage efficient.

**Acceptance Criteria:**

- [ ] Create `Utils/ImageCompressor.swift` (or add to an existing utils file)
- [ ] `static func compress(imageData: Data, maxDimension: CGFloat = 1200, quality: CGFloat = 0.8) -> Data?` — creates a `UIImage` from the data, resizes if either dimension exceeds `maxDimension` (maintaining aspect ratio), compresses to JPEG at the given quality, returns the compressed `Data`
- [ ] If the input is already smaller than `maxDimension` on both sides, only JPEG-compress without resizing
- [ ] Returns nil if the input data cannot be decoded as an image
- [ ] Build succeeds

## Functional Requirements

- FR-1: Users can add a recipe image by taking a photo, picking from photo library, or pasting a URL
- FR-2: Images are compressed (max 1200px, JPEG 0.8) before upload to `recipe-images` bucket
- FR-3: Image upload happens after recipe save (needs `recipeId`) and uses upsert (overwrites previous)
- FR-4: Users can remove a recipe image from the edit form
- FR-5: Users can check recipe ingredients and tap "Add to List" to open a list picker
- FR-6: The list picker bottom sheet shows all user's shopping lists with single-select
- FR-7: Adding ingredients to a list auto-categorizes each item and sets quantity to 1
- FR-8: 6 recipe templates are available at the bottom of the collection browser
- FR-9: Expanding a template shows its ingredients with "Save as Recipe" and "Add to List" actions
- FR-10: "Save as Recipe" creates a real recipe in the active collection
- FR-11: "Add to List" from a template opens the same list picker sheet
- FR-12: Users can import ingredients from the clipboard via a button in the recipe form
- FR-13: Clipboard parsing strips bullets, quantities, units, parentheticals, and deduplicates
- FR-14: Imported ingredients are appended to existing form ingredients with empty quantity fields
- FR-15: "Add to List" from the 3-dot menu adds ALL ingredients (regardless of checkbox state)

## Non-Goals (Not in This Phase)

- No recipe image search / product search integration
- No AI-generated recipes
- No drag-to-reorder ingredients in the add-to-list flow
- No quantity transfer from recipe measurements to shopping list (recipe says "2 cups", list item gets quantity = 1)
- No create-list flow from the add-to-list sheet (user must go to Lists tab)
- No recipe step import from clipboard (only ingredients are parsed)

## Technical Considerations

- **Camera access:** Requires `NSCameraUsageDescription` in `Info.plist`. The `UIImagePickerController` wrapper is needed since SwiftUI's `PhotosPicker` does not support camera. Use a `UIViewControllerRepresentable` wrapper.
- **PhotosPicker:** From `PhotosUI` framework, available iOS 16+. Uses `PhotosPickerItem` → `.loadTransferable(type: Data.self)` to get image data.
- **Image compression:** Use `UIImage` for resize + `jpegData(compressionQuality:)`. This requires `import UIKit`.
- **Supabase Storage upload:** `client.storage.from("recipe-images").upload(path, data, options: FileOptions(upsert: true))`. The Supabase Swift SDK v2.x has this API.
- **Clipboard access:** `UIPasteboard.general.string` — no special permissions needed on iOS. Reads text only (not images from clipboard in this phase).
- **CategoryDefinitions.categorizeItem:** Already exists in the Swift codebase from Phase 3. Reuse directly for auto-categorizing ingredients when adding to a shopping list.
- **ListViewModel access:** `AddToListSheet` needs the user's shopping lists. The `ListViewModel` is already injected via `.environment()` in `MainTabView`. The sheet can read it from `@Environment`.
- **Template data:** Hardcoded as a static array — no database table, no API call. Matches React exactly.

## Credential & Service Access Plan

No external credentials required for this PRD. All functionality uses the existing Supabase project (database, storage, realtime, auth). The `recipe-images` storage bucket is already configured.

## Definition of Done

Implementation is complete when:

1. Users can take a photo, pick from library, or paste a URL to set a recipe image
2. Images are compressed and uploaded to `recipe-images` bucket after recipe save
3. Recipe images display correctly in `RecipeDetailView` and recipe list thumbnails
4. Users can remove a recipe image from the edit form
5. Users can check ingredients in recipe detail and tap "Add N to List"
6. The list picker sheet shows all shopping lists and inserts items with auto-categorization
7. 6 recipe templates appear at the bottom of the collection browser
8. Expanding a template shows ingredients with "Save as Recipe" and "Add to List" actions
9. "Import from Clipboard" in the recipe form reads and parses clipboard text into ingredients
10. The text parser correctly strips quantities, units, bullets, and deduplicates
11. "Add to List" from the 3-dot menu adds all ingredients regardless of checkbox state
12. All features work on iPhone simulator
13. No regression in Phase 5 recipe/collection functionality
14. No regression in Lists, Stores, Settings, or Auth functionality
15. Build succeeds
