# US-003: Reset operation persists to Supabase

## Scope
Real bulk reset on both platforms, replacing US-002 stubs.
- Web: `resetGuestListRsvp(listId)` in database.js + `resetGuestListRsvpAction` in ShoppingListContext
- iOS: `ItemService.resetRsvpStatuses(listId:)` + ListDetailViewModel plumbing
- Optimistic local update on both
- Single DB UPDATE, returns reset count
- RLS: owner-only (verify existing policy supports bulk update)

## Plan
1. Explore: confirm existing Supabase RLS policy + realtime channel for items
2. Web service: Supabase `from('items').update({rsvp_status: 'not_invited'}).eq('list_id', listId).not('rsvp_status', 'eq', 'not_invited').select()`
3. Web context: action that calls service, then optimistically sets all active items to not_invited
4. Web: replace `console.log` stub in App.jsx handleResetConfirm
5. iOS service: equivalent Supabase update via existing client pattern
6. iOS viewmodel: method that calls service + flips local items
7. iOS: replace `print` stubs in both views
