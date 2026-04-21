# PRD: Reset List Items

## Introduction

Add the ability to reset items on a list back to a default state. The primary use case is **Guest List** type: after duplicating a guest list (e.g. for a recurring event), the user wants to reset all guest entries' RSVP status back to "Not Yet Invited" (`not_invited`) without manually editing each one.

This PRD focuses exclusively on Guest List type for v1. Other list types (Grocery, Packing, To-Do, etc.) are explicitly out of scope and may be addressed in a future PRD if needed.

## Scope

**In scope:**
- New "Reset items" action in the list 3-dot menu (web + iOS), only visible for Guest List type
- Resets every item's `rsvp_status` to `not_invited`
- Confirmation dialog before applying
- Undo support via existing shake-to-undo (iOS) and undo stack (web)
- Realtime sync to other devices/collaborators
- Integration with `prd-duplicate-list` (in progress): duplicate dialog gains a "Reset RSVP statuses" toggle, defaulted ON for Guest List duplicates

**Out of scope:**
- Reset for non-Guest list types
- Bulk reset across multiple lists
- Scheduled / recurring auto-reset
- Per-item status reset (single-item edit already exists)

## User Stories

### US-001: "Reset items" action in 3-dot menu (Guest List only)

**Description:** As a Guest List owner, I want a "Reset items" option in the list's 3-dot menu so I can clear all RSVP statuses at once.

**Acceptance Criteria:**
- [ ] List 3-dot menu shows "Reset items" entry **only when** `list.type === 'guest_list'` **AND** current user is the list owner
- [ ] Hidden for all other list types
- [ ] Hidden for shared collaborators (non-owners) even if they have edit rights
- [ ] Available on both desktop web and mobile web menus
- [ ] Available on Swift iOS context menu and 3-dot menu
- [ ] Disabled (or shows "No items to reset" toast) when the list is empty

### US-002: Confirmation dialog before reset

**Description:** As a user, I want to confirm before resetting so I don't lose RSVP progress accidentally.

**Acceptance Criteria:**
- [ ] Tapping "Reset items" opens a confirmation dialog
- [ ] Dialog text: "Reset all {N} guests to Not Yet Invited? This will clear their current RSVP status."
- [ ] Buttons: "Cancel" (secondary) and "Reset" (destructive style — red on web, `.destructive` role on iOS)
- [ ] If list has zero items needing reset (all already `not_invited`), show toast "All guests are already at Not Yet Invited" and skip the dialog
- [ ] Tapping outside the dialog cancels (web)
- [ ] Cancel preserves all current statuses; no DB write

### US-003: Reset operation persists to Supabase

**Description:** As a developer, I need a single batched update so the reset is atomic and fast.

**Acceptance Criteria:**
- [ ] React: `resetGuestListRsvp(listId)` in `services/database.js` — single `UPDATE items SET rsvp_status = 'not_invited' WHERE list_id = $1`
- [ ] Swift: equivalent `ItemService.resetRsvpStatuses(listId:)`
- [ ] One DB round-trip regardless of item count
- [ ] Updates `updated_at` on each affected row (so realtime fires on collaborators)
- [ ] Operation is idempotent (re-running has no further effect)
- [ ] RLS allows only list owner to perform the reset
- [ ] Returns count of items reset

### US-004: Realtime sync to collaborators

**Description:** As a collaborator on a shared guest list, I want to see the reset reflected immediately on my device.

**Acceptance Criteria:**
- [ ] Existing realtime channel on `items` table propagates the bulk update
- [ ] React `ShoppingListContext` reflects new `rsvpStatus: 'not_invited'` on all items without page reload
- [ ] Swift `ListDetailViewModel` items array updates without manual refresh
- [ ] RSVP summary counters at the top of the list update live
- [ ] No duplicate channel subscriptions fire

### US-005: Undo support after reset

**Description:** As a user, I want to undo a reset I didn't mean to perform.

**Acceptance Criteria:**
- [ ] Web: reset action pushes a single entry onto the undo stack (`useUndoStack`) capturing previous `rsvp_status` for each item
- [ ] Web: undoing replays the previous statuses via batched UPDATE
- [ ] iOS: reset registers with `UndoManager` so shake-to-undo restores prior statuses
- [ ] Undo entry expires per existing undo stack policy
- [ ] Toast "Reset 12 guests" with "Undo" button (web) appears for 5 seconds
- [ ] Undo gesture works offline if user has not yet synced (best-effort)

### US-006: Integration with Duplicate List flow (web + iOS)

**Description:** As a user duplicating a Guest List, I want a one-click way to also reset RSVP statuses in the new copy, with consistent behavior across web and iOS.

**Context:** `prd-duplicate-list` shipped on **both** web and iOS despite its doc claiming iOS-only. The two platforms currently behave differently when duplicating a Guest List:
- **iOS** (`ios-native/.../ListService.swift`) preserves `rsvp_status` on copied items
- **Web** (`src/services/database.js` `duplicateList`) omits `rsvp_status` from the insert, so copied items fall back to the column default (effectively dropping the status)

US-006 fixes this parity gap first, then layers an opt-in reset toggle on both platforms.

**Acceptance Criteria:**

*Parity fix (web):*
- [ ] Web `duplicateList` in `src/services/database.js` is updated to copy `rsvp_status` from source items by default (match iOS behavior)
- [ ] `recipe_id` and `recipe_name` are also copied if present on source items (audit for other missing fields vs iOS while fixing this)

