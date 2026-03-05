# PRD: Swipe-to-Delete + Shake-to-Undo

**Status:** Draft
**Created:** 2026-03-04
**Updated:** 2026-03-04

## Overview

Add mobile-native gesture interactions to Gather: swipe left on shopping list items to delete them instantly, and shake the device to undo the most recent destructive action. The undo system is designed generically so it works for any destructive action (delete item, unshare list, remove recipe from collection, etc.), not just item deletion.

## Problem

Currently, deleting a shopping list item requires tapping the pencil icon, waiting for the edit panel to expand, then tapping the Delete button at the bottom. This is a 3-step process that feels clunky on mobile. There is also no undo mechanism anywhere in the app — every deletion is immediate and permanent, which is unforgiving for accidental actions.

## Goals

1. **One-gesture delete** — Swipe left on a shopping list item to delete it instantly (no confirmation dialog)
2. **Shake-to-undo** — Shake the device to restore the last deleted/destroyed item from an in-memory undo stack
3. **Multi-level undo** — Support undoing multiple recent actions (shake multiple times to undo multiple)
4. **Generic undo system** — The undo stack works for any destructive action, not just item deletion
5. **Clean minimal UX** — No toast, no snackbar, no visual undo button — shake is the only undo mechanism
6. **Accessibility** — Respect `prefers-reduced-motion` for swipe animations

## Non-Goals

- Swipe-to-delete on recipes or collections (shopping list items only)
- Persistent undo history (undo stack is in-memory, cleared on page navigation or refresh)
- Desktop swipe gestures (this is mobile-only; desktop keeps the existing edit panel delete flow)
- Swipe-to-archive or swipe-right actions

## User Decisions

| Question | Decision |
|----------|----------|
| Which items support swipe-to-delete? | Shopping list items only |
| What does undo restore? | Multiple recent deletions (undo stack) |
| Should shake-to-undo work for other destructive actions? | Yes — any destructive action |
| Toast/snackbar after swiping to delete? | No — immediate delete + shake-to-undo only |

## Technical Context

### Current Delete Flow
- `ShoppingItem.jsx` renders each item with `div.itemWrapper` > `div.item`
- User taps pencil icon → edit panel expands → Delete button → immediate hard delete
- `removeItem(userId, listId, itemId)` in `database.js` does `supabase.from('items').delete()`
- `removeItemAction` in `ShoppingListContext.jsx` — no optimistic update, waits for Realtime
- No undo mechanism exists anywhere

### Gesture/Animation Landscape
- `@dnd-kit` installed (used only in RecipeForm for drag-to-reorder) — TouchSensor has 200ms delay + 5px tolerance
- No swipe/gesture library installed
- No touch event handlers in `src/`
- No DeviceMotion/shake detection exists
- CSS animations use `@keyframes` + class toggling with `setTimeout` cleanup
- Standard durations: micro 0.15s, modals 0.15–0.2s, sheets 0.25s, nav 300ms
- Standard easing: `ease` for modals, `ease-out` for nav
- `prefers-reduced-motion` handled in `App.module.css` for nav transitions

### Key Files
| File | Role |
|------|------|
| `src/components/ShoppingItem.jsx` | Swipe target — individual list item row |
| `src/components/ShoppingItem.module.css` | Item styles |
| `src/components/ShoppingList.jsx` | Renders grouped items, has `clearChecked` |
| `src/components/MobileListDetail.jsx` | Full-screen mobile detail view |
| `src/context/ShoppingListContext.jsx` | Delete actions (no undo) |
| `src/services/database.js` | `removeItem()` hard delete, `clearCheckedItems()` |

### @dnd-kit Conflict Considerations
- dnd-kit is NOT currently used on shopping list items (only RecipeForm)
- If dnd-kit is ever added to shopping items, swipe (horizontal) vs reorder (vertical) must be differentiated
- The swipe implementation should use horizontal-only detection with a minimum threshold to avoid accidental triggers

---

## User Stories

### Phase 1: Undo Stack Infrastructure

#### US-001: Create useUndoStack hook

**As a** developer
**I want** a reusable undo stack hook
**So that** any component can push undoable actions and trigger undo

