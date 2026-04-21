# US-001: Reset items menu entry — changes

## Files modified
- `src/components/MobileListDetail.jsx` — Reset items in desktop dropdown + mobile action sheet; computes `isOwned` from `!list._isShared`; disabled when no items
- `src/components/ListSelector.jsx` — Reset items in desktop dropdown + mobile action sheet; uses `list.itemCount` for disabled state
- `src/App.jsx` — `handleResetItems` stub callback (console.log placeholder for US-002); `onResetItems` prop wired to both surfaces
- `ios-native/GatherLists/GatherLists/Views/Lists/ListDetailView.swift` — Reset items in ellipsis menu; `@State showResetItemsConfirm` flag (unwired until US-002); disabled when `viewModel?.items.isEmpty ?? true`
- `ios-native/GatherLists/GatherLists/Views/Lists/ListBrowserView.swift` — Reset items in context menu; `@State showResetItemsConfirm` and `listToResetItems` flags; disabled when `list.itemCount == 0`

## Verification
- Web: `npm run build` ✓ 936ms; eslint ✓ no output
- iOS: `xcodebuild ... build` → BUILD SUCCEEDED (twice — initial + post-fixup)
- Critics: @frontend-critic, @swift-critic, @oddball-critic — all PASS WITH COMMENTS, no blockers
- Empty-list parity gap (iOS browser) flagged by critics — fixed in same story

## Deferred to US-002
- Confirmation dialog (web ConfirmDialog modal, iOS .alert)
- Wiring `showResetItemsConfirm` and `handleResetItems` to actual dialog state

## Deferred to US-003
- `resetGuestListRsvp` service function (web `database.js`, iOS `ItemService`)
- ViewModel/context action plumbing
- Optimistic UI update + error rollback
