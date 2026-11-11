# Notification tap → scroll to item (2026-11-11)

Pushes carry `itemId` next to `listId`; `NotificationService.pendingItemId` hands it to
`ListDetailView`, which expands the section hiding the item, scrolls to it and tints the row
for ~3s. `gatherlists://list/{listId}?item={itemId}` does the same.

## Gotchas

- **Don't clear `pendingItemId` when the view first sees it.** `navigateToList` resets the
  navigation path and re-pushes the list even when that list is already open, so the visible
  `ListDetailView` is destroyed ~100ms later. If it has already consumed the pending item, the
  replacement screen finds nothing and never scrolls. It is cleared only when the scroll
  actually starts.
- **Row tint must be an `.overlay`, not a `.background`.** `itemRow` paints an opaque
  `systemBackground`, so a background added outside it is invisible.
- Checked rows had no `.id(item.id)`; `scrollTo` needs it.

## Testing without a real push

`xcrun simctl push` fails with "Source is not authorized" until the app has been granted
notification permission in that simulator. The deep link needs no permission:

```
xcrun simctl openurl <device> "gatherlists://list/<listId>?item=<itemId>"
```

List and item ids for the signed-in simulator account are in the app container under
`Library/Caches/OfflineCache/items-<listId>.json`. Bump text size
(`xcrun simctl ui <device> content_size accessibility-extra-large`) to make a short list
overflow the screen, and reset it to `large` afterwards.
