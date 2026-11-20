# .searchable(displayMode: .always) and the large title

## Problem
With `.searchable(placement: .navigationBarDrawer(displayMode: .always))`, a
screen's large title sometimes starts collapsed to the small centred (inline)
one. Pulling the content down shows the large title, then it springs back.
`.navigationBarTitleDisplayMode(.large)` does not help. Seen on iOS 26.2 and 27.

## Cause
The search field was attached to content that appears after loading (inside
an `if let viewModel` / loading branch). When the drawer is added after the
scroll view is already on screen, the bar's height grows but the scroll offset
doesn't move, so the title rests in its collapsed position.

## Fix
Attach `.searchable` at the same level as `.navigationTitle`, on the container
that exists from the first frame, not on the loaded content:

```swift
Group { if let vm = viewModel { content(vm) } else { loadingView } }
    .navigationTitle("Recipes")
    .searchable(
        text: Binding(get: { viewModel?.searchQuery ?? "" }, set: { viewModel?.searchQuery = $0 }),
        placement: .navigationBarDrawer(displayMode: .always),
        prompt: "Search"
    )
```

Ruled out along the way: `List` vs `ScrollView`, `pinnedViews`, and a top
`safeAreaInset`.

## Decision (2026-11-20)
The user prefers the standard always-visible system field. Every `.searchable`
in the app uses `displayMode: .always`. Don't hand-build a search bar in a
`safeAreaInset`; see ios-safe-area-inset-background-hides-large-title.md.
