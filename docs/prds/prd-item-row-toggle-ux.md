# PRD: Item Row Toggle UX — Remove Checkbox & Delayed Move

## Introduction

Two related changes to the shopping/list item row on both web and iOS:

1. **Remove the leading circle checkbox** to reclaim horizontal space. The double-tap-on-row gesture already exists and becomes the sole toggle interaction.
2. **Delay moving the item between the unchecked/checked sections** after a toggle. The strikethrough appears immediately, but the row stays in place for 1.5 seconds before relocating. This gives the user a chance to undo a misclick without hunting through the checked list.

Applies to all list types that use the check/uncheck pattern (Grocery, Basic, Packing, Project, To-Do). Guest Lists are unaffected — they use RSVP status, not checkboxes.

## User Stories

### US-001: Remove circle checkbox from web item row

**Description:** As a user on the web app, I want a cleaner item row with more room for the item name and badges, so the list feels less cluttered.

**Acceptance Criteria:**
- [ ] The leading circle checkbox button is removed from `ShoppingItem.jsx` for all non-RSVP list types
- [ ] Row content shifts left to fill the vacated space (no leading indent placeholder)
- [ ] Double-tap on the row body still toggles the checked state (existing behavior preserved)
- [ ] Thumbnail (when present) and item name layout remain visually balanced after the shift
- [ ] Guest List rows (RSVP) are unchanged
- [ ] Swipe-to-delete gesture continues to work on the row
- [ ] Edit pencil button remains in its current position
- [ ] CSS module updates remove now-unused checkbox styles

### US-002: Delayed move with cancel on web

**Description:** As a user, when I double-tap an item to cross it off, I want it to visually strike through immediately but stay in place briefly so I can undo if I tapped the wrong row.

**Acceptance Criteria:**
- [ ] On double-tap, the row's `isChecked` UI state flips immediately (strikethrough applied, color shifted to "checked" treatment)
- [ ] No extra visual signal beyond the standard strikethrough (no progress bar, no fade, no undo button)
- [ ] The row stays in its current section for **1500ms** before moving to the opposite section
- [ ] If the user double-taps the same row again before the timer fires, the timer is cancelled and the item reverts to its prior state — no DB write occurs
- [ ] Each item has an independent timer; toggling a second item does not affect the first item's pending move
- [ ] The Supabase write (and therefore realtime broadcast) happens **at the end of the delay**, not at the moment of tap
- [ ] Other devices viewing the same list see the item move once — they do not see the intermediate strikethrough state
- [ ] Behavior mirrors in both directions: un-checking an item in the checked section also waits 1500ms before moving back up
- [ ] If the component unmounts (user navigates away) while a timer is pending, the timer fires and the DB write completes
- [ ] If the user toggles, cancels, and toggles again, only the final state is committed

### US-003: Remove circle checkbox from iOS item row

**Description:** As an iOS user, I want the same cleaner row treatment as the web app for visual and behavioral parity.

**Acceptance Criteria:**
- [ ] The leading checkbox `Button` (lines ~628–642 of `ListDetailView.swift` `itemRow`) is removed for non-RSVP list types
- [ ] Row HStack content shifts left to fill the space (no leading spacer placeholder)
- [ ] Double-tap on the row body still toggles via `detailViewModel.toggleItem(item)` (existing behavior preserved)
- [ ] Thumbnail (when present) takes the leading position
- [ ] Guest List rows (`typeConfig.fields.rsvpStatus == true`) are unchanged
- [ ] Swipe-to-delete continues to work
- [ ] Context menu actions (edit, image, etc.) are unaffected
- [ ] Visual spacing and vertical alignment match the post-checkbox-removal web design

### US-004: Delayed move with cancel on iOS

**Description:** As an iOS user, when I double-tap an item to cross it off, I want the strikethrough immediately but a brief delay before the row jumps to the checked section.