**Acceptance Criteria:**
- Create `src/hooks/useUndoStack.js` exporting a `useUndoStack` hook
- Hook returns `{ push, undo, canUndo, peek, clear }` API
- `push(action)` accepts an object: `{ type: string, data: any, restore: () => Promise<void> }`
- `undo()` pops the most recent action and calls its `restore()` function
- `canUndo` is a boolean indicating if the stack has entries
- `peek()` returns the top action without popping (for debug/display purposes)
- Stack has a configurable max depth (default 20) — oldest entries are dropped when exceeded
- Stack is in-memory only — cleared on unmount
- JSDoc on all exports

**Test Intensity:** medium

---

#### US-002: Create UndoProvider context

**As a** developer
**I want** a global undo context
**So that** any component in the tree can push undoable actions and the shake listener has a single undo target

**Acceptance Criteria:**
- Create `src/context/UndoContext.jsx` with `UndoProvider` and `useUndo` hook
- `UndoProvider` wraps the app and holds a single `useUndoStack` instance
- `useUndo()` returns `{ pushUndo, undo, canUndo }` — a minimal public API
- `pushUndo({ type, data, restore })` adds an action to the stack
- `undo()` restores the most recent action
- Provider is added in `App.jsx` (or the nearest common ancestor above shopping lists)
- JSDoc on all exports

**Test Intensity:** medium

---

### Phase 2: Shake-to-Undo Detection

#### US-003: Create useShakeDetection hook

**As a** mobile user
**I want** the app to detect when I shake my device
**So that** I can trigger undo by shaking

**Acceptance Criteria:**
- Create `src/hooks/useShakeDetection.js`
- Uses `DeviceMotionEvent` API to detect shake gestures
- Shake threshold: acceleration magnitude ≥ 15 m/s² (tunable constant)
- Debounce: ignore subsequent shakes within 500ms of the last detected shake
- On iOS 13+, request `DeviceMotionEvent.requestPermission()` on first user interaction if needed
- Calls a provided `onShake` callback when shake is detected
- Cleans up event listener on unmount
- **No-op when `prefers-reduced-motion: reduce` is set** (disable shake detection entirely — user can still delete via edit panel but cannot undo via shake)
- JSDoc on all exports

**Test Intensity:** medium

---

#### US-004: Wire shake detection to UndoProvider

**As a** mobile user
**I want** shaking my phone to undo the last destructive action
**So that** I can recover from accidental deletions

**Acceptance Criteria:**
- `UndoProvider` (or a child component) uses `useShakeDetection` with `onShake` → `undo()`
- Shake only triggers undo when `canUndo` is true (no-op otherwise)
- Brief haptic feedback via `navigator.vibrate(50)` on successful undo (if Vibration API available)
- Only active on mobile (check `window.matchMedia('(pointer: coarse)')` or similar)
- No visual undo indicator (no toast, no snackbar)

**Test Intensity:** medium

---

### Phase 3: Swipe-to-Delete Gesture

#### US-005: Add swipe gesture detection to ShoppingItem

**As a** mobile user
**I want** to swipe left on a shopping list item
**So that** I can delete it with one gesture

**Acceptance Criteria:**
- Add touch event handlers (`onTouchStart`, `onTouchMove`, `onTouchEnd`) to `ShoppingItem.jsx`
- Use raw touch events (no new library dependency) — keep the bundle lean
- Detect horizontal swipe: track `deltaX` from touch start, ignore if `|deltaY| > |deltaX|` (vertical scroll)
- Minimum swipe threshold: 80px to trigger delete
- While swiping, translate the item content left to follow the finger (`transform: translateX`)
- Reveal a red delete zone behind the item as it slides (background `#E74C3C` or similar red with trash icon)
- If swipe distance < threshold on release, snap back with animation (0.2s ease-out)
- If swipe distance ≥ threshold on release, animate the item off-screen left and trigger delete
- **Do not interfere with vertical scrolling** — if the first 10px of movement is vertical, cancel swipe tracking entirely
- `prefers-reduced-motion`: skip translate animation, use instant opacity fade instead
- Only active on mobile (coarse pointer)

**Test Intensity:** high

---

#### US-006: Swipe delete zone visual design

**As a** mobile user
**I want** a clear visual indicator behind the item I'm swiping
**So that** I know I'm about to delete it

