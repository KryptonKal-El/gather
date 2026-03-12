# iOS 26.2: .searchable(displayMode: .always) breaks large title

## Problem

Using `.searchable(placement: .navigationBarDrawer(displayMode: .always))` on iOS 26.2 causes the navigation title to collapse from large (left-aligned) to inline (centered), even when `.navigationBarTitleDisplayMode(.large)` is explicitly set.

The behavior is inconsistent — it may work on one screen but not another with identical modifier structure.

## Fix

Don't use `displayMode: .always`. Use the default iOS pull-to-reveal search behavior:

```swift
// Bad — causes title to go inline on iOS 26.2
.searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search")

// Good — consistent large title, standard pull-to-reveal search
.searchable(text: $query, prompt: "Search")
```

## Context

Discovered while trying to make the search bar always visible on ListBrowserView and StoreBrowserView. After multiple attempts (adding `.navigationBarTitleDisplayMode(.large)`, restructuring views), the title kept collapsing on Lists but not Stores despite identical code. Reverted to default searchable behavior for consistency.
