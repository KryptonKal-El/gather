# PRD: Multi-Type Lists

## Introduction

Gather Lists currently treats every list as a grocery/shopping list — all items show store, category, price, quantity, and unit fields regardless of context. This limits the app's usefulness for non-grocery lists like party guest lists, packing lists, project supply lists, or simple to-do lists.

This feature adds a **list type** system where each list has a type that controls which fields, UI elements, categories, and sort options are active. The existing grocery experience remains untouched — it becomes one of six available list types. Non-grocery types hide irrelevant fields (stores, grocery categories, units) and adapt labels and behaviors to their specific domain.

## Goals

- Support 6 list types: Grocery, Basic, Guest List, Packing, Project, and To-Do
- Each type controls field visibility, labels, categories, and sort options
- Existing grocery lists continue to work identically (zero regression)
- Users select a type when creating a list via a 3x2 icon grid (always asked, no default)
- Users can change a list's type after creation (data preserved silently, fields show/hide)
- Guest List type includes RSVP status (Invited, Confirmed, Declined, Maybe) via dropdown picker per guest
- Recipe "Add to List" shows a warning when the target list is not a Grocery type
- Both React web and native Swift iOS platforms must be updated

## Scope Considerations

- permissions: not relevant (list type is per-list, no new roles involved)
- support-docs: not relevant (`capabilities.supportDocs` is false)
- ai-tools: not relevant (`capabilities.ai` is false)

## User Stories

### US-001: Add `type` column to `lists` table

**Description:** As a developer, I need to store each list's type in the database so the UI can render type-appropriate fields.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] New Supabase migration adds `type` column to `lists` table: text, NOT NULL, default `'grocery'`
- [ ] Valid values: `grocery`, `basic`, `guest_list`, `packing`, `project`, `todo`
- [ ] All existing lists default to `grocery` (no data loss)
- [ ] Migration runs successfully on local Supabase
- [ ] RLS policies continue to work (no changes needed — type is just a column on lists)
- [ ] Lint passes

---

### US-002: Add `rsvp_status` column to `items` table

**Description:** As a developer, I need to store RSVP status per item so Guest List items can track invitation responses.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] New Supabase migration adds `rsvp_status` column to `items` table: text, nullable, default NULL
- [ ] Valid values: `invited`, `confirmed`, `declined`, `maybe`, or NULL (for non-guest-list items)
- [ ] Existing items are unaffected (NULL = no RSVP status)
- [ ] Migration runs successfully on local Supabase
- [ ] Lint passes

---

### US-003: Define list type configuration registry

**Description:** As a developer, I need a centralized configuration object that defines each list type's field visibility, labels, available categories, and sort options so the entire app can reference it.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `src/utils/listTypes.js` with a `LIST_TYPES` configuration object
- [ ] Each type entry defines:
  - `id` (string key matching DB value)
  - `label` (display name, e.g., "Grocery", "Guest List")
  - `icon` (emoji: `🛒`, `📋`, `🎉`, `🧳`, `🏗️`, `📝`)
  - `fields` object: `{ store: bool, category: bool, price: bool, quantity: bool, unit: bool, image: bool, rsvpStatus: bool }`
  - `quantityLabel` (string or null): `"Qty"`, `"Head Count"`, or null (hidden)
  - `categories` (array or null): type-specific category definitions, or null if no categories
  - `sortLevels` (array): available sort level keys for this type
  - `defaultSort` (array): default sort config for this type
- [ ] Grocery type config matches current behavior exactly (store, category, all fields visible)
- [ ] Basic type: only name + checkbox (all fields hidden, no categories, sort by name/date only)
- [ ] Guest List type: quantity (labeled "Head Count") + rsvpStatus visible; no store/category/unit/price/image; sort by name/date
- [ ] Packing type: quantity + category visible (packing categories); no store/price/unit; sort by category/name/date
- [ ] Project type: quantity + price visible; no store/category/unit; sort by name/date/price
- [ ] To-Do type: category visible (to-do categories); no store/price/quantity/unit; sort by category/name/date
- [ ] Export a `getTypeConfig(typeId)` helper function
- [ ] Lint passes

---

### US-004: Define type-specific category sets

