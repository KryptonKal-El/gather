# PRD: Native Emoji Picker

## Introduction

Replace the current `emoji-mart` third-party emoji picker with a native OS emoji input on mobile and a simplified custom picker on desktop. The current picker renders as an absolutely-positioned dropdown that gets clipped by parent `overflow: hidden` containers (the same class of bug as the three-dot menu). On mobile, the OS emoji keyboard is the most natural and familiar way to pick an emoji — it's what users already use in every other app. On desktop, a lightweight custom picker avoids the discoverability problem of system emoji pickers (Ctrl+Cmd+Space on Mac, Win+Period on Windows).

This also removes two npm dependencies (`emoji-mart` and `@emoji-mart/data`), reducing bundle size.

## Goals

- On mobile, tapping the emoji button opens a text input that triggers the OS emoji keyboard
- On desktop, tapping the emoji button opens a simplified lightweight custom emoji picker (no third-party library)
- Remove the `emoji-mart` and `@emoji-mart/data` npm dependencies
- Eliminate overflow clipping issues with the emoji picker
- Once an emoji is selected, it replaces the current value (no "remove icon" option — emoji can be changed but not cleared)
- Maintain the existing API: `<EmojiPicker value={emoji} onSelect={setEmoji} />`

## User Stories

### US-001: Native Emoji Input on Mobile

**Description:** As a mobile user, I want tapping the emoji button to open the OS emoji keyboard so I can pick an emoji the way I do in every other app.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Tapping the emoji trigger button on mobile (≤700px) shows a text input field
- [ ] The text input automatically receives focus, causing the OS keyboard to appear
- [ ] The input has `inputMode="text"` or equivalent to encourage the emoji keyboard tab
- [ ] When the user selects an emoji from the OS keyboard, it is captured and passed to `onSelect`
- [ ] The text input closes after an emoji is selected (auto-dismiss)
- [ ] If the user dismisses the keyboard without selecting, the input closes gracefully
- [ ] Only a single emoji character is accepted (prevent typing multiple characters or text)
- [ ] The trigger button displays the currently selected emoji (or default 😀 if none)
- [ ] No "Remove icon" option — emoji can only be changed, not cleared
- [ ] Works in the "create new list" form and the "edit list name & icon" form
- [ ] Lint passes
- [ ] Verify in browser
- [ ] Works in both light and dark mode

### US-002: Simplified Custom Emoji Picker on Desktop

**Description:** As a desktop user, I want a lightweight emoji picker that opens when I click the emoji button, since the system emoji picker is not easily discoverable on desktop.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Clicking the emoji trigger button on desktop (≥701px) opens a custom emoji picker dropdown
- [ ] The picker is lightweight — built with plain React and CSS, no third-party emoji library
- [ ] The picker shows a curated grid of common emojis organized by category (e.g., food, animals, objects, faces, activities, travel, symbols)
- [ ] Categories are switchable via simple tab buttons or icons at the top/bottom of the picker
- [ ] The picker includes a basic search/filter input to find emojis by name
- [ ] Clicking an emoji selects it and closes the picker
- [ ] Clicking outside the picker closes it
- [ ] The picker renders via a React portal (`ReactDOM.createPortal`) to avoid overflow clipping from any parent container
- [ ] The picker is positioned relative to the trigger button using `getBoundingClientRect()`
- [ ] No "Remove icon" option — emoji can only be changed, not cleared
- [ ] Works in the "create new list" form and the "edit list name & icon" form
- [ ] Lint passes
- [ ] Verify in browser
- [ ] Works in both light and dark mode

### US-003: Remove emoji-mart Dependencies

**Description:** As a developer, I want to remove the emoji-mart packages so the bundle is smaller and there are fewer dependencies to maintain.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `emoji-mart` is removed from `package.json` dependencies
- [ ] `@emoji-mart/data` is removed from `package.json` dependencies
- [ ] No imports of `emoji-mart` or `@emoji-mart/data` remain in the codebase
- [ ] `npm install` completes without errors after removal
- [ ] `npm run build` succeeds
- [ ] Lint passes