**Acceptance Criteria:**
- Red background (`#E74C3C`) revealed behind the item as it slides left
- White trash icon (🗑️ or SVG) centered vertically, right-aligned in the revealed zone
- Icon fades in as swipe progresses (opacity 0 → 1 over the first 60px of swipe)
- The delete zone has rounded corners matching the item's border radius
- When swipe passes the threshold (80px), the delete zone intensifies slightly (darker red or scale-up on icon) to signal "release to delete"
- CSS Module styles in `ShoppingItem.module.css`

**Test Intensity:** medium

---

#### US-007: Wire swipe delete to undo stack

**As a** mobile user
**I want** swiped-away items to be recoverable via shake
**So that** accidental swipe-deletes are not permanent

**Acceptance Criteria:**
- Before calling `removeItem`, snapshot the full item data (id, name, quantity, unit, category, checked, position, image_url, etc.)
- Push an undo action to UndoContext: `{ type: 'delete-item', data: { listId, item: snapshot }, restore: () => reInsertItem(snapshot) }`
- `reInsertItem` calls `database.addItem()` (or equivalent) to re-create the item with original data
- The re-inserted item should appear in its original position/category
- After pushing undo, proceed with the hard delete via `removeItemAction`

**Test Intensity:** high

---

### Phase 4: Swipe Animation & Polish

#### US-008: Exit animation for deleted items

**As a** mobile user
**I want** a smooth exit animation when I swipe-delete an item
**So that** the deletion feels fluid and intentional

**Acceptance Criteria:**
- After swipe threshold is met and touch ends: animate item sliding fully off-screen left (0.2s ease-out)
- After slide-off completes, collapse the item's height to 0 (0.15s ease) so the list closes the gap smoothly
- Use CSS `@keyframes` + class toggling (consistent with project animation patterns)
- After height collapse completes, trigger the actual deletion (remove from DOM + database)
- `prefers-reduced-motion`: skip slide, instant height collapse (0.1s)

**Test Intensity:** medium

---

#### US-009: Undo restoration animation

**As a** mobile user
**I want** a restored item to animate back into the list
**So that** I have clear feedback that undo worked