**Description:** As a developer, I need separate category definitions for Packing and To-Do list types (grocery categories already exist).

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] Packing categories defined (in `listTypes.js` or a dedicated file): Clothes, Toiletries, Electronics, Documents, Accessories, Medications, Snacks & Food, Entertainment, Miscellaneous — each with `key`, `name`, `color`, `keywords` (for auto-categorization)
- [ ] To-Do categories defined: Work, Personal, Errands, Finance, Health, Home, Other — each with `key`, `name`, `color` (no keyword-based auto-categorization for To-Do)
- [ ] Packing auto-categorization keywords are reasonable (e.g., "shirt"/"pants" → Clothes, "charger"/"laptop" → Electronics, "passport"/"tickets" → Documents, "toothbrush"/"shampoo" → Toiletries)
- [ ] Grocery categories remain unchanged in `src/utils/categories.js`
- [ ] Lint passes

---

### US-005: Create list type configuration for Swift iOS

**Description:** As a developer, I need the list type configuration mirrored in Swift so the iOS app renders type-appropriate fields.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `ListTypeConfig.swift` with equivalent type definitions matching the React `LIST_TYPES`
- [ ] Each type has: `id`, `label`, `icon` (emoji), `fields` struct, `quantityLabel`, `categories`, `sortLevels`, `defaultSort`
- [ ] Packing and To-Do category definitions mirrored from React
- [ ] `getTypeConfig(_ typeId: String) -> ListTypeConfig` helper function
- [ ] All 6 types match their React counterparts exactly
- [ ] Update `GatherList` model to include `type` property (String, default `"grocery"`)
- [ ] Update `Item` model to include `rsvpStatus` property (String?, default nil)
- [ ] Xcode project builds successfully

---

### US-006: List type selector in create-list flow (React)

**Description:** As a user, I want to choose a list type when creating a new list so the list is set up with the right fields for my use case.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] Create-list flow in `ListSelector.jsx` shows a 3x2 icon grid of list types before the name/emoji/color inputs
- [ ] Each grid cell shows the type's emoji icon and label (e.g., 🛒 Grocery, 📋 Basic, 🎉 Guest List, 🧳 Packing, 🏗️ Project, 📝 To-Do)
- [ ] No default is pre-selected — user must tap a type to proceed
- [ ] After selecting a type, the name/emoji/color inputs appear (current flow)
- [ ] Selected type is visually highlighted (e.g., border or background color)
- [ ] `createList` call includes the selected type
- [ ] `database.js` `createList()` function updated to accept and insert `type`
- [ ] Verify in browser
- [ ] Works in both light and dark mode
- [ ] Lint passes

---

### US-007: List type selector in create-list flow (Swift iOS)

**Description:** As an iOS user, I want to choose a list type when creating a new list.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] `CreateListSheet.swift` shows a 3x2 LazyVGrid of list types before the name/emoji/color inputs
- [ ] Each cell shows emoji + label, with a selected state (border highlight or checkmark)
- [ ] No default pre-selected — user must tap a type to proceed
- [ ] After selecting a type, name/emoji/color inputs appear
- [ ] `ListService.createList()` updated to accept and insert `type`
- [ ] `ListViewModel` passes type through to service
- [ ] Xcode project builds successfully

---

### US-008: Conditional field rendering in item display and edit (React)

**Description:** As a user, I want to see only the fields relevant to my list type so the interface isn't cluttered with irrelevant options.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] `ShoppingItem.jsx` reads the list's type config and conditionally renders fields:
  - Store badge: only if `fields.store` is true
  - Category badge: only if `fields.category` is true
  - Price: only if `fields.price` is true
  - Quantity/unit badge: only if `fields.quantity` is true; unit selector only if `fields.unit` is true
  - Image thumbnail: only if `fields.image` is true
- [ ] Edit panel in `ShoppingItem.jsx` conditionally shows/hides:
  - Store picker: only if `fields.store`
  - Category picker: only if `fields.category` (uses type-specific categories)
  - Price input: only if `fields.price`
  - Quantity stepper: only if `fields.quantity`
  - Unit selector: only if `fields.unit`
  - Image picker: only if `fields.image`
- [ ] Quantity label shows the type's `quantityLabel` (e.g., "Head Count" for Guest List)
- [ ] Guest List items show RSVP status dropdown (Invited, Confirmed, Declined, Maybe) instead of checkbox
- [ ] `AddItemForm.jsx` conditionally shows/hides the store picker based on `fields.store`
- [ ] Grocery list behavior is identical to current (all fields visible, no regression)
- [ ] Basic list shows only name + checkbox (cleanest possible UI)
- [ ] Verify in browser
- [ ] Works in both light and dark mode
- [ ] Lint passes

---

