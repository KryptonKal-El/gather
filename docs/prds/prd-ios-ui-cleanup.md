# PRD: iOS UI Cleanup

**ID:** prd-ios-ui-cleanup  
**Status:** Ready  
**Created:** 2026-03-06  
**Priority:** High  

## Overview

Polish the mobile iOS experience to feel more native and maximize screen real estate. This PRD covers 15 improvements: 9 user-requested items and 6 planner-recommended optimizations. All changes target the mobile breakpoint (`max-width: 700px`) with narrower phone adjustments at `max-width: 480px`, and must preserve desktop layout.

## Goals

- Make the app feel like a native iOS app — not a mobile web page
- Maximize usable screen real estate on small phones
- Reduce visual clutter: remove unnecessary borders, chevrons, placeholder text
- Bring the Stores tab up to the same polish level as the Lists tab

## Non-Goals

- Dark mode redesign (existing dark mode CSS variables are preserved)
- New features or data model changes
- Desktop layout changes (all stories are mobile-scoped unless noted)

## Credential & Service Access Plan

No external credentials required for this PRD. All changes are client-side CSS and JSX.

---

## User Stories

### US-001: CSS Quick Wins — Tighten Spacing & Sizing

**Priority:** High  
**Estimate:** Small  
**Files:** `ShoppingItem.module.css`, `MobileListDetail.module.css`, `ListSelector.module.css`, `ShoppingList.module.css`, `Suggestions.module.css`

Batch of CSS-only changes that reduce wasted space across the shopping list view:

**Acceptance Criteria:**

1. **Shrink item thumbnails (6a):** In `ShoppingItem.module.css`, reduce thumbnail from `60×60px` to `40×40px` (`.thumbnail` width/height at line ~34). Adjust border-radius proportionally.

2. **Tighten list item row padding (6b):** In `ShoppingItem.module.css`, reduce `.item` gap from `0.75rem` to `0.5rem` and padding from `0.75rem 1rem` to `0.5rem 0.75rem` (lines ~10-11) within a `@media (max-width: 700px)` block so desktop is unaffected.

3. **Fix bottom scroll padding (6c):** In `MobileListDetail.module.css` (line ~75) and `ListSelector.module.css` (line ~472), the bottom padding of `70px` over-clears the `52px + safe-area` tab bar. Change to `calc(56px + env(safe-area-inset-bottom, 0px))` for a tighter fit.

4. **Reduce suggestion chips spacing (6d):** In `Suggestions.module.css`, reduce `margin-top` from `1.5rem` to `0.75rem` and `padding` from `1.25rem` to `0.75rem` (lines ~2-3) within a `@media (max-width: 700px)` block.

5. **Compact empty-state padding (6f):** In `ShoppingList.module.css`, reduce `.empty` padding from `3rem 1rem` to `1.5rem 1rem` (line ~9) within a `@media (max-width: 700px)` block.

**Verification:** On mobile, the shopping list shows more items above the fold. Desktop layout unchanged.

---

### US-002: Remove Store Badge Dashed Border in Edit Panel

**Priority:** High  
**Estimate:** Tiny  
**Files:** `ShoppingItem.module.css`

The store pill in the item edit panel has a dashed border that looks out of place — it should match the category badge style.

**Acceptance Criteria:**

1. In `ShoppingItem.module.css`, change `.storeBadge` border from `1px dashed rgba(255, 255, 255, 0.5)` to `none` (line ~294), matching the `.category` style (line ~317).

**Verification:** Open any item's edit panel — the store badge appears as a solid pill without a dashed border.

---

### US-003: Remove Chevron from List Items

**Priority:** High  
**Estimate:** Tiny  
**Files:** `ListSelector.jsx`, `ListSelector.module.css`

The `›` chevron on each list row adds visual noise without aiding navigation.

**Acceptance Criteria:**

1. In `ListSelector.jsx`, remove the `<span className={styles.chevron}>›</span>` from `renderListItem()` (line ~173).
2. In `ListSelector.module.css`, remove or comment out the `.chevron` styles (lines ~438-445).

**Verification:** List items no longer show a trailing chevron. Tap-to-open still works.

---

### US-004: Hide Price Placeholder When No Price Set

**Priority:** High  
**Estimate:** Tiny  
**Files:** `ShoppingItem.jsx`

When an item has no price, the UI shows `$–` which wastes space and adds clutter.

**Acceptance Criteria:**

1. In `ShoppingItem.jsx` (line ~337), conditionally render the price element. If `item.price` is `null`, `undefined`, `""`, or `0`, render nothing instead of `$–`.
2. The price should still display normally when a value is set (e.g., `$4.99`).

**Verification:** Items without a price show no price indicator at all. Items with a price display it as before.

---

### US-005: AddItemForm — Single-Line Compact Layout