*Opt-in reset toggle (both platforms):*
- [ ] Duplicate dialog/sheet includes a **"Reset RSVP statuses"** toggle on both web and iOS
- [ ] Toggle is **only visible** when source list is a Guest List (`list.type === "guest_list"` / `list.type == "guest_list"`)
- [ ] Defaulted to **ON** for Guest List duplicates
- [ ] When ON: the duplicate insert writes `rsvp_status = 'not_invited'` on all copied items in the initial insert (no insert-then-update)
- [ ] When OFF: copied items preserve the source `rsvp_status` (post-parity-fix behavior)
- [ ] Setting is per-duplicate (not persisted across invocations)
- [ ] Non-Guest duplicates are unaffected on both platforms — toggle hidden, behavior unchanged
- [ ] Web and iOS share identical toggle semantics, default, and copy text

### US-007: Empty state and edge cases

**Description:** As a user, I want sensible behavior when reset is run in unusual states.

**Acceptance Criteria:**
- [ ] Empty list: "Reset items" is hidden or disabled with explanatory tooltip/label
- [ ] All items already `not_invited`: skip dialog, show toast "Already reset"
- [ ] Reset during in-flight item add: new items get default `'invited'` status (existing behavior preserved); reset only affects items present at the moment of the action
- [ ] Network failure mid-reset: show error toast "Couldn't reset — try again"; no partial writes (transaction or fail-fast)
- [ ] If user changes the list type away from Guest List, the menu entry disappears next render

## Credential & Service Access Plan

No external credentials required for this PRD. All work uses existing Supabase access already provisioned.

## Technical Considerations

**Database:**
- Single SQL statement: `UPDATE items SET rsvp_status = 'not_invited', updated_at = NOW() WHERE list_id = $1`
- No schema changes
- Existing RLS on `items` already restricts list-owner access

**React (`src/`):**
- Add `resetGuestListRsvp(listId)` to `services/database.js`
- Surface action via `ShoppingListContext` reducer/actions
- Add menu entry in list 3-dot menu component (verify component name during implementation — likely `ListSelector.jsx` or list row)
- Hook into existing undo stack
- Toast via existing toast system

**Swift (`ios-native/`):**
- Add `resetRsvpStatuses(listId:)` to `ItemService`
- Add action to `ListDetailViewModel`
- Wire into `ListDetailView` 3-dot menu / context menu (visible only when `typeConfig.fields.rsvpStatus == true`)
- Use SwiftUI `.alert` for confirmation
- Register with `UndoManager` for shake-to-undo (pattern established in `prd-swipe-delete-shake-undo`)

**Realtime:**
- No new channels — existing `items` table subscription handles bulk update propagation
- Verify Supabase emits a row-level change event for each updated row in a bulk UPDATE (it does, via WAL)

**Coordination with prd-duplicate-list:**
- `prd-duplicate-list` was marked iOS-only in its doc but actually shipped on **both** web and iOS. The doc has been corrected separately.
- Web and iOS duplicate flows diverged: iOS preserves `rsvp_status`; web drops it. US-006 fixes this parity gap before layering the opt-in reset toggle.
- US-006 is cross-platform work (web + iOS), not iOS-only.

## Open Questions for You

None — scope fully defined.

## Definition of Done

- [ ] All 7 user stories meet their acceptance criteria on web (Chrome desktop + iOS Safari) and Swift iOS (iPhone simulator + physical device if available)
- [ ] "Reset items" appears only for Guest List type on both platforms
- [ ] Confirmation dialog renders correctly in light + dark mode on both platforms
- [ ] Bulk reset completes in <500ms for lists up to 100 items
- [ ] Realtime sync verified between two devices (or two browser sessions) within 2 seconds
- [ ] Undo restores prior RSVP statuses correctly on both platforms
- [ ] Duplicate List dialog shows the reset toggle only for Guest List sources, defaults ON
- [ ] No regressions to existing RSVP editing flows (single-item context menu, edit sheet)
- [ ] No regressions to other list types — "Reset items" is invisible for them
- [ ] RLS prevents non-owners from triggering reset (verified with shared list collaborator account)
- [ ] PRD-level Playwright verification per `testVerifySettings.prdUIVerify_PRDCompletionTest`

## Flag Review

| Story | Support Article? | Tools? | Reasoning |
|-------|------------------|--------|-----------|
| US-001: 3-dot menu entry | ⚠️ ? | ❌ No | User-facing; depends on whether you maintain support docs for Guest List features |
| US-002: Confirmation dialog | ❌ No | ❌ No | UI detail of US-001, not a standalone documented flow |
| US-003: DB operation | ❌ No | ❌ No | Backend-only |
| US-004: Realtime sync | ❌ No | ❌ No | Backend behavior |
| US-005: Undo support | ❌ No | ❌ No | UX nicety, covered by existing undo docs if any |
| US-006: Duplicate integration | ⚠️ ? | ❌ No | User-facing; pairs with whatever support coverage `prd-duplicate-list` gets |
| US-007: Edge cases | ❌ No | ❌ No | QA / robustness |

⚠️ marks: Gather doesn't appear to have a `supportDocs` configuration in `project.json`, so I've defaulted these to "depends on you." Confirm whether you want support coverage or skip it.