### US-009: Conditional field rendering in item display and edit (Swift iOS)

**Description:** As an iOS user, I want to see only the fields relevant to my list type.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] `ListDetailView.swift` item rows conditionally render fields based on type config:
  - Store indicator: only if `fields.store`
  - Category badge: only if `fields.category`
  - Price: only if `fields.price`
  - Quantity badge: only if `fields.quantity`; unit only if `fields.unit`
  - Image thumbnail: only if `fields.image`
- [ ] `EditItemSheet.swift` conditionally shows/hides fields based on type config
- [ ] Add-item bar conditionally shows/hides store picker based on `fields.store`
- [ ] Guest List items show RSVP Picker (Invited/Confirmed/Declined/Maybe) instead of checkbox
- [ ] Quantity label shows type's `quantityLabel`
- [ ] Context menu actions adapted per type (e.g., no "Change Store" for Basic lists)
- [ ] Grocery list behavior identical to current
- [ ] Xcode project builds successfully

---

### US-010: Type-specific auto-categorization

**Description:** As a user, I want items to be auto-categorized using the correct category set for my list type so I don't have to manually categorize every item.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] `categorizeItem()` in React accepts a `listType` parameter
- [ ] Grocery type: uses existing grocery keyword matching (no change)
- [ ] Packing type: uses packing keywords (shirt → Clothes, charger → Electronics, passport → Documents, etc.)
- [ ] To-Do type: no auto-categorization (returns null — user picks manually)
- [ ] Basic, Guest List, Project types: no categorization (returns null)
- [ ] iOS `ItemService` auto-categorization updated with same logic
- [ ] Category picker in edit forms shows type-appropriate categories (not grocery categories for Packing/To-Do lists)
- [ ] Lint passes
- [ ] Xcode project builds successfully

---

### US-011: Adapt sort pipeline for list types

**Description:** As a user, I want the sort options to match my list type so I'm not offered irrelevant sorting (e.g., "Sort by Store" on a To-Do list).

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] `SortPicker.jsx` and `SortLevelEditor.jsx` read the list's type config to determine available sort levels
- [ ] Grocery: store, category, name, date (unchanged)
- [ ] Basic: name, date only
- [ ] Guest List: name, date only
- [ ] Packing: category, name, date
- [ ] Project: name, date, price
- [ ] To-Do: category, name, date
- [ ] `SortConfigSheet.swift` and sort level editor on iOS updated with same per-type sort levels
- [ ] Default sort config per type is applied when no user preference exists
- [ ] If a list changes type and its current sort config contains invalid levels, reset to the new type's default sort
- [ ] `sortPipeline.js` and `SortPipeline.swift` handle `price` as a new sort level (numeric ascending) for Project type
- [ ] Lint passes
- [ ] Xcode project builds successfully

---

### US-012: Change list type after creation

**Description:** As a user, I want to change an existing list's type so I can repurpose a list without recreating it.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] React: Add a "List Type" option in the list's settings/edit area (accessible from the list detail view header or list context menu)
- [ ] Shows the same 3x2 icon grid as creation, with the current type highlighted
- [ ] Tapping a different type shows a confirmation: "Change to [Type]? Some fields may be hidden but your data will be preserved."
- [ ] On confirmation, updates `lists.type` in the database
- [ ] Hidden fields are preserved in the database (e.g., store assignments remain, just not displayed)
- [ ] If the list's sort config contains levels not available in the new type, reset sort config to the new type's default
- [ ] iOS: Same flow accessible from list edit/settings in `ListDetailView.swift`
- [ ] `database.js` and `ListService.swift` support updating list type
- [ ] Realtime sync propagates type changes to other devices/collaborators
- [ ] Verify in browser
- [ ] Works in both light and dark mode
- [ ] Lint passes
- [ ] Xcode project builds successfully

---

### US-013: RSVP status functionality for Guest List items

**Description:** As a user managing a guest list, I want to track each guest's RSVP status so I know who has confirmed, declined, or is undecided.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] React: Guest List items show a dropdown/picker instead of a checkbox with 4 states: Invited (default), Confirmed, Declined, Maybe
- [ ] Each state has a distinct visual: Invited (⚪ gray), Confirmed (🟢 green), Declined (🔴 red), Maybe (🟡 yellow)
- [ ] Tapping the picker opens a dropdown with all 4 options
- [ ] Selection updates `items.rsvp_status` in the database immediately
- [ ] Guest List header shows summary counts (e.g., "4 Confirmed · 2 Maybe · 1 Declined · 3 Invited" or total head count)
- [ ] iOS: Same picker UI (SwiftUI Picker or Menu) with colored status indicators
- [ ] iOS header shows same summary counts
- [ ] `database.js` `updateItem()` and `ItemService.swift` support `rsvp_status` field
- [ ] Items on non-guest-list types ignore `rsvp_status` (field remains NULL)
- [ ] Verify in browser
- [ ] Works in both light and dark mode
- [ ] Lint passes
- [ ] Xcode project builds successfully

