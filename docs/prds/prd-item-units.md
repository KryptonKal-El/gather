# PRD: Item Units

**Status:** Ready  
**Created:** 2026-03-10  
**Branch:** `feature/item-units`

## Overview

Add a **unit** field to shopping list items so quantities can have meaningful measurements (e.g., "2 cups", "1 lb", "3 each"). The unit defaults to "each" and is selectable from a cooking-basics set. When the unit is not "each", it displays next to the quantity on the item row for both React and Swift platforms.

## Problem Statement

Items currently have an integer `quantity` field with no unit — "3" could mean 3 individual items, 3 cups, or 3 pounds. When importing recipe ingredients (upcoming Spoonacular integration), we lose unit information. Users have to memorize or mentally convert quantities, and shared list recipients have no context for what "2" means for flour versus eggs.

## Goals

1. Add a `unit` column to the `items` table with a default of `"each"`
2. Provide a predefined set of cooking-basics units for selection
3. Display unit next to quantity on item rows when unit ≠ "each"
4. Add unit picker to the Edit Item form on both platforms
5. Keep the Add Item bar simple — no unit picker there
6. Ensure backward compatibility — existing items default to "each" seamlessly

## Non-Goals

- Unit conversion (e.g., cups → ml)
- Custom/freeform unit input
- Unit picker in the Add Item bar
- Changing the quantity field from integer to decimal (future enhancement)
- Syncing units to recipe ingredient quantities

## Unit Set

| Value | Display Label |
|-------|--------------|
| `each` | each |
| `cups` | cups |
| `tbsp` | tbsp |
| `tsp` | tsp |
| `oz` | oz |
| `lb` | lb |
| `g` | g |
| `kg` | kg |
| `ml` | ml |
| `L` | L |
| `dozen` | dozen |
| `pinch` | pinch |

## User Stories

### US-001: Database Migration — Add Unit Column

**As a** developer  
**I want** a `unit` column on the `items` table  
**So that** items can store their measurement unit

**Acceptance Criteria:**
- New Supabase migration file adds `unit text DEFAULT 'each'` to the `items` table
- Existing items get `'each'` as default (non-null, backward-compatible)
- Column is nullable: `false` (DEFAULT handles existing rows)
- No changes to RLS policies needed (unit is just another column on items)
- Migration is idempotent

### US-002: React — Update Item Model & Service Layer

**As a** developer  
**I want** the React service layer to support the `unit` field  
**So that** items can be created and updated with units

**Acceptance Criteria:**
- `addItem` in `database.js` includes `unit` field in insert (default: `'each'`)
- `addItems` batch insert includes `unit` field (default: `'each'`)
- `updateItem` maps `unit` field in updates
- Realtime subscription picks up `unit` changes automatically (already fetches full row)
- No changes needed to `ShoppingListContext` beyond passing through the field

### US-003: Swift — Update Item Model & Service Layer

**As a** developer  
**I want** the Swift Item model and ItemService to support the `unit` field  
**So that** items can be created and updated with units

**Acceptance Criteria:**
- `Item.swift` adds `var unit: String` field with CodingKey `"unit"` and default `"each"`
- `ItemService.addItem` accepts optional `unit` parameter (default: `"each"`)
- `ItemService.updateItem` accepts optional `unit` parameter
- `NewItem` (insertable DTO) includes `unit` field
- `ItemUpdate` (updatable DTO) includes optional `unit` field
- `addIngredientItems` passes `"each"` as unit for now (recipe import will set proper units later)

### US-004: React — Unit Picker in Edit Item Panel

**As a** user on the web app  
**I want** to set a unit for an item when editing it  
**So that** I can specify measurements like cups, pounds, or tablespoons

**Acceptance Criteria:**
- New row in `ShoppingItem.jsx` edit panel between Quantity and Price rows
- Label: "Unit"
- Dropdown/select with the 12 cooking-basics units
- Default selection matches the item's current unit (or "each" for existing items)
- Changing the unit calls `onUpdateItem(item.id, { unit: newUnit })`
- Clean, compact styling consistent with existing edit panel rows
- CSS Module styles added

### US-005: Swift — Unit Picker in Edit Item Sheet

**As a** user on the iOS app  
**I want** to set a unit for an item when editing it  
**So that** I can specify measurements like cups, pounds, or tablespoons