**Acceptance Criteria:**
- When an item is restored via undo, it appears with a brief expand-in animation (height 0 → full + fade in, 0.2s ease-out)
- The restored item briefly highlights with a soft green tint (#B5E8C8 at 30% opacity, fading over 1s) to indicate "restored"
- `prefers-reduced-motion`: skip animation, item just appears instantly
- CSS Module styles in `ShoppingItem.module.css`

**Test Intensity:** low

---

### Phase 5: Extend Undo to Other Destructive Actions

#### US-010: Undo for "Clear Checked Items"

**As a** user
**I want** to undo "Clear Checked Items" via shake
**So that** I can recover if I accidentally clear my checked items

**Acceptance Criteria:**
- Before `clearCheckedItems()` executes, snapshot all checked items (full data)
- Push a single undo action: `{ type: 'clear-checked', data: { listId, items: [...snapshots] }, restore: () => reInsertAllItems(snapshots) }`
- `reInsertAllItems` re-creates all items in a batch
- The existing `ConfirmDialog` flow for clear-checked remains unchanged — undo is an additional safety net after confirmation
- Undo restores all items that were cleared, in their original categories/positions

**Test Intensity:** high

---

#### US-011: Undo for "Remove Recipe from Collection"

**As a** user
**I want** to undo removing a recipe from a collection via shake
**So that** I can recover from accidental removal

**Acceptance Criteria:**
- Before removing a recipe from a collection, snapshot the `{ collectionId, recipeId }` relationship
- Push undo action: `{ type: 'remove-from-collection', data: { collectionId, recipeId }, restore: () => addRecipeToCollection(collectionId, recipeId) }`
- After undo, the recipe reappears in the collection's recipe list
- This hooks into the RecipeContext or wherever collection-recipe removal is handled

**Test Intensity:** medium

---

#### US-012: Undo for "Unshare List"

**As a** user
**I want** to undo unsharing a list via shake
**So that** I can recover from accidental unshare

**Acceptance Criteria:**
- Before unsharing a list, snapshot the share relationship (list_id, shared_with user_id, permission level)
- Push undo action: `{ type: 'unshare-list', data: { listId, userId, permission }, restore: () => reshareList(listId, userId, permission) }`
- After undo, the list is re-shared with the same user at the same permission level
- This hooks into wherever list unsharing is handled in ShoppingListContext

**Test Intensity:** medium

---

### Phase 6: Accessibility & Edge Cases

#### US-013: iOS DeviceMotion permission handling

**As an** iOS user
**I want** shake detection to work after granting motion permission
**So that** undo via shake works on iOS Safari and the native app

**Acceptance Criteria:**
- On iOS 13+, `DeviceMotionEvent.requestPermission` must be called from a user gesture
- On first app load (or first destructive action), if permission hasn't been granted, prompt with a one-time non-intrusive request
- Store permission state in `localStorage` to avoid re-prompting
- If permission is denied, shake-to-undo silently degrades (no error shown, items are simply not undoable via shake)
- In Capacitor native context, check if permission request is needed (native app may have different permission model)

**Test Intensity:** high

---

#### US-014: Prevent swipe conflicts with horizontal scroll and edge gestures

**As a** mobile user
**I want** swiping items to not interfere with other gestures
**So that** scrolling, iOS back-swipe, and other interactions work normally

**Acceptance Criteria:**
- Swipe detection ignores touches that start within 20px of the screen's left edge (iOS back gesture zone)
- Swipe detection ignores touches that start within 20px of the screen's right edge
- If `deltaY` exceeds `deltaX` within the first 10px of movement, cancel swipe tracking and allow native scroll
- Do not call `preventDefault()` on touch events until a horizontal swipe is confirmed (to avoid blocking scroll)
- If the item's edit panel is open, disable swipe on that item

**Test Intensity:** high

---

## Credential & Service Access Plan

No external credentials required for this PRD. All functionality uses existing Supabase client for database operations and browser-native APIs (DeviceMotionEvent, Touch Events, Vibration API).

## Definition of Done

Implementation is complete when:

1. **Swipe-to-delete works on mobile shopping list items** — swipe left ≥ 80px triggers instant delete with smooth exit animation
2. **Shake-to-undo restores deleted items** — shake device triggers undo, item reappears with restore animation
3. **Multi-level undo works** — multiple shakes undo multiple recent actions in LIFO order
4. **Undo stack supports all specified destructive actions** — delete item, clear checked, remove from collection, unshare list
5. **No toast/snackbar appears** — the UX is clean with shake as the only undo mechanism
6. **iOS DeviceMotion permission is handled gracefully** — prompts once, remembers, degrades silently if denied
7. **No gesture conflicts** — vertical scrolling, iOS back-swipe, and edge gestures all work normally
8. **`prefers-reduced-motion` is respected** — animations reduced/removed for users with this preference
9. **Desktop is unaffected** — existing edit panel delete flow unchanged on desktop
10. **No new npm dependencies added** — raw touch events, no gesture library
11. **Build passes** (`npm run build` exits clean)
12. **CSS Module styles only** — no inline styles, consistent with project conventions

## Flag Review

| Story | Support Article? | Tools? | Test Intensity | Reasoning |
|-------|------------------|--------|----------------|-----------|
| US-001: useUndoStack hook | ❌ No | ❌ No | medium | Developer infrastructure |
| US-002: UndoProvider context | ❌ No | ❌ No | medium | Developer infrastructure |
| US-003: useShakeDetection hook | ❌ No | ❌ No | medium | Device API integration |
| US-004: Wire shake to undo | ❌ No | ❌ No | medium | Wiring layer |
| US-005: Swipe gesture on ShoppingItem | ❌ No | ❌ No | high | Core gesture — complex touch handling |
| US-006: Swipe delete zone visuals | ❌ No | ❌ No | medium | CSS visual treatment |
| US-007: Wire swipe delete to undo | ❌ No | ❌ No | high | Data integrity — snapshot + restore |
| US-008: Exit animation | ❌ No | ❌ No | medium | Animation polish |
| US-009: Undo restoration animation | ❌ No | ❌ No | low | Animation polish |
| US-010: Undo for clear checked | ❌ No | ❌ No | high | Batch restore — data integrity |
| US-011: Undo remove from collection | ❌ No | ❌ No | medium | Extends undo system |
| US-012: Undo unshare list | ❌ No | ❌ No | medium | Extends undo system |
| US-013: iOS DeviceMotion permission | ❌ No | ❌ No | high | Platform-specific permission flow |
| US-014: Prevent gesture conflicts | ❌ No | ❌ No | high | Edge cases — scroll/gesture interference |

No support articles or tool integrations needed — this is an invisible gesture UX with no user-facing settings or documentation.