---

### US-014: List type indicator in list browser

**Description:** As a user, I want to see each list's type at a glance in the list browser so I can identify them quickly.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] React `ListSelector.jsx`: Each list card shows a small type badge or the type's emoji icon near the list name (subtle, not dominant)
- [ ] If the list already has a user-chosen emoji, the type indicator is secondary (e.g., small label or subtle icon in corner)
- [ ] iOS `ListBrowserView.swift`: Same type indicator treatment
- [ ] Grocery lists can optionally omit the indicator if it feels redundant (since most lists may be Grocery)
- [ ] Verify in browser
- [ ] Works in both light and dark mode
- [ ] Lint passes
- [ ] Xcode project builds successfully

---

### US-015: Recipe "Add to List" warning for non-Grocery lists

**Description:** As a user, I want to be warned when adding recipe ingredients to a non-grocery list so I understand that grocery-specific fields won't apply.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] React: When "Add to List" from a recipe targets a non-Grocery list, show a warning: "This list isn't a Grocery list — ingredients will be added as plain items"
- [ ] Warning includes option to proceed or cancel
- [ ] If user proceeds, ingredients are added with name and quantity only (no store, no category, no unit mapping)
- [ ] Grocery list targets work exactly as before (no change)
- [ ] iOS: Same warning in `AddToListSheet.swift` when selected list is non-Grocery
- [ ] Lint passes
- [ ] Xcode project builds successfully

---

### US-016: Update list context and state management (React)

**Description:** As a developer, I need the React context and state management to propagate list type information so all child components can access it.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] `ShoppingListContext.jsx` includes the current list's `type` in its state
- [ ] List type is fetched with the list data and available to all consuming components
- [ ] When list type changes (via US-012), context updates and all components re-render with new field visibility
- [ ] Realtime subscription handles `type` field changes from other devices
- [ ] `database.js` list queries include the `type` column
- [ ] Lint passes

---

### US-017: Update list view model and services (Swift iOS)

**Description:** As a developer, I need the Swift view models and services to propagate list type information so all views can access it.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] `ListDetailViewModel` exposes the current list's `type` and its resolved `ListTypeConfig`
- [ ] All views that render items or item forms can access the type config from the view model
- [ ] `ListService` list queries include the `type` column
- [ ] Realtime subscription handles `type` field changes
- [ ] When type changes, view model recomputes sort config and field visibility
- [ ] Xcode project builds successfully

---

### US-018: Update user preferences and defaults per type

**Description:** As a developer, I need the sort preference system to respect list type defaults so new lists of each type start with sensible sorting.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] When a list has no `sort_config` override and no user global preference, the system falls back to the type's `defaultSort` (not the global grocery default)
- [ ] Preference hierarchy remains: per-list override → global user default → type default → system default
- [ ] `user_preferences.default_sort_config` continues to work as a global override (applies to all types)
- [ ] React `sortPipeline.js` `resolveSort()` updated to accept list type and use type defaults
- [ ] Swift `SortPipeline.swift` updated with same logic
- [ ] Lint passes
- [ ] Xcode project builds successfully

## Functional Requirements

- FR-1: Add `type` column to `lists` table (text, NOT NULL, default `'grocery'`, valid values: `grocery`, `basic`, `guest_list`, `packing`, `project`, `todo`)
- FR-2: Add `rsvp_status` column to `items` table (text, nullable, valid values: `invited`, `confirmed`, `declined`, `maybe`, NULL)
- FR-3: Each list type defines a field visibility mask controlling which item fields are shown (store, category, price, quantity, unit, image, rsvpStatus)
- FR-4: Create-list flow requires type selection via 3x2 icon grid — no default pre-selected
- FR-5: Item display and edit forms conditionally render fields based on the list's type config
- FR-6: Guest List items replace the checkbox with an RSVP status dropdown (Invited, Confirmed, Declined, Maybe) with colored indicators
- FR-7: Guest List header shows RSVP summary counts and total head count
- FR-8: Packing lists use packing-specific categories (Clothes, Toiletries, Electronics, etc.) with auto-categorization
- FR-9: To-Do lists use to-do-specific categories (Work, Personal, Errands, etc.) without auto-categorization
- FR-10: Sort pipeline adapts per type — only relevant sort levels are available
- FR-11: Changing list type preserves all item data silently (fields are hidden, not deleted)
- FR-12: Type change resets sort config if current config contains invalid levels for the new type
- FR-13: Recipe "Add to List" warns when the target list is not Grocery type; proceeds with plain items if user confirms
- FR-14: List browser shows a type indicator on each list card
- FR-15: All 6 types implemented on both React web and Swift iOS platforms
- FR-16: Existing grocery lists are unaffected (migration defaults to `'grocery'`, zero regression)