## Functional Requirements

- FR-1: The EmojiPicker component must detect mobile vs desktop using the existing `useIsMobile` hook (or CSS media query) and render the appropriate picker
- FR-2: On mobile, tapping the trigger must open a focused text input that invokes the OS emoji keyboard
- FR-3: On mobile, only a single emoji character must be accepted from the input
- FR-4: On desktop, clicking the trigger must open a custom emoji grid picker
- FR-5: The desktop picker must render via React portal to escape overflow containers
- FR-6: The desktop picker must include categorized emoji grid and search/filter
- FR-7: The EmojiPicker public API (`value`, `onSelect` props) must remain unchanged so ListSelector needs no prop changes
- FR-8: The `emoji-mart` and `@emoji-mart/data` packages must be removed from the project
- FR-9: Once an emoji is picked, it can be changed to a different emoji but cannot be removed/cleared

## Non-Goals

- No "Remove icon" / clear emoji option
- No skin tone selection (use default yellow skin tone)
- No recently-used emoji tracking on the desktop picker
- No animated emoji or sticker support
- No changes to how emojis are stored in Firestore (still a string field)

## Design Considerations

- **Mobile input:** The text input should be visually minimal — it can appear inline next to or below the trigger, or as a small overlay. The key interaction is that the OS keyboard appears with its emoji tab. Consider using a transparent/minimal input that auto-focuses.
- **Desktop picker:** Should feel similar to the iOS/macOS emoji picker — a compact grid with category tabs. Use the existing CSS custom properties for theming. Approximate size: 300-350px wide, 350-400px tall.
- **Emoji data for desktop:** Include a curated set of ~200-300 common emojis as a static JS array (food/grocery items should be well-represented since this is a shopping list app). This avoids the large `@emoji-mart/data` bundle (~2MB) in favor of a small inline array.
- **Portal positioning:** The desktop picker should appear below the trigger button when there's room, or above it if near the bottom of the viewport.

## Technical Considerations

- **`useIsMobile` hook** is already available in the project for mobile detection
- **React portals** (`ReactDOM.createPortal`) are the right approach for the desktop picker to escape overflow contexts — same pattern recommended for the three-dot menu fix (BUG-001)
- **Emoji data:** A static array of emoji objects `[{ emoji: "🍎", name: "apple", category: "food" }, ...]` is sufficient. No need for a full Unicode emoji database.
- **Mobile input gotcha:** Browsers cannot programmatically open the emoji keyboard tab specifically — they can only focus an input which opens the regular keyboard. The user taps the emoji/globe button on their keyboard to switch to emojis. This is standard behavior and what users expect.
- **Single emoji validation:** On mobile input, after any `onChange`, check if the value contains a valid emoji and if so, call `onSelect` and close. Reject multi-character text input.

## Definition of Done

Implementation is complete when:

1. On mobile (≤700px), tapping the emoji trigger opens a text input and the OS keyboard appears
2. Selecting an emoji from the OS keyboard captures it and closes the input
3. On desktop (≥701px), clicking the emoji trigger opens a custom grid picker with categories and search
4. The desktop picker renders via portal and is never clipped by overflow containers
5. The `emoji-mart` and `@emoji-mart/data` packages are removed from `package.json`
6. `npm run build` succeeds with smaller bundle size
7. Both the "create list" and "edit list" emoji selection flows work correctly
8. Works in both light and dark mode
9. Lint passes with no new warnings

## Credential & Service Access Plan

No external credentials required for this PRD.

## Success Metrics

- Mobile emoji selection feels native — same keyboard users use in Messages, WhatsApp, etc.
- Desktop picker loads instantly (no large emoji data bundle to parse)
- Bundle size reduced by removing ~2MB of emoji-mart data
- Zero overflow clipping issues with the picker

## Open Questions

- Should the desktop picker prioritize grocery/food emojis at the top since this is a shopping list app?
- Should we include a "frequently used" row on the desktop picker in a future iteration?
