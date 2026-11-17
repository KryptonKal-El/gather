# iPhone Duo (foldable) layout

## What the device does

- Closed: outer screen, 466 × 678 pt. Open or half-open: inner screen, 951 × 669 pt, landscape,
  even though the iPhone orientation list is portrait-only. Horizontal size class is regular when open.
- On both screens iOS moves the tab bar and navigation-bar buttons into a vertical bar on the
  trailing edge, under the clock. Content must stay clear of it.

## Problem

`readableContentWidth()` used `.contentMargins(.horizontal, …, for: .scrollContent)`. On a `List`
that replaces the margin iOS reserves for the side bar, so Plan and Settings slid about 80 pt
underneath it. A plain `ScrollView` (recipe detail) was not affected.

## Fix

Use `.safeAreaPadding(.horizontal, inset)` instead. It is measured from the safe area, so it adds
to the side-bar room, and the scroll view still spans edge to edge. Do not read safe-area insets
and re-apply them by hand.

## Other gotchas

- 669 pt is short. A fixed vertical stack that fits an iPhone can overflow when open; let the
  outer gaps flex (see `LoginView`).
- `simctl io screenshot` fails on the Duo unless a display is named (`--display=3` inner, `=1` outer).
- The Duo device type needs an iOS 27.1+ simulator runtime.
