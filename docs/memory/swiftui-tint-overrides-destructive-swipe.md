# Global tint overrides destructive swipe-action red

MainTabView applies `.tint(Color.brandGreen)` app-wide. In SwiftUI, an ancestor tint
overrides the red that `Button(role: .destructive)` normally gets inside `.swipeActions`,
so delete swipe buttons render brand green instead of red.

Fix: every destructive swipe-action button must carry an explicit `.tint(.red)` on the
Button (see ListBrowserView, StoreBrowserView, ListDetailView, CollectionBrowserView,
CategoryEditorSheet for the pattern). `role: .destructive` alone is not enough. Built-in
`.onDelete` edit-mode deletes are unaffected.
