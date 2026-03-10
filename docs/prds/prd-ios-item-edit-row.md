# PRD: iOS Item Row — Edit Button, Tap Behavior & Store Indicator

**Status:** Ready  
**Created:** 2026-03-10  
**Updated:** 2026-03-10  
**Branch:** `feature/ios-item-edit-row`

---

## Problem

The current iOS item row has two UX issues:

1. **No direct edit access** — editing an item (name, quantity, price, store, category, image) requires long-pressing for the context menu, then navigating nested submenus. There's no visible edit affordance.

2. **Accidental check-offs** — tapping anywhere on the row toggles checked/unchecked. Users accidentally cross items off when they meant to interact with the row (e.g., scroll, read, or edit). Only the checkbox circle should be a single-tap toggle target.

3. **No visual store indicator in add-item bar** — when a store is selected in the add-item store picker, it shows the store name as plain text in the list accent color. There's no color association with the store itself, making it hard to tell at a glance which store is active.

---

## Solution

### 1. Edit Button + Edit Sheet

Add a visible edit button (pencil icon) on the far right of each item row. Single-tapping it opens a full edit sheet with all editable fields consolidated into one form:
- Name
- Quantity
- Price
- Store
- Category
- Image

This replaces the need to navigate context menu submenus for common edits. The context menu remains available for quick single-field actions.

### 2. Tap Behavior Change

Change the item row tap zones:
- **Checkbox circle** — single tap toggles check/uncheck (both directions)
- **Rest of the row** (name, thumbnail, quantity badge, price, edit button area excluded) — double tap toggles check/uncheck (both directions)
- **Edit button** — single tap opens edit sheet
- **Image thumbnail** — single tap opens image picker (existing behavior, preserved)

This prevents accidental check-offs while keeping the interaction discoverable.

### 3. Store Color Indicator in Add-Item Bar

When a store is selected in the add-item toolbar's store picker, replace the plain-text name with: the same storefront SF Symbol tinted in the store's color, with the store name (truncated to fit) shown underneath in a tiny caption. When no store is selected, keep the existing secondary-colored storefront icon with no label underneath.

---

## User Stories

### US-001: Edit Button on Item Row

**Type:** iOS (Swift)

Add a pencil icon button to the trailing edge of the item row, before the price.

**Current layout:**
```
[○ circle] [thumbnail] [name] [×qty badge] ... [price]
```

**New layout:**
```
[○ circle] [thumbnail] [name] [×qty badge] ... [price] [✎ edit]
```

**Required changes:**

1. In `ListDetailView.itemRow(item:isChecked:)`, add an edit button (SF Symbol `pencil.circle` or `pencil`) after the `Spacer()` and price, aligned to the trailing edge.
2. The button should be subtle — use `.secondary` foreground color, small-ish icon (`.body` or `.subheadline` size).
3. Tapping the edit button sets a new `@State` property (e.g., `editSheetItem: Item?`) that presents the edit sheet.
4. The edit button should appear on both unchecked and checked item rows.

**Acceptance Criteria:**
- [ ] Every item row shows a pencil edit icon on the far right
- [ ] The edit icon is visually subtle (secondary color) and does not compete with the item name or price
- [ ] Tapping the edit icon sets state to present the edit sheet (US-002)
- [ ] The edit icon appears on both checked and unchecked items
- [ ] Xcode build succeeds

---

### US-002: Item Edit Sheet

**Type:** iOS (Swift)

Create a new `EditItemSheet` SwiftUI view presented as a `.sheet` when the edit button is tapped. Consolidates all editable fields into a single form.

