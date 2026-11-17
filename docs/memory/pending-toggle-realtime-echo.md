# Cross-off: immediate commit, shared placement hold (web + iOS)

## Behavior (since 2026-11-17)

Double-tap cross-off writes to the DB **immediately**. What is delayed is only the
*move* between the active and crossed sections: each toggled item is held in the section
it was in, and every toggle restarts **one shared 1.5s timer**. When that timer finally
expires, all held items move together. This keeps the list from shifting while the user
is still crossing off a second or third item.

- Web: `src/hooks/usePendingToggles.js` — `getEffectiveChecked` (row rendering) vs
  `getPlacementChecked` (which section; used by `ShoppingList.jsx` to partition).
- iOS: `ListDetailViewModel.scheduleToggleItem` — `effectiveIsChecked(for:)` vs
  `placementIsChecked(for:)`; `uncheckedItems` / `checkedItems` partition by placement.

Two separate pieces of state, do not merge them:

- **placement hold** (`heldCheckedById` / `heldPlacements`): the section the item sat in
  when the hold started. Cleared for all items at once when the shared timer fires.
- **optimistic checked** (`optimisticCheckedById` / `pendingToggleStates`): the target
  state, shown while the write is in flight so a refetch/realtime echo of *another*
  item's commit can't flicker the row back.

Toggling the same item again inside the hold commits the reversal (writes are chained
per item so they land in tap order) and the item simply never moves.

## Rules that still apply

- **Never clear all optimistic state on a realtime event** — your own commits echo back
  through the channel. Clear per item.
- The web has no local optimistic item update; it relies on the realtime echo. So the
  web override is dropped only when the commit has settled, the hold is released, and
  the items either already show the target or change again.
- Web and iOS are meant to be semantically identical — change both.

## History

Before this, the DB write itself was delayed 1.5s per item (each with its own timer),
which made rows jump one by one mid-interaction.
