# PRD: List Color Picker & Display Upgrade

## Introduction

The Stores UI in Gather Lists has a more polished color experience than Lists — stores show a clean 12px color circle next to the name, offer 18 preset colors, and on iOS include a native custom color picker. Lists, by contrast, use a 4px vertical left border for color, only offer 10 preset colors, have smaller swatches, and lack custom color support on iOS.

This PRD upgrades the Lists color system to match the Stores pattern: replace the vertical bar with a color circle, expand to 18 preset colors, add a custom color picker on iOS, and align swatch sizing.

## Goals

- Replace the 4px vertical left border on list rows with a 12px color circle (matching stores)
- Expand list preset colors from 10 to 18 (matching stores)
- Add native `ColorPicker` for custom colors on iOS (matching stores)
- Align color swatch sizing between lists and stores (28px on web desktop, 36pt grid on iOS)
- Both React web and native Swift iOS platforms updated
- Zero regression to existing list functionality

## Scope Considerations

- permissions: not relevant
- support-docs: not relevant (`capabilities.supportDocs` is false)
- ai-tools: not relevant (`capabilities.ai` is false)

## User Stories

### US-001: Expand list preset colors to 18 (React)

**Description:** As a user, I want the same range of color options for lists as I have for stores so I can better differentiate my lists.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] Update `LIST_PRESET_COLORS` in `ListSelector.jsx` to match the 18-color `PRESET_COLORS` array from `StoreManager.jsx`
- [ ] Colors: `#1565c0`, `#6a1b9a`, `#00838f`, `#2e7d32`, `#ef6c00`, `#c62828`, `#4527a0`, `#00695c`, `#ad1457`, `#37474f`, `#f9a825`, `#4e342e`, `#1b5e20`, `#283593`, `#bf360c`, `#0277bd`, `#558b2f`, `#7b1fa2`
- [ ] Both create-list and edit-list color pickers show all 18 colors
- [ ] Increase color swatch size from 1.5rem (24px) to 1.75rem (28px) to match store swatches in `ListSelector.module.css`
- [ ] Existing lists with any of the original 10 colors are unaffected
- [ ] Verify in browser
- [ ] Works in both light and dark mode
- [ ] Lint passes

---

### US-002: Expand list preset colors to 18 and add custom color picker (Swift iOS)

**Description:** As an iOS user, I want the same color options for lists as stores, including the ability to pick a custom color.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] Update `presetColors` in `CreateListSheet.swift` and `EditListSheet.swift` to match the 18-color array from `CreateStoreSheet.swift`
- [ ] Change color swatch layout from horizontal `ScrollView` with 32pt circles to `LazyVGrid` with 36pt circles (matching stores)
- [ ] Add native `ColorPicker("Custom Color", selection:)` below the preset grid (matching `CreateStoreSheet.swift` and `EditStoreSheet.swift` implementation)
- [ ] When a custom color is selected, deselect any preset; when a preset is selected, reset custom color
- [ ] `EditListSheet` correctly detects whether the list's current color is a preset or custom and sets initial state accordingly
- [ ] Xcode project builds successfully

---

### US-003: Replace list row vertical bar with color circle (React)

**Description:** As a user, I want list rows to show a clean color circle next to the name (like stores) instead of the current vertical left border.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] Remove the `getRowTintStyle()` function from `ListSelector.jsx` (the inline `borderLeft` style)
- [ ] Remove `border-left: 4px solid transparent` from `.listItem` in `ListSelector.module.css`
- [ ] Add a 12px color circle element (`.listDot`) to each list row, positioned to the left of the emoji/name — matching `.storeDot` from `StoreManager.module.css`
- [ ] Circle uses the list's color; if no color, use the default `#1565c0`
- [ ] Row layout: `[12px color circle] [emoji (if set)] [name + item count] [menu]`
- [ ] The circle should not interfere with drag-to-reorder if present
- [ ] Verify in browser
- [ ] Works in both light and dark mode
- [ ] Lint passes

---

### US-004: Replace list row vertical bar with color circle (Swift iOS)

**Description:** As an iOS user, I want list rows to show a color circle (like stores) instead of the vertical bar.

**Documentation:** No
**Tools:** No
**Considerations:** none
**Credentials:** none

**Acceptance Criteria:**

- [ ] In `ListRowView.swift`, replace the `Rectangle().fill(...).frame(width: 4)` with `Circle().fill(...).frame(width: 12, height: 12)` matching `StoreBrowserView.swift`'s store row
- [ ] Circle is positioned to the left of the emoji/list icon with proper spacing (12pt, matching stores)
- [ ] Remove the zero leading inset (`listRowInsets`) from `ListBrowserView.swift` that was needed for the flush-left vertical bar — use standard insets now that a circle is used
- [ ] Row layout: `[12pt color circle] [emoji or list icon] [name] [spacer] [shared badge?] [item count]`
- [ ] Xcode project builds successfully

## Functional Requirements

- FR-1: List preset colors expanded from 10 to 18, matching the store color palette exactly
- FR-2: Color swatch sizes in list create/edit forms match store swatch sizes (28px web, 36pt iOS grid)
- FR-3: iOS list create/edit forms include a native `ColorPicker` for custom colors (matching stores)
- FR-4: List rows display a 12px/12pt color circle to the left of the name instead of a 4px vertical left border
- FR-5: Existing lists retain their current colors with no data migration needed
- FR-6: Both React web and Swift iOS platforms updated

## Non-Goals (Out of Scope)

- No custom color picker on web (stores don't have one on web either)
- No changes to store UI (stores are already the reference pattern)
- No changes to list color database schema (the `color` column already stores hex strings, so custom colors work automatically)
- No changes to how colors are used elsewhere (list detail view headers, etc. — only the list browser row and create/edit forms)

## Design Considerations

- The color circle should be the same 12px/12pt size as store dots — small and subtle
- On lists that have both a color circle and an emoji, the circle comes first, then the emoji, then the name
- The transition from vertical bar to circle should make list rows feel cleaner and more consistent with the rest of the app

## Technical Considerations

- **Framework:** React (Vite) + Native Swift iOS
- **No database changes needed** — the `lists.color` column already stores hex strings, so custom colors from the iOS `ColorPicker` will save and load correctly
- The `getRowTintStyle()` function in `ListSelector.jsx` can be fully removed
- The `.listItem` CSS class needs `border-left` removed and a `.listDot` element added
- On iOS, `ListRowView.swift` is the single component to modify for the row display
- The zero `listRowInsets` in `ListBrowserView.swift` was specifically for the flush-left vertical bar and should be reverted to standard insets

## Success Metrics

- List rows visually match store rows in color display pattern (circle, not bar)
- All 18 colors available in list create/edit on both platforms
- iOS users can pick custom colors for lists
- No visual regression to existing lists

## Credential & Service Access Plan

No external credentials required for this PRD.

## Definition of Done

Implementation is complete when:

1. List rows show a 12px/12pt color circle instead of a 4px vertical bar on both platforms
2. 18 preset colors available in list create/edit forms on both platforms
3. iOS list create/edit forms include a native `ColorPicker` for custom colors
4. Color swatch sizes match store swatch sizes on both platforms
5. Existing lists display correctly with their current colors
6. Lint passes, Xcode builds, and app runs without errors

## Open Questions

None — this is a straightforward UI alignment to match the existing store pattern.
