# Completion Report: prd-reset-list-items

## PRD Metadata
- **ID:** prd-reset-list-items
- **Title:** Reset Guest List RSVP Items
- **Started:** 2026-04-21 (US-001 commit `3d2c587`)
- **Completed:** 2026-04-22
- **Final commit:** `2abf30f` (US-007 iOS)
- **Session:** `builder-1776783970`

## Story-to-Acceptance Mapping

| Story | Title | Status | Commit | Notes |
|-------|-------|--------|--------|-------|
| US-001 | "Reset items" action in 3-dot menu (owner-only) | ✅ Complete | `3d2c587` | Web + iOS menu entries, gated to Guest List + owner |
| US-002 | Confirmation dialog before reset | ✅ Complete | `e284942` | Reused `ConfirmDialog`; iOS uses native alert |
| US-003 | Reset operation persists to Supabase (atomic, owner-only) | ✅ Complete | `49ee9b6` | `reset_guest_list_rsvp` RPC, `SECURITY DEFINER`, owner check, audit log row |
| US-004 | Realtime sync to collaborators | ✅ Complete | `4e77990` | Removed non-PK filter on iOS items channel; relied on existing `REPLICA IDENTITY FULL` from prior PRD |
| US-005 | Undo support after reset | ✅ Complete | `5b8ffdb` | Snapshot-and-restore via existing batch update; success/error toast wiring |
| US-006 | Duplicate List parity + opt-in RSVP reset | ✅ Complete | `bbec0df` | Web + iOS duplicate flow now offers "Reset RSVPs" toggle for guest lists |
| US-007 | Empty state and edge cases | ✅ Complete | `1e5f858` (web), `2abf30f` (iOS) | Tooltip on disabled menu when empty; info toast (not modal) when already reset |

## Files Changed

### New Files
- `supabase/migrations/20260421120000_reset_guest_list_rsvp_rpc.sql` — `reset_guest_list_rsvp(list_id uuid)` RPC and audit insert
- `src/components/Toast.jsx`, `src/components/Toast.module.css` — Toast UI primitive
- `src/context/ToastContext.jsx` — Provider + `useToast()` hook
- `ios-native/GatherLists/GatherLists/Views/Components/ToastBanner.swift` — SwiftUI toast banner with `.success`, `.error`, `.info` variants
- `ios-native/GatherLists/GatherLists/Views/Components/DuplicateListSheet.swift` — Duplicate-with-options sheet (US-006)
- `tests/ui-verify/reset-list-items-empty-state.spec.ts` — Playwright verification for US-007

### Modified Files (web)
- `src/App.jsx` — `handleResetItems`, undo wiring, toast integration
- `src/components/ListSelector.jsx` (+ CSS) — Menu entry, disabled tooltip
- `src/components/MobileListDetail.jsx` (+ CSS) — Mobile menu entry, disabled tooltip
- `src/components/ConfirmDialog.jsx` (+ CSS) — "Cannot be undone" warning slot
- `src/components/ShoppingItem.jsx`, `src/components/ShoppingList.jsx` — Minor render path adjustments for reset state
- `src/context/ShoppingListContext.jsx` — `resetGuestRsvps`, snapshot/restore for undo
- `src/services/database.js` — `resetGuestListRsvp` RPC client; modernized SDK calls
- `src/main.jsx` — `ToastProvider` mount

### Modified Files (iOS)
- `ios-native/GatherLists/GatherLists/Services/ItemService.swift` — `resetGuestRsvps`, batch restore
- `ios-native/GatherLists/GatherLists/Services/ListService.swift` — `duplicateList(resetRsvps:)`
- `ios-native/GatherLists/GatherLists/ViewModels/ListDetailViewModel.swift` — Reset action, undo, toast emit, "already reset" info toast
- `ios-native/GatherLists/GatherLists/ViewModels/ListViewModel.swift` — Duplicate-with-reset path
- `ios-native/GatherLists/GatherLists/Views/Lists/ListDetailView.swift` — Menu entry + alert
- `ios-native/GatherLists/GatherLists/Views/Lists/ListBrowserView.swift` — Menu entry + duplicate sheet
- `ios-native/GatherLists/GatherLists/Views/MainTabView.swift` — Toast banner mount
- `ios-native/GatherLists/GatherLists/GatherListsApp.swift` — Toast environment

## Data and Migration Impact
- **One migration:** `20260421120000_reset_guest_list_rsvp_rpc.sql`
  - Adds `public.reset_guest_list_rsvp(list_id uuid)` (`SECURITY DEFINER`, owner check via `is_list_owner`)
  - Inserts into existing `list_audit_events` table on each reset
- **Migration deployed to remote** (`nvumgewnllqxzpaxubya`) via `supabase db push --linked` during this session — see Verification Evidence and the memory note.

## API / Auth / Permission Impact
- New RPC `reset_guest_list_rsvp` callable by authenticated users; the function itself enforces owner-only via `is_list_owner(list_id)` and raises `permission denied` otherwise.
- No changes to RLS policies on `items` or `lists`.

## UI/UX Impact
- New menu entry "Reset items" on Guest Lists for owners (web 3-dot, iOS context menu, mobile detail menu).
- Confirmation dialog (web) / alert (iOS) with "cannot be undone" warning before destructive action.
- Success toast with **Undo** action; tap restores the prior `rsvp_status` for each item.
- Disabled menu state with tooltip when the list is empty.
- Info toast "Already reset" when all items are already `not_invited` (replaces former modal).

## Verification Evidence

| Check | Result |
|-------|--------|
| `npm run build` (web) | ✅ Pass |
| `xcodebuild -scheme GatherLists -destination 'generic/platform=iOS Simulator' build` | ✅ Pass |
| Playwright `tests/ui-verify/reset-list-items-empty-state.spec.ts` | ✅ 3/3 consecutive runs (AC-1 tooltip, AC-2 already-reset toast) |
| `npx supabase migration list --linked` | ✅ `20260421120000` present remote |
| Manual end-to-end (user) | ✅ Reset success, persistence, "Already reset" all confirmed |

Screenshots (gitignored under `ai-tmp/verification/screenshots/`):
- `us-007-empty-reset-tooltip.png`
- `us-007-already-reset-toast.png`

## Incidents / Lessons Learned

**Migration deployment forgotten (US-003 → US-007).** The `reset_guest_list_rsvp` RPC migration was committed in US-003 but never pushed to the remote Supabase project. Every reset attempt failed with `PGRST202` for ~4 stories before being caught during US-007 verification. Deployed mid-US-007 via `supabase db push --linked`, then re-verified all paths.

Recorded in `docs/memory/supabase-migration-deployment.md`: any commit touching `supabase/migrations/` MUST run `db push` before the story is marked complete.

## Deferred Work / Known Issues
- **`list_audit_events` RLS hardening.** Table has SELECT policy only; INSERTs from the RPC succeed because `SECURITY DEFINER` runs as table owner (RLS bypassed). Fragile if `FORCE ROW LEVEL SECURITY` is ever enabled. Add an explicit `INSERT` policy gated by `is_list_owner(list_id)` as future hardening.

## Follow-ups
- Consider an explicit `INSERT` policy on `list_audit_events` (see above).
- Consider surfacing reset events in a future activity-log UI (audit rows are already persisted).
