# Pinned List section headers inherit the nav bar's toolbarColorScheme

## Problem
`ListDetailView` sets `.toolbarColorScheme(.dark, for: .navigationBar)` so the title/buttons stay white on the colored list bar. In light mode, when a plain-`List` section header (store header, "Crossed" header) becomes sticky and slides under the nav bar, it adopts the bar's dark scheme — semantic colors like `Color(.secondarySystemGroupedBackground)` and `.primary` flip to their dark variants, for that header only.

## Fix
Capture the screen's scheme with `@Environment(\.colorScheme)` in the parent view and re-apply it on the header: `.environment(\.colorScheme, colorScheme)`. Don't use `.preferredColorScheme` — that changes the whole window.
