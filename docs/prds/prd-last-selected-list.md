# PRD: Remember Last Selected List

## Introduction

When users open Gather Lists, the app always defaults to selecting the first list (oldest by `created_at`). This forces users to manually navigate to their most-used list every time they launch the app, adding unnecessary friction — especially for users who primarily work with one or two lists.

This feature persists the user's last-selected list to Supabase (with a local cache for instant startup) and restores it on launch across both the React web app and native Swift iOS app. Because the preference syncs via Supabase, switching lists on one device updates all devices.

## Goals

- Restore the user's last-selected list on app launch instead of defaulting to the first list
- Provide instant startup by reading from local cache before the Supabase round-trip completes
- Sync the last-selected list across devices via Supabase `user_preferences`
- Gracefully handle edge cases: deleted lists, unshared lists, no lists at all
- Require zero user configuration — this should "just work"

## Scope Considerations

- planning.considerations: none configured — no permissions, support docs, AI tools, or compliance considerations apply

## User Stories

### US-001: Add `last_list_id` Column to `user_preferences`

**Description:** As a developer, I need to store the user's last-selected list ID in the database so it persists across sessions and devices.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] New Supabase migration adds `last_list_id uuid REFERENCES lists(id) ON DELETE SET NULL` to `user_preferences`
- [ ] Column is nullable (null = no preference yet, fall back to first list)
- [ ] `ON DELETE SET NULL` ensures deleted lists don't leave dangling references
- [ ] Existing RLS policies on `user_preferences` (own-user SELECT/INSERT/UPDATE) cover the new column without changes
- [ ] Migration runs successfully against the current schema
- [ ] Lint passes

### US-002: React — Persist Last-Selected List to Supabase

**Description:** As a user on the web app, I want my list selection saved automatically so I don't have to re-navigate every time I open the app.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `preferences.js` gets a new `updateLastListId(listId)` function using the existing upsert pattern from `updateDefaultSortConfig`
- [ ] `ShoppingListContext` calls `updateLastListId` whenever `activeListId` changes (debounced — at least 500ms — to avoid rapid writes during list switching)
- [ ] Writes happen in the background — no loading states, no blocking, no error toasts for save failures
- [ ] The existing `getUserPreferences()` return value includes `last_list_id`
- [ ] Lint passes

### US-003: React — Restore Last-Selected List on Startup

**Description:** As a user reopening the web app, I want to land on the same list I was viewing last time, instantly.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] On startup, `ShoppingListContext` reads `last_list_id` from localStorage first (instant, no network wait)
- [ ] localStorage key: `gather_last_list_id`
- [ ] If the cached list ID exists in the fetched lists array, select it as `activeListId`
- [ ] If the cached list ID does NOT exist in the fetched lists (deleted/unshared), land on the list browser with no list selected (show the list selection view, not an empty list detail)
- [ ] After Supabase preferences load, update localStorage with the server value (server wins)
- [ ] If no `last_list_id` in either cache or Supabase, fall back to current behavior (first list)
- [ ] The `hasAutoSelected` ref logic is updated to account for this new restoration path
- [ ] Verify in browser
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-004: React — Handle Invalid Last-Selected List

**Description:** As a user whose remembered list was deleted or unshared, I want to see the list browser so I can pick a new list instead of seeing a broken state.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] When `last_list_id` refers to a list not in the user's current lists array, set `activeListId` to `null`
- [ ] On mobile: show the list browser panel (the sidebar/list selector view)
- [ ] On desktop: show the list selector sidebar with no list detail view loaded (or an empty-state prompt like "Select a list")
- [ ] Clear the invalid `last_list_id` from localStorage
- [ ] Clear the invalid `last_list_id` from Supabase (set to null) so other devices also reset
- [ ] No error toast or modal — this is a silent, graceful fallback
- [ ] Verify in browser (test by deleting a list, then reloading)
- [ ] Lint passes

### US-005: React — Sync Last-Selected List via Realtime

**Description:** As a user with multiple devices, I want my last-selected list to stay in sync so that opening the app on any device shows the same list.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Subscribe to `user_preferences` realtime changes (follow the pattern in `useSortPreferences.js` lines 47-78)
- [ ] When a realtime update arrives with a new `last_list_id`, update localStorage cache
- [ ] Do NOT auto-switch the active list if the user is currently viewing a different list (realtime updates apply on next app launch, not mid-session)
- [ ] Lint passes

### US-006: iOS — Persist Last-Selected List to Supabase

**Description:** As a user on the iOS app, I want my list selection saved automatically so it syncs with my other devices.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `PreferenceService` gets a `updateLastListId(_ listId: UUID?)` method using the existing upsert pattern
- [ ] `ListViewModel` calls `updateLastListId` whenever `activeListId` changes (debounced — at least 500ms)
- [ ] Writes happen in the background — no UI blocking, no error alerts for save failures
- [ ] The existing `UserPreferences` model includes `lastListId: UUID?`
- [ ] Build succeeds

### US-007: iOS — Restore Last-Selected List on Launch & Auto-Navigate

**Description:** As a user opening the iOS app, I want to be taken directly into my last-viewed list instead of always landing on the list browser.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] On launch, read `last_list_id` from UserDefaults first (key: `"last-list-id"`, instant)
- [ ] If cached list ID exists in fetched lists, auto-navigate into that list's detail view (push onto NavigationStack path)
- [ ] After Supabase preferences load, update UserDefaults with the server value
- [ ] If no `last_list_id` in either cache or Supabase, fall back to current behavior (list browser, first list highlighted)
- [ ] Auto-navigation uses programmatic NavigationStack path manipulation, not manual view switching
- [ ] User can swipe back to list browser normally
- [ ] Build succeeds