**Priority:** High  
**Estimate:** Medium  
**Files:** `AddItemForm.jsx`, `AddItemForm.module.css`

The add-item form currently wraps to two lines on mobile (input on top, store select + button below). All three controls should fit on one line to save vertical space.

**Acceptance Criteria:**

1. On mobile (`max-width: 700px`), the form renders as a single row: text input → store select → add button, all on one line.
2. The text input takes remaining space (`flex: 1`).
3. The store `<select>` is narrowed — remove `min-width: 120px`, set a compact width (e.g., `min-width: 0; max-width: 90px`), and reduce padding to `0.4rem 0.25rem`. The full store name shows in the dropdown, so the visible width can be small.
4. The add button is compact — reduce padding to `0.4rem 0.75rem`.
5. The overall row height matches the search bar height (`min-height: 36px`), with input padding reduced to `0.4rem 0.75rem`.
6. Remove `flex-wrap: wrap` on mobile (override the base `.form` class).

**Verification:** On a 375px-wide viewport, all three controls fit on one line. The form row height is visually similar to the search bar above it.

---

### US-006: Replace "+ New" Button with iOS-Style Plus Button

**Priority:** Medium  
**Estimate:** Small  
**Files:** `ListSelector.jsx`, `ListSelector.module.css`

The "+ New" text button doesn't feel native iOS. Replace it with a circular `+` icon button.

**Acceptance Criteria:**

1. Replace the "+ New" text content with a simple `+` character (or an SVG plus icon) inside a circular button.
2. Style: `width: 28px; height: 28px; border-radius: 50%; background: var(--primary); color: white; font-size: 1.2rem; font-weight: 600; border: none; display: flex; align-items: center; justify-content: center;`
3. Position it in the header area next to the search bar or list title.
4. When creating (cancel state), show an `×` icon in the same circular style with a muted background.
5. Desktop can keep the existing text-based button or adopt the same circular style — builder's discretion.

**Verification:** The Lists header shows a small circular `+` button. Tapping it starts list creation. During creation, it becomes `×` to cancel.

---

### US-007: Improve Navigation Push Transition

**Priority:** Medium  
**Estimate:** Small  
**Files:** `App.module.css`

The current slide-left transition when opening a list moves the list screen only 30% left, making it feel like an overlay rather than a native iOS push navigation.

**Acceptance Criteria:**

1. In `App.module.css`, update `@keyframes slideOutLeft` to translate the list screen to `-100%` instead of `-30%`. This fully pushes the list off-screen.
2. Update `@keyframes slideInFromLeft` (the pop-back) to start from `-100%` instead of `-30%`.
3. Optionally add a subtle opacity fade (e.g., `opacity: 0.6` at the end of slide-out) to enhance the depth illusion.
4. Keep the 300ms duration and `ease-out` timing function.
5. The reduced-motion media query must still disable animations.

**Verification:** When tapping a list, the lists view slides fully off the left edge while the detail view slides in from the right — matching iOS UINavigationController behavior. Back navigation reverses it.

---

### US-008: Image Lightbox — Larger Preview & Relocated Remove Button

**Priority:** Medium  
**Estimate:** Small  
**Files:** `ImagePicker.jsx`, `ImagePicker.module.css`

The current image preview in the ImagePicker modal is only 120×120px — too small to see detail. The "Remove image" button overlaps the visual focus area.

**Acceptance Criteria:**

1. Increase `.preview` to fill the available modal width: `width: 100%; max-width: 400px; height: auto; aspect-ratio: 1; object-fit: contain;` (replacing the fixed `120×120px`).
2. Change the `.currentImage` layout from centered column to a container where the image takes most of the space.
3. Move the "Remove image" button to the bottom-right of the `.currentImage` section using absolute positioning or a flex layout that places it after the image without overlapping.
4. On narrow viewports (`max-width: 480px`), the preview should be full-width minus padding.
5. The remove button should remain clearly visible and tappable (min `44×44px` touch target).

**Verification:** Opening the image picker for an item with a photo shows a large preview that fills most of the modal width. The "Remove image" button is below or at the bottom-right, not overlapping the image.

---

### US-009: Collapsible Store Groups in Shopping List

**Priority:** Medium  
**Estimate:** Medium  
**Files:** `ShoppingList.jsx`, `ShoppingList.module.css`

Store sections in the shopping list are always expanded. Users should be able to tap a store header to collapse/expand its items, reducing scrolling when multiple stores have items.

**Acceptance Criteria:**