**Acceptance Criteria:**
- [ ] On double-tap, the row's checked appearance (strikethrough, secondary foreground) is applied immediately via local view-model state
- [ ] The row stays in its current section for **1500ms** before the actual `toggleItem` call commits to Supabase
- [ ] If the user double-taps the same row again before the timer fires, the pending toggle is cancelled and the row reverts — no Supabase write
- [ ] Each item has an independent timer; concurrent pending toggles on different items do not interfere
- [ ] The Supabase update (and realtime broadcast) happens at the end of the delay
- [ ] Other devices see only the final state, not the intermediate strikethrough
- [ ] Mirrors in both directions: un-checking also waits 1500ms before moving up
- [ ] If the user backgrounds the app or navigates away mid-delay, the pending write still completes
- [ ] Pending-toggle state is held in `ListDetailViewModel` (or equivalent) so it survives view re-renders without losing the timer
- [ ] Sort pipeline reorders the destination section correctly when the item arrives (existing behavior)

## Credential & Service Access Plan

No external credentials required for this PRD. All changes are client-side UI behavior plus the existing Supabase write on `items` table.

## Technical Considerations

- **Pending state location.** On web, hold the pending toggle in component or context state — not local-only to `ShoppingItem.jsx`, since the row may unmount when re-rendered into a different section. Consider a `pendingToggles` map in `ShoppingListContext` or the parent list component, keyed by `item.id`, with the timer ID and the desired final `isChecked` value.
- **iOS pending state.** Similar — store pending toggles in `ListDetailViewModel` as a `[UUID: Task<Void, Never>]` (or equivalent) keyed by item ID, so the timer survives `itemRow` re-renders and can be cancelled by ID.
- **Realtime collision.** If a pending toggle is in flight locally and a realtime update arrives for the same item from another device, the realtime update should win — cancel the local pending timer and adopt the remote state.
- **Sort pipeline interaction.** Items already sort within their section via the configured pipeline (`sortedUncheckedSection`, `checkedPipelineResult`). The delayed-move only changes *when* the section transition happens, not how the item lands inside the destination section.
- **Animation.** Existing section-move animations should remain. The strikethrough application can be instant (no animation) — the user's mental model is "I crossed it off."
- **Test coverage.** Both platforms have integration tests around toggling. Update them to account for the 1500ms delay (and add a test for the cancel case and the independent-timer case).
- **Capacitor app retirement.** Per `prd-swift-final-polish`, the Capacitor iOS shell is gone — iOS changes apply only to `ios-native/`.

## Definition of Done

- All 4 stories complete with acceptance criteria checked off
- Web: `ShoppingItem.jsx` and `ShoppingItem.module.css` updated; checkbox markup and styles removed; `ShoppingList.jsx` (or context) holds pending-toggle state with cancellable 1500ms timers per item
- iOS: `ListDetailView.swift` `itemRow` updated; checkbox `Button` removed for non-RSVP types; `ListDetailViewModel` holds per-item pending-toggle tasks with cancellation
- Double-tap toggle works on both platforms with immediate strikethrough and delayed section move
- Double-tap during the 1.5s window cancels the move on both platforms with no Supabase write
- Independent per-item timers verified — toggling two items in quick succession does not collapse them into a single timer
- Other devices viewing the same list do not see the intermediate strikethrough state — only the final move after the 1.5s delay completes
- Both directions (check → checked section, uncheck → unchecked section) honor the 1500ms delay
- Guest List (RSVP) rows are visually and behaviorally unchanged
- Swipe-to-delete and edit pencil continue to work on the modified rows
- Manual smoke test: cross off 3 items in rapid succession, cancel the middle one before it moves, verify only the outer two end up in the checked section
- Cross-device test: with two devices on the same list, cross off an item on device A and confirm device B sees a single move (no flicker between states)
- Build passes on both platforms (`npm run build`, Xcode build for `ios-native`)

## Flag Review

| Story | Support Article? | Tools? | Reasoning |
|-------|------------------|--------|-----------|
| US-001: Remove web checkbox | ⚠️ Maybe | ❌ No | Visible UI change — may warrant a brief "what changed" note for users who relied on the checkbox tap target |
| US-002: Web delayed move | ⚠️ Maybe | ❌ No | New interaction behavior — users may notice the delay and wonder why it's not instant |
| US-003: Remove iOS checkbox | ⚠️ Maybe | ❌ No | Same as US-001 |
| US-004: iOS delayed move | ⚠️ Maybe | ❌ No | Same as US-002 |

Please confirm or adjust the ⚠️ values. My recommendation: **one combined support note** covering both changes (rather than four separate articles), since they're a single visible UX shift to the user.