**Fields:**
- **Name** — text field (required, non-empty)
- **Quantity** — stepper or number field (min 1)
- **Price** — decimal text field (optional, clearable)
- **Store** — picker from available stores + "No store" option
- **Category** — picker from categories (based on selected store's categories, or defaults)
- **Image** — thumbnail preview + "Change Image" / "Remove Image" / "Set Image" button (tapping opens the existing `ItemImagePickerSheet`)

**Sheet behavior:**
- Navigation title: "Edit Item"
- Cancel button (top-left) — dismisses without saving
- Save button (top-right) — saves all changes in a single `updateItem` call, then dismisses
- Save should be disabled when name is empty
- Changing the store should update the category picker options to reflect that store's categories

**Required changes:**

1. Create `ios-native/GatherLists/GatherLists/Views/Lists/EditItemSheet.swift`.
2. The sheet receives: the `Item`, the `stores` array, a reference or closure to `ListDetailViewModel` for saving, and the `userId` for image operations.
3. On Save, call `detailViewModel.updateItem(itemId, name:, category:, storeId:/clearStoreId:, quantity:, price:/clearPrice:)` with all changed fields.
4. For image changes, reuse the existing `ItemImagePickerSheet` by presenting it as a nested sheet or navigation destination from within the edit sheet.
5. Wire the `.sheet(item: $editSheetItem)` in `ListDetailView`.

**Acceptance Criteria:**
- [ ] Tapping the edit button opens a sheet with Name, Quantity, Price, Store, Category, and Image fields
- [ ] All fields are pre-populated with the item's current values
- [ ] Changing the store updates the category picker options
- [ ] Cancel dismisses without saving
- [ ] Save persists all changes and dismisses the sheet
- [ ] Save is disabled when the name field is empty
- [ ] Image section shows current thumbnail (if any) with change/remove options
- [ ] Xcode build succeeds

---

### US-003: Checkbox Single-Tap Toggle

**Type:** iOS (Swift)

Change the item row so that only the checkbox circle responds to a single tap for toggling.

**Current behavior:**
The entire row has `.onTapGesture { toggleItem(item) }` via `.contentShape(Rectangle())`.

**Required changes:**

1. Remove the `.onTapGesture` from the row-level `HStack`.
2. Wrap the checkbox `Image(systemName: ...)` in a `Button` or give it its own `.onTapGesture` that calls `toggleItem`.
3. Give the checkbox a generous tap target (at least 44×44 points) using `.frame()` and `.contentShape()` so it's easy to hit.
4. Keep the `.contentShape(Rectangle())` on the row for the context menu and swipe actions to still work.

**Acceptance Criteria:**
- [ ] Tapping the checkbox circle toggles the item (check/uncheck)
- [ ] Tapping the item name, quantity badge, price, or empty space does NOT toggle the item
- [ ] The checkbox has a minimum 44×44pt tap target
- [ ] Context menu (long press) still works anywhere on the row
- [ ] Swipe-to-delete still works on the row
- [ ] Xcode build succeeds

---

### US-004: Double-Tap Row Toggle

**Type:** iOS (Swift)

Add a double-tap gesture on the non-checkbox portion of the row to toggle check/uncheck.

**Required changes:**

1. Add a `.onTapGesture(count: 2)` to the row content area (excluding the checkbox and edit button) that calls `toggleItem`.
2. The double-tap must not interfere with:
   - Single-tap on the checkbox (US-003)
   - Single-tap on the edit button (US-001)
   - Single-tap on the image thumbnail (existing image picker)
   - Long-press context menu
   - Swipe-to-delete
3. Use SwiftUI gesture precedence to ensure double-tap is recognized before any single-tap fallback on the row body. The checkbox, edit button, and thumbnail have their own isolated single-tap handlers and should not be affected.

**Acceptance Criteria:**
- [ ] Double-tapping the item name, quantity badge, price area, or empty row space toggles check/uncheck
- [ ] Single-tapping those same areas does nothing (no toggle)
- [ ] Double-tap works on both unchecked items (to check) and checked items (to uncheck)
- [ ] Single-tap on checkbox still toggles (not blocked by double-tap gesture)
- [ ] Single-tap on edit button still opens edit sheet
- [ ] Single-tap on image thumbnail still opens image picker
- [ ] Long-press context menu still works
- [ ] Swipe-to-delete still works
- [ ] Xcode build succeeds

---

### US-005: Store Color Indicator in Add-Item Bar

**Type:** iOS (Swift)

Replace the plain-text store name in the add-item toolbar's store picker label with a color-tinted storefront icon and a truncated store name caption underneath.

**Current behavior:**
- **Store selected:** Shows `Text(store.name)` in the list accent color (`.subheadline`, `.foregroundStyle(listColor)`).
- **No store selected:** Shows `Image(systemName: "storefront")` in `.secondary`.

**New behavior:**
- **Store selected:** Show the same `storefront` SF Symbol, but tinted with the store's `color` (hex string parsed to `Color`). Below the icon, show the store name in a tiny caption (`.caption2` or similar), truncated to fit (`.lineLimit(1)`), also tinted in the store's color. Wrap in a `VStack(spacing: 2)` to stack icon + name vertically.
- **No store selected:** Keep the existing `storefront` icon in `.secondary` with no label underneath (no change).
- If the store has no color (`color` is `nil`), fall back to `.secondary` for both the icon and caption (same as unselected appearance, but with the name showing).

**Required changes:**

1. In `ListDetailView.storePicker(stores:)`, replace the selected-store branch of the `label:` closure:
   ```swift
   // Current:
   Text(store.name)
       .font(.subheadline)
       .foregroundStyle(listColor)
       .lineLimit(1)
   
   // New:
   VStack(spacing: 2) {
       Image(systemName: "storefront")
           .font(.subheadline)
           .foregroundStyle(storeColor)
       Text(store.name)
           .font(.caption2)
           .foregroundStyle(storeColor)
           .lineLimit(1)
   }
   ```
2. Parse `store.color` (a hex string like `"#4CAF50"`) into a SwiftUI `Color`. A `Color(hex:)` extension may already exist in the project — reuse it if so. If not, add a small `Color+Hex` extension.
3. The VStack should stay vertically centered in the toolbar HStack. It will be slightly taller than the old text-only label but should fit comfortably in the existing 12pt vertical padding.

**Acceptance Criteria:**
- [ ] When a store is selected, the picker shows a storefront icon tinted in the store's color
- [ ] Below the icon, the store name appears as a small caption, truncated to fit, in the store's color
- [ ] If the store has no color, both icon and caption fall back to secondary color
- [ ] When no store is selected, the storefront icon shows in secondary with no label (unchanged)
- [ ] The label fits within the existing add-item toolbar without layout overflow
- [ ] Xcode build succeeds

---

## Credential & Service Access Plan

No external credentials required for this PRD.

---

## Definition of Done

- [ ] Every item row shows a subtle edit pencil icon on the trailing edge
- [ ] Tapping the edit icon opens a full edit sheet with Name, Quantity, Price, Store, Category, Image
- [ ] Only the checkbox circle responds to single-tap for toggling
- [ ] Double-tapping the row body toggles check/uncheck
- [ ] Store picker shows color-tinted storefront icon with truncated name caption when a store is selected
- [ ] All existing interactions preserved: context menu, swipe-to-delete, image thumbnail tap
- [ ] No regressions on checked items section
- [ ] Xcode build succeeds

---

## Flag Review

| Story | Support Article? | Tools? | Test Intensity | Reasoning |
|-------|------------------|--------|----------------|-----------|
| US-001: Edit button on row | ❌ No | ❌ No | low | Simple UI addition |
| US-002: Edit item sheet | ❌ No | ❌ No | medium | New view with form logic and save |
| US-003: Checkbox single-tap | ❌ No | ❌ No | medium | Gesture refactor — must not break existing interactions |
| US-004: Double-tap row toggle | ❌ No | ❌ No | high | Gesture precedence is tricky — must coexist with single-tap, long-press, swipe |
| US-005: Store color indicator | ❌ No | ❌ No | low | Small visual change in picker label |

---

## Technical Notes

### Gesture Precedence

SwiftUI processes gestures by specificity. The key ordering:

1. **Checkbox area** — own `onTapGesture(count: 1)` on the Image/Button. Isolated, not affected by parent gestures.
2. **Edit button** — own `onTapGesture(count: 1)` or `Button`. Isolated.
3. **Image thumbnail** — own `onTapGesture(count: 1)`. Isolated (already exists).
4. **Row body** — `onTapGesture(count: 2)` for double-tap toggle. Since `count: 2` requires two taps, single taps on the row body are ignored.
5. **Row level** — `.contextMenu` and `.swipeActions` remain on the outer container.

The critical thing: the checkbox, edit button, and thumbnail each have their own isolated tap handlers on their specific views, so they intercept taps before the row-level double-tap gesture is evaluated.

### Edit Sheet Architecture

`EditItemSheet` should use `@State` copies of all fields, initialized from the item. On Save, diff against the original item and only send changed fields to `updateItem`. This avoids unnecessary writes.

The store and category pickers should be inline `Picker` views within a `Form`/`List`, matching the iOS native settings style.