## Non-Goals (Out of Scope)

- No custom/user-defined list types (only the 6 built-in types)
- No per-type themes or color schemes (types use the same app theming)
- No type-specific templates or starter items
- No type-specific sharing permissions (sharing works the same for all types)
- No import/export differences per type
- No sub-items or nested items for any type
- No due dates, assignees, or task management features for To-Do type (it's a simple checklist with categories)
- No RSVP notifications or email invitations for Guest List
- No price totals/budgeting for Project type (price is displayed per-item only)
- No per-type user preferences for default sort (one global default sort applies across all types, with per-type system defaults as final fallback)

## Design Considerations

- The type selector grid should feel like a natural first step in list creation — not a barrier
- Type icons (emojis) should be large enough to tap easily on mobile
- Field hiding should make the UI feel intentionally clean, not like something is missing
- Guest List RSVP dropdown should use platform-native picker patterns (HTML select on web, SwiftUI Picker/Menu on iOS)
- RSVP status colors should be accessible (not rely solely on color — include text labels)
- Basic list should feel extremely minimal — just items and checkboxes, like a sticky note
- Reuse existing component patterns: `ShoppingItem` gains conditional rendering, not 6 separate item components

## Technical Considerations

- **Framework:** React (Vite) + Native Swift iOS
- **Database:** Postgres via Supabase
- **Migrations:** `supabase/migrations/` — two new migrations (lists.type, items.rsvp_status)
- The `LIST_TYPES` config is the single source of truth — UI components read from it, never hardcode field visibility
- `categorizeItem()` already exists and needs a `listType` parameter added; packing keywords follow the same pattern as grocery keywords
- Sort pipeline already supports dynamic level configuration — this feature uses that same system with per-type level restrictions
- Guest List RSVP replaces the `is_checked` boolean for visual purposes, but `is_checked` remains in the schema (not used for Guest Lists)
- When changing list type, the only DB update is `lists.type` — no item data is modified
- Realtime subscriptions already watch `lists` table changes, so type updates will propagate to collaborators

## Success Metrics

- Users can create all 6 list types and see appropriate fields for each
- Existing grocery list users experience zero change in behavior
- List type can be changed after creation with no data loss
- Guest List RSVP tracking is functional with summary counts
- Auto-categorization works for Packing items
- Sort pipeline correctly restricts options per type

## Credential & Service Access Plan

No external credentials required for this PRD.

## Definition of Done

Implementation is complete when:

1. Both Supabase migrations run successfully (lists.type, items.rsvp_status)
2. All 6 list types are selectable during list creation on both React and iOS
3. Item fields conditionally show/hide based on list type on both platforms
4. Guest List items show RSVP dropdown with 4 states and colored indicators on both platforms
5. Guest List header shows RSVP summary counts on both platforms
6. Packing and To-Do lists use their own category sets (not grocery categories)
7. Packing auto-categorization works with packing-specific keywords
8. Sort pipeline offers only type-appropriate sort levels on both platforms
9. List type can be changed after creation with a confirmation warning, data preserved
10. Recipe "Add to List" shows warning for non-Grocery targets on both platforms
11. List browser shows type indicators on both platforms
12. Existing grocery lists are completely unaffected (zero regression)
13. All acceptance criteria pass on both React web and Swift iOS
14. Lint passes, Xcode builds, and app runs without errors

## Open Questions

- Should the Guest List RSVP summary also show a total head count (summing all quantities)? (Currently spec'd as yes)
- Should we add a "price" sort level to the global sort pipeline, or only make it available for Project type? (Currently spec'd as Project-only)
- In the future, should users be able to customize which fields are visible per list (beyond the type presets)?
