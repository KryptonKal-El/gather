# List nav bar loses its colour when the list is pushed while a sheet is dismissing

## Problem
On iOS 27 the list detail bar sometimes showed no list colour: grey translucent bar, black title, black back chevron, while the trailing toolbar buttons were still white (nearly invisible). It stayed that way through scrolling, adding items and sheets, and only recovered on pop + re-push or background/foreground.

## Cause
SwiftUI drops the `toolbarBackground` / `toolbarColorScheme` update for a view that is pushed while a sheet is still animating away. That is exactly what happens after email-code sign-in: `isAuthenticated` flips while `EmailCodeSignInView` (a sheet on `LoginView`) is still up, `MainTabView` replaces `LoginView`, and `ListBrowserView` auto-pushes the last open list (`gather.listDetailOpen`) 0.1 s later, during the sheet's teardown.

Not affected: tapping a list once the sheet is gone, a relaunch that restores into the list, and a deep link pushed under a sheet that stays open.

## Fix
`ListNavigationBarStyle` (bottom of `ListDetailView.swift`) owns the three toolbar modifiers and, 1 s after the view appears, changes the background from `color.opacity(0.999)` to `color`. Any change to the toolbar background value makes SwiftUI re-apply the whole bar style, and this one is invisible. In the sign-in case the bar is unstyled for about a second, then turns to the list colour.

## What doesn't work
- Setting `UINavigationBarAppearance` on the hosting controller's `navigationItem` from a representable: it colours the bar but fights SwiftUI's own styling (black back chevron, washed-out button glass).

## Reproducing without signing in
Temporarily gate `MainTabView` in `GatherListsApp` behind a `@State` flag that flips after ~14 s, so `LoginView` shows first with a valid session. Leave a list open before relaunching, tap "Continue with Email" to open the sheet, and wait for the flip. Without the fix the restored list comes up with the unstyled bar every time.
