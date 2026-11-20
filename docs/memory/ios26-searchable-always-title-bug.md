# .searchable(displayMode: .always) and the large title

## What happens
`.searchable(placement: .navigationBarDrawer(displayMode: .always))` keeps the
system search field visible. Depending on the screen, the navigation title
then stays large or collapses to the small centred (inline) one, and
`.navigationBarTitleDisplayMode(.large)` does not change which.

Seen on iOS 26.2 and still on iOS 27 (Nov 2026):
- Lists tab (a `List`): title stays large, field sits under it.
- Recipes tab (a `ScrollView` + `LazyVStack`): title is always inline, field
  sits in the bar. Removing `pinnedViews` or a top `safeAreaInset` made no
  difference, so it appears to follow `List` vs `ScrollView`.

## Decision (2026-11-20)
The user prefers the standard always-visible system field everywhere and
accepts the small title where it happens. Every `.searchable` in the app uses
`displayMode: .always`. Don't go back to a hand-built search bar in a
`safeAreaInset` to get the large title; see
ios-safe-area-inset-background-hides-large-title.md for what that cost.