### US-008: iOS — Handle Invalid Last-Selected List

**Description:** As a user whose remembered list was deleted or unshared, I want to see the list browser so I can pick a new list.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] When `last_list_id` refers to a list not in the user's current lists array, remain on the list browser (do not navigate)
- [ ] Clear the invalid `last_list_id` from UserDefaults
- [ ] Clear the invalid `last_list_id` from Supabase (set to null)
- [ ] No error alert — silent, graceful fallback
- [ ] Build succeeds

### US-009: iOS — Sync Last-Selected List via Realtime

**Description:** As a user with multiple devices, I want the iOS app to pick up list selection changes from other devices.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `PreferenceService` subscribes to `user_preferences` realtime changes (follow existing realtime pattern in the app)
- [ ] When a realtime update arrives with a new `last_list_id`, update UserDefaults cache
- [ ] Do NOT auto-navigate or switch lists mid-session — the update applies on next app launch
- [ ] Build succeeds

## Functional Requirements

- FR-1: Add `last_list_id uuid REFERENCES lists(id) ON DELETE SET NULL` column to `user_preferences` table
- FR-2: On both platforms, persist `activeListId` to Supabase whenever it changes (debounced ≥500ms)
- FR-3: On app launch, read last list from local cache (localStorage / UserDefaults) for instant restoration
- FR-4: After Supabase preferences load, reconcile: server value wins and updates local cache
- FR-5: If the remembered list is not in the user's current lists, land on the list browser with no list selected and clear the stale preference from both local cache and Supabase
- FR-6: On React web, restore means setting `activeListId` in context; on iOS, restore means auto-navigating into the list detail view via NavigationStack
- FR-7: Subscribe to `user_preferences` realtime to keep local cache updated — but do NOT switch lists mid-session; changes apply on next launch
- FR-8: Background writes only — no loading spinners, no error toasts, no blocking for preference saves
- FR-9: If the user has no lists at all, skip all last-list logic and show the empty state as usual

## Non-Goals

- No per-list "pin" or "favorite" system — this only remembers the single most-recently-selected list
- No per-device override — all devices share the same last-selected list via Supabase
- No UI for this feature — there is no settings toggle, no "default list" picker; it happens automatically
- No history of recently used lists — just the single last one
- No offline-first write queue — if the Supabase write fails, the local cache still works; the next successful write will correct the server

## Technical Considerations

- **Existing extension point:** The `user_preferences` table (migration `20260311130000`) already stores per-user preferences with RLS. Adding a column is the natural approach — no new table needed.
- **Reference pattern — React:** `useSortPreferences.js` (lines 27-78) shows the exact pattern for loading preferences from Supabase, subscribing to realtime changes, and updating local state. Follow this pattern for `last_list_id`.
- **Reference pattern — React service:** `preferences.js` has `getUserPreferences()` and `updateDefaultSortConfig()` with the upsert pattern. Add `updateLastListId()` using the same upsert approach.
- **Reference pattern — iOS:** `PreferenceService.swift` reads from `user_preferences` with in-memory caching. Extend with `updateLastListId` method.
- **Debouncing:** The persist call must be debounced to avoid flooding Supabase when the user rapidly switches between lists (e.g., browsing). 500ms minimum.
- **Race condition awareness:** On startup, local cache provides the initial selection. When Supabase data arrives, it may differ. The reconciliation rule is simple: server value replaces local cache. But if the user has already manually switched to a different list before the server response arrives, do not override their in-session choice.
- **iOS NavigationStack:** Auto-navigation requires programmatic path manipulation. `ListBrowserView` uses `@State private var path = NavigationPath()`. Append the target list's value to `path` after confirming the list exists.
- **ON DELETE SET NULL:** Using a foreign key with `ON DELETE SET NULL` means if a list is deleted, the `last_list_id` automatically becomes null in the database — no application-level cleanup needed for this path. The local cache cleanup (US-004, US-008) handles the client side.

## Success Metrics

- Users land on their last-used list within 100ms of app load (from local cache)
- Zero regressions in first-load behavior for users with no list history
- Cross-device sync works: select a list on web → open iOS → same list auto-selected (and vice versa)

## Open Questions

- None — all design decisions resolved via clarifying questions.

## Credential & Service Access Plan

No external credentials required for this PRD. All functionality uses the existing Supabase project (auth, database, realtime) which is already configured.

## Definition of Done

This PRD is complete when:

1. **Database:** The `last_list_id` column exists in `user_preferences` with the foreign key and `ON DELETE SET NULL` constraint
2. **React web app:** Selecting a list persists to Supabase (debounced), launch restores from localStorage → Supabase, invalid lists land on list browser, realtime subscription keeps cache fresh
3. **iOS native app:** Same persistence and restoration behavior, with auto-navigation into the list detail view on launch
4. **Cross-device sync verified:** Changing the selected list on web reflects on iOS after relaunch, and vice versa
5. **Edge cases handled:** Deleted list, unshared list, no lists, user with no prior preference — all gracefully handled with no errors or broken states
6. **No UI additions:** Feature works invisibly with zero settings or configuration
7. **All acceptance criteria pass on both platforms**
8. **Lint passes (React), build succeeds (iOS)**
