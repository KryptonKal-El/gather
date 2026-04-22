# Human Testing Script: Reset Guest List RSVPs

## Overview
Verify the new "Reset items" action on Guest Lists across web and iOS, including success, undo, empty/already-reset edge cases, realtime sync to collaborators, and the duplicate-with-reset option.

## Prerequisites
- Signed in as a list **owner** account
- A second account (collaborator) signed in on another device/browser, sharing one Guest List
- A Guest List with several items in mixed RSVP states (`invited`, `accepted`, `declined`, `maybe`)

---

## Test 1: Reset action visibility
1. Open a non-Guest list (e.g., shopping list)
2. Open the 3-dot menu
3. **Expected:** "Reset items" is **not** present
4. Open a Guest List as the owner → 3-dot menu
5. **Expected:** "Reset items" **is** present
6. Sign in as a collaborator (non-owner), open the same Guest List
7. **Expected:** "Reset items" is **not** present

## Test 2: Confirmation + reset succeeds
1. As owner on a Guest List with mixed RSVP statuses, choose "Reset items"
2. **Expected:** Confirmation dialog appears with a "cannot be undone" warning
3. Confirm
4. **Expected:** All items return to `invited` (or default) state; success toast appears with an **Undo** button
5. Refresh the page
6. **Expected:** State persists — items are still reset

## Test 3: Undo
1. Repeat Test 2 to perform a reset
2. While the success toast is visible, click **Undo**
3. **Expected:** All items return to their previous RSVP statuses
4. Refresh
5. **Expected:** Restored state persists

## Test 4: Already-reset edge case (US-007 AC-2)
1. Immediately after a successful reset (or on a list where every item is already `not_invited` / default), choose "Reset items" again
2. **Expected:** No confirmation dialog and **no modal**. An info toast appears: "Already reset"

## Test 5: Empty list edge case (US-007 AC-1)
1. Open a Guest List with **zero items**
2. Open the 3-dot menu
3. **Expected:** "Reset items" is **disabled**; hovering shows a tooltip explaining why (e.g., "List is empty")

## Test 6: Realtime sync to collaborators
1. Owner and collaborator both have the Guest List open
2. Owner performs a reset
3. **Expected:** Collaborator's view updates within a few seconds, no refresh required

## Test 7: Network failure handling
1. Open browser DevTools → Network → set to **Offline**
2. As owner, choose "Reset items" → confirm
3. **Expected:** Error toast: "Couldn't reset — try again"; no items change state
4. Set Network back to **Online**, retry → success

## Test 8: Duplicate List with RSVP reset (US-006)
1. As owner of a Guest List, open the duplicate option (web context menu / iOS sheet)
2. **Expected:** A "Reset RSVPs" toggle is visible
3. Toggle ON, duplicate
4. **Expected:** New list is created with all items at `invited` (or default), even if the source had mixed statuses
5. Repeat with the toggle OFF
6. **Expected:** New list preserves source RSVP statuses

## Test 9: iOS parity
Repeat Tests 1–7 on the iOS app:
- Test 2 confirmation uses a native iOS alert
- Test 4 "Already reset" should appear as an info toast banner (not an alert)

## Notes
- If reset fails with a server error, check that the Supabase migration `20260421120000_reset_guest_list_rsvp_rpc.sql` is deployed to the remote project. (It was deployed during this PRD's session — see `docs/memory/supabase-migration-deployment.md`.)
- Audit rows are written to `list_audit_events` on each successful reset; no UI surfaces these yet.
