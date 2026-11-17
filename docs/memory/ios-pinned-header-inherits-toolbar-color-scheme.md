# Pinned List section headers inherit the nav bar's toolbarColorScheme

## Problem
`ListDetailView` sets `.toolbarColorScheme(.dark, for: .navigationBar)` so the title/buttons stay white on the colored list bar. In light mode, when a plain-`List` section header (store header, "Crossed" header) becomes sticky and slides under the nav bar, it adopts the bar's dark scheme — semantic colors like `Color(.secondarySystemGroupedBackground)` and `.primary` flip to their dark variants, for that header only.

## Fix
Capture the screen's scheme with `@Environment(\.colorScheme)` in the parent view and re-apply it with `.environment(\.colorScheme, colorScheme)` **inside the header Button's label** (on the label's root view, after its `.background`). Don't use `.preferredColorScheme` — that changes the whole window.

## iOS 27: the override must be inside the Button label
The original fix put the override on the header `Button` itself. On iOS 27 that placement is ignored: a probe inside the label still read `.dark` while pinned (near-black background, light text), although the parent's captured value was `.light`. The same `.environment(\.colorScheme, …)` applied to a view inside the label is honoured. So for any header that is a `Button`, put the override on the label content, not on the Button.

Quick check: open Weekly Groceries, scroll until a store header pins under the bar; it must look the same as the unpinned headers below it, in light and dark mode.