**Acceptance Criteria:**
- New `Picker` row in `EditItemSheet.swift` in the Quantity section (below the stepper)
- Label: "Unit"
- Picker with the 12 cooking-basics units
- Default selection matches the item's current unit
- `onSave` callback updated to include selected unit
- `EditItemSheet` init updated to accept and manage unit state

### US-006: React — Display Unit on Item Row

**As a** user on the web app  
**I want** to see the unit next to the quantity on my shopping list  
**So that** I know what "2" means — 2 cups, 2 pounds, or just 2 items

**Acceptance Criteria:**
- Display logic in `ShoppingItem.jsx`:
  - **When `unit === 'each'`:** Unchanged — shows `(2)` only when qty > 1, exactly as today
  - **When `unit !== 'each'`:** Always shows `{qty} {unit}` with a space (e.g., `4 lbs`, `2 cups`, `1 tsp`) — displayed even when qty = 1 because the unit is meaningful
- Format appears in the same position as the existing quantity badge/parenthetical
- Line total calculation unchanged (qty × price regardless of unit)

### US-007: Swift — Display Unit on Item Row

**As a** user on the iOS app  
**I want** to see the unit next to the quantity on my shopping list  
**So that** I know what measurement each item requires

**Acceptance Criteria:**
- Display logic in `ListDetailView.swift` `itemRow()`:
  - **When `unit === "each"`:** Unchanged — shows `×2` capsule badge only when qty > 1, exactly as today
  - **When `unit !== "each"`:** Always shows `{qty} {unit}` (e.g., `4 lbs`, `2 cups`, `1 tsp`) in the capsule badge — displayed even when qty = 1
- Badge styling accommodates longer text gracefully (e.g., `3 dozen` fits)

### US-008: Unit Constants — Shared Definition

**As a** developer  
**I want** the unit set defined in one place per platform  
**So that** the unit list is consistent between add/edit/display flows

**Acceptance Criteria:**
- React: `ITEM_UNITS` constant array in a shared location (e.g., `src/constants/units.js` or within `database.js`), each entry with `{ value, label }`
- Swift: `ItemUnit` enum or static array in a shared location (e.g., `Models/ItemUnit.swift`), each entry with raw value and display name
- Both platforms use the same 12 units in the same order
- Default unit (`"each"`) is the first entry

## Credential & Service Access Plan

No external credentials required for this PRD.

## Definition of Done

Implementation is complete when:

1. **Migration deployed:** `unit` column exists on `items` table with default `'each'`, all existing items have the default value
2. **React service layer:** `addItem`, `addItems`, `updateItem` all handle the `unit` field correctly
3. **Swift service layer:** `Item` model, `ItemService.addItem`, `ItemService.updateItem`, and DTO structs all include `unit`
4. **React edit panel:** Unit dropdown appears in the edit panel, changes persist to database
5. **Swift edit sheet:** Unit picker appears in EditItemSheet, changes persist to database
6. **React display:** Item rows show "{qty} {unit}" when unit ≠ "each", unchanged behavior for "each"
7. **Swift display:** Item rows show "×{qty} {unit}" in capsule badge when unit ≠ "each", unchanged behavior for "each"
8. **Constants:** Unit set defined once per platform, reused everywhere
9. **Backward compatible:** No existing functionality regresses — items without explicit unit show as "each" seamlessly
10. **Realtime sync:** Unit changes sync in real-time on both platforms (shared lists see unit updates)

## Flag Review

| Story | Support Article? | Tools? | Test Intensity | Reasoning |
|-------|------------------|--------|----------------|-----------|
| US-001: DB migration | ❌ No | ❌ No | low | Schema addition with safe default |
| US-002: React service layer | ❌ No | ❌ No | low | Passthrough field |
| US-003: Swift service layer | ❌ No | ❌ No | low | Passthrough field |
| US-004: React unit picker | ✅ Yes | ❌ No | medium | New edit panel control |
| US-005: Swift unit picker | ✅ Yes | ❌ No | medium | New edit sheet control |
| US-006: React display | ✅ Yes | ❌ No | medium | Visible change to item rows |
| US-007: Swift display | ✅ Yes | ❌ No | medium | Visible change to item rows |
| US-008: Unit constants | ❌ No | ❌ No | low | Internal code structure |