1. Add a `collapsedStores` state (Set or object) to `ShoppingList.jsx` that tracks which store IDs are collapsed.
2. When a `.storeTitle` is tapped, toggle that store's collapsed state.
3. When collapsed, hide the `.storeBody` content (items) and show a chevron indicator pointing right (`›`). When expanded, the chevron points down (`⌄`) or rotates.
4. Default state: all stores expanded.
5. Add a subtle CSS transition for the chevron rotation (e.g., `transform: rotate(90deg)` with `transition: transform 0.2s`).
6. The item count badge in the store header should always be visible (collapsed or expanded).
7. Checked items section (if it's a separate group) should not be collapsible.

**Verification:** Tapping a store header collapses its items and shows a right-pointing chevron. Tapping again expands it. Multiple stores can be independently collapsed.

---

### US-010: Store Manager — Full ListSelector-Like Treatment

**Priority:** High  
**Estimate:** Large  
**Files:** `StoreManager.jsx`, `StoreManager.module.css`, `App.jsx`, `App.module.css`

The Stores tab currently uses a toggle-panel with inline CRUD — it feels like a settings page, not a first-class tab. Rewrite it to match the Lists tab's polish level.

**Part A — Store List View:**

1. The Stores tab renders a list view matching the ListSelector layout: header with title + circular `+` button, search bar, scrollable store list.
2. Each store row shows: color dot, store name, item count (number of items assigned to this store across all lists), and a three-dot `⋯` menu button.
3. The search bar filters stores by name (same pattern as ListSelector).
4. The `+` button opens an inline creation row at the top of the list (same pattern as ListSelector new-list creation).

**Part B — Store Actions (Three-Dot Menu):**

5. Tapping `⋯` on a store row opens an action sheet on mobile (or a dropdown on desktop) with: "Edit Name", "Change Color", "Delete".
6. "Edit Name" converts the row to an inline edit input (same as ListSelector rename).
7. "Change Color" shows a color picker (simple row of color swatches).
8. "Delete" shows a confirmation dialog, then calls `onDelete`.

**Part C — Drag-to-Reorder:**

9. Stores remain reorderable via drag handle (existing `onReorder` prop).
10. The drag handle appears on the left side of each store row (consistent with the existing pattern).

**Part D — Mobile Integration:**

11. On mobile, the Stores tab in `App.jsx` should render the new StoreManager directly (no longer needs the `mobileHeader` + `mobileScrollContent` wrapper since StoreManager handles its own header/scroll).
12. Remove the `alwaysOpen` prop if no longer needed.

**Verification:** The Stores tab looks and behaves like the Lists tab — with a search bar, `+` button, store list with menus, and action sheet interactions on mobile. Feels like a native iOS list view, not a settings panel.

---

## Flag Review

| Story | Support Article? | Tools? | Test Intensity | Reasoning |
|-------|------------------|--------|----------------|-----------|
| US-001: CSS Quick Wins | No | No | low | CSS-only spacing adjustments |
| US-002: Store Badge Border | No | No | low | Single CSS property change |
| US-003: Remove Chevron | No | No | low | Remove one JSX element + CSS |
| US-004: Hide Price Placeholder | No | No | low | Conditional render tweak |
| US-005: AddItemForm Compact | No | No | medium | Layout restructure on mobile |
| US-006: iOS Plus Button | No | No | low | Styling change for button |
| US-007: Navigation Transition | No | No | low | CSS animation values |
| US-008: Image Lightbox | No | No | medium | Layout change in modal |
| US-009: Collapsible Store Groups | No | No | medium | New interactive state |
| US-010: Store Manager Rewrite | No | No | high | Major component rewrite |

## Definition of Done

Implementation is complete when:

1. **All 10 user stories pass their acceptance criteria** on an iPhone-sized viewport (375×812).
2. **Desktop layout is unaffected** — all mobile-scoped changes are gated behind `@media (max-width: 700px)` or the `useIsMobile` hook.
3. **Dark mode preserved** — all new/changed styles use CSS custom properties; no hardcoded colors.
4. **No regressions** — existing features (swipe-to-delete, drag-to-reorder, undo, share, add item, store assignment, image picker) continue working.
5. **Build succeeds** — `npm run build` completes without errors.
6. **Capacitor sync** — `npx cap sync ios` completes without errors.
7. **Visual inspection on 375px viewport** confirms: more items visible above the fold, transitions feel native, Stores tab matches Lists tab quality.

## Suggested Implementation Order

Builder should implement stories in this order to manage dependencies and build momentum:

1. **US-001** — CSS quick wins (unblocks everything, immediate visual improvement)
2. **US-002** — Store badge border (tiny, while editing ShoppingItem.module.css)
3. **US-003** — Remove chevron (tiny)
4. **US-004** — Hide price placeholder (tiny)
5. **US-005** — AddItemForm compact layout
6. **US-006** — iOS plus button (shared pattern needed by US-010)
7. **US-007** — Navigation push transition
8. **US-008** — Image lightbox improvements
9. **US-009** — Collapsible store groups
10. **US-010** — Store Manager rewrite (largest, depends on patterns from US-006)
