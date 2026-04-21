# US-002: Confirmation dialog before reset — Changes

## Files Modified

**Web:**
- `src/App.jsx` — Replaced `handleResetItems` stub with state-driven dialog flow:
  - New state: `resetConfirmList` (destructive), `resetInfoMessage` (info)
  - Active-list path: checks loaded items, skips destructive dialog if all are `not_invited`
  - Non-active-list path: always shows destructive dialog using `list.itemCount`
  - Two `<ConfirmDialog>` renders wired to the new state
  - Reset confirm currently logs a stub (US-003 replaces with real DB call)
- `src/components/ConfirmDialog.jsx` — Extended API:
  - New props: `title`, optional `cancelLabel` (null → info-only single-button)
  - `useId()`-generated `titleId` + `messageId`
  - `role="alertdialog"` when destructive, `"dialog"` otherwise
  - `aria-labelledby` / `aria-describedby` replace previous `aria-label`
- `src/components/ConfirmDialog.module.css` — `.title` styles, `.confirmBtnNeutral` added to shared base-button selector

**iOS:**
- `ios-native/GatherLists/GatherLists/Views/Lists/ListDetailView.swift`:
  - Menu button now gates on loaded items — skips destructive alert if none have `rsvpStatus != "not_invited"`
  - New `@State showResetAlreadyDoneInfo`
  - Two `.alert` modifiers: destructive (Cancel + Reset) and info (OK only)
  - Reset action is stubbed with `print(...)` pending US-003
- `ios-native/GatherLists/GatherLists/Views/Lists/ListBrowserView.swift`:
  - One `.alert` modifier (destructive only — browser rows don't load item RSVP data)
  - Documented tradeoff: always shows destructive alert, relies on US-003's reset op being idempotent

## Verification

- Web build: ✅ `✓ built in 840ms`
- US-002 lint: ✅ clean (`src/App.jsx`, `ConfirmDialog.jsx`)
- iOS build: ✅ BUILD SUCCEEDED on iPhone 17 simulator (warnings only, pre-existing)
- @frontend-critic: 1 critical (a11y wiring) + 1 warning (CSS selector gap) — **both fixed**
- @swift-critic: **PASS** — no issues

## Decisions

- **Active vs non-active list shortcut asymmetry** (web + iOS browser): Only active/detail views have items loaded, so "already reset" check runs there. Non-active contexts always show the destructive dialog using `itemCount`. US-003's reset op should be a no-op when there's nothing to change, so this is safe.
- **ConfirmDialog extension over new component:** The existing pattern and 9 callers argued for extending with backward-compatible defaults rather than adding `InfoDialog`.
- **Info dialog as single-button ConfirmDialog:** No global toast system exists. Reusing ConfirmDialog with a single OK button is cleaner than introducing a toast stack.

## Follow-ups for US-003

- Replace `console.log('[US-002] Reset confirmed...')` in `App.jsx` with `actions.resetGuestListRsvp(list.id)`
- Replace `print("[US-002] Reset confirmed...")` in both iOS views with a viewmodel call
- Consider optimistic-UI: flip statuses locally before awaiting DB
- Decide whether browser-view reset should lazy-load items (for already-reset shortcut) or stay eager
