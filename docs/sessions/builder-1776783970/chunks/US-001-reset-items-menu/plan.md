# US-001: "Reset items" action in 3-dot menu (Guest List, owner-only)

## Scope
Add a visible, correctly-gated "Reset items" menu entry on both platforms. NO dialog, NO reset logic — just the menu item and a stub handler (wired to a no-op or console.log for now). US-002 adds the dialog. US-003 adds the DB operation.

## Acceptance Criteria
- Menu entry visible only when `list.type === 'guest_list'` AND current user is owner
- Hidden for all other list types
- Hidden for shared collaborators (non-owners)
- Present on:
  - Web detail: desktop dropdown + mobile action sheet (MobileListDetail.jsx)
  - Web browser: desktop dropdown + mobile action sheet (ListSelector.jsx)
  - iOS detail: ellipsis menu (ListDetailView.swift)
  - iOS browser: context menu (ListBrowserView.swift)
- Empty list handling (disabled when 0 items) — spec says "Disabled (or shows 'No items to reset' toast)"; project idiom is disable, so disable the button when items.length === 0
- Lint passes, works in light + dark mode

## Gotcha
- MobileListDetail.jsx does NOT receive isOwned — need to plumb it through from App.jsx (compute as `!list._isShared`) OR compute inside from `list._isShared`
- Duplicate is NOT owner-gated; Reset items IS owner-gated. Pattern to copy is "Delete List" gating, not Duplicate.

## Plan
1. Web: Add "Reset items" button in the 4 menu locations, gated `isOwned && list.type === 'guest_list'`, disabled when list has 0 items. For MobileListDetail, compute `isOwned` from `list._isShared`. Handler is a stub (`onResetItems` prop) that triggers nothing yet — a console.log is fine.
2. iOS: Add "Reset items" Button in the 2 menu locations, gated `isOwned && list.type == "guest_list"`, with a stub `@State showResetItemsConfirm = false` flag (not yet wired to an alert).
3. For this story, the handler just needs to compile and be ready for US-002 to hook the dialog onto. No service function, no DB call.

## Verification
- Typecheck, lint, build pass on both platforms
- Manual: "Reset items" visible on Guest Lists (as owner), hidden on non-Guest, hidden for shared collaborators
