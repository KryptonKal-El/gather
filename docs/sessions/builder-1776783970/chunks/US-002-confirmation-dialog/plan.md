# US-002: Confirmation dialog before reset

## Scope
Wire confirmation dialogs to the Reset items menu entries (web + iOS).
Still NO actual DB reset (US-003) — Reset button calls a stub that logs.

## Acceptance Criteria
- Tap → opens confirmation dialog
- Dialog text: "Reset all {N} guests to Not Yet Invited? This will clear their current RSVP status."
- Cancel + Reset (destructive style)
- If all items already not_invited → skip dialog, show toast "All guests are already at Not Yet Invited"
- Outside-tap cancels on web
- Cancel = no DB write
- Light + dark mode

## Plan
- Web: use existing ConfirmDialog.jsx pattern; replace handleResetItems console.log with state-driven dialog
- iOS: add .alert modifier in both ListDetailView and ListBrowserView wired to showResetItemsConfirm flag
- Toast: web has no global toast — use ConfirmDialog as info-only single-button modal; iOS uses informational .alert
- "Already reset" check: count items where rsvpStatus !== 'not_invited' / nil; if zero → show info toast not destructive dialog
