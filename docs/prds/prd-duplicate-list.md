# PRD: Duplicate List

## Introduction

Add the ability to duplicate a list from both the long-press context menu in the list browser and the 3-dot ellipsis menu inside a list. Duplicating creates a full copy of the list — name, emoji, color, type, categories, items (reset to unchecked), and recipe associations — owned by the current user with no shares. A naming dialog lets the user customize the name before confirming, defaulting to `[name] (2)`.

## Goals

- Let users quickly create a copy of any list they own
- Copy all list metadata (emoji, color, type, categories, sort preferences)
- Copy all items reset to unchecked state
- Preserve recipe associations on items
- Present a naming dialog defaulting to `[name] (2)`
- Duplicate is private (no shares copied)

## User Stories

### US-001: Duplicate List Service Layer

**Description:** As a developer, I need a service function that duplicates a list and all its items so the feature can be wired into multiple UI surfaces.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `ListService.duplicateList(listId:, newName:)` creates a new list copying name, emoji, color, type, sort_preferences, and custom categories
- [ ] All items from the source list are copied to the new list with `is_checked` reset to `false`
- [ ] Item fields copied: name, quantity, unit, price, category, store_id, image_url, recipe_id, recipe_name, sort_order
- [ ] The new list is owned by the current user with no shares
- [ ] Duplicate works for both owned and shared lists (user can duplicate a list shared with them)
- [ ] Build succeeds

### US-002: Duplicate Option in List Browser Context Menu

**Description:** As a user, I want to long-press a list in the browser and choose "Duplicate" so I can quickly copy a list without opening it.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] "Duplicate" option appears in the long-press context menu on ListBrowserView for both owned and shared lists
- [ ] Uses `doc.on.clipboard` system image icon
- [ ] Tapping "Duplicate" shows an alert with a text field for the new name, defaulting to `[list name] (2)`
- [ ] Confirming creates the duplicate and it appears in the list browser
- [ ] Cancelling dismisses with no action
- [ ] Build succeeds

### US-003: Duplicate Option in List Detail 3-Dot Menu

**Description:** As a user, I want to duplicate a list from the 3-dot menu while viewing it so I don't have to go back to the browser.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] "Duplicate" option appears in the ellipsis menu on ListDetailView
- [ ] Positioned after "Share Settings" and before the Divider/Delete section
- [ ] Uses `doc.on.clipboard` system image icon
- [ ] Tapping shows the same naming alert as US-002
- [ ] After duplication, user stays on the current list (not navigated to the copy)
- [ ] Build succeeds

### US-004: ViewModel Integration

**Description:** As a developer, I need the ListViewModel to expose a `duplicateList` method and refresh the list browser after duplication.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `ListViewModel.duplicateList(listId:, newName:)` calls the service and refreshes the owned lists
- [ ] New list appears in the list browser immediately after duplication
- [ ] Error is handled gracefully (e.g. toast or alert if duplication fails)
- [ ] Build succeeds

## Functional Requirements

- FR-1: Duplicate creates a new list with all metadata (name, emoji, color, type, sort_preferences, custom categories)
- FR-2: All items are copied with `is_checked` set to `false`
- FR-3: Recipe associations (`recipe_id`, `recipe_name`) are preserved on copied items
- FR-4: The duplicate is always owned by the current user with no shares
- FR-5: A naming dialog appears with a text input defaulting to `[original name] (2)`
- FR-6: The duplicate option is available in both the ListBrowserView context menu and the ListDetailView ellipsis menu
- FR-7: Users can duplicate both owned and shared lists

## Non-Goals

- No batch duplication (multiple lists at once)
- No duplication of share permissions
- No cross-user duplication (duplicating someone else's list into their account)
- No duplication of recurring item schedules

> **Doc correction (post-hoc, 2026-04-21):** This PRD originally listed "No React web implementation (iOS only per scope)" as a non-goal. That was incorrect — the feature shipped on **both** React web and Swift iOS. The web and iOS implementations diverged slightly: iOS preserves `rsvp_status` on duplicated items; web omits `rsvp_status` from the insert (so it falls back to the column default). This parity gap is tracked and fixed in `prd-reset-list-items` US-006.

## Technical Considerations

- **Platforms:** React web (`src/`) **and** Swift iOS (`ios-native/`)
- **Service (iOS):** `ListService.duplicateList` static method
- **Service (web):** `duplicateList` in `src/services/database.js`, wired via `ShoppingListContext`
- **Database:** Uses existing Supabase `lists` and `items` tables — no migration needed
- **Approach:** Create list via existing create path, then bulk-insert copied items
- **Categories:** Copy `custom_categories` / `categories` JSONB field from source list
- **Sort preferences:** Copy `sort_preferences` / `sort_config` JSONB field from source list
- **Known divergence:** Web insert does not copy `rsvp_status` (and possibly `recipe_id` / `recipe_name`); iOS does copy `rsvp_status`. Resolved in `prd-reset-list-items` US-006.

## Success Metrics

- User can duplicate a list in under 3 taps
- All items and metadata are faithfully copied
- No data loss or corruption on source list

## Credential & Service Access Plan

No external credentials required for this PRD.

## Definition of Done

- All 4 user stories pass their acceptance criteria
- Duplicate is accessible from both the context menu and 3-dot menu
- Duplicated list appears in the browser with correct metadata, items (unchecked), and recipe links
- Source list is unmodified after duplication
- Build succeeds on simulator

## Open Questions

None — scope is fully defined.
