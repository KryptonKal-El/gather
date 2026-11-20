# A top safeAreaInset's background can cover the large navigation title

## Problem
The Recipes tab's large "Recipes" title went blank after the search bar was
pinned with `.safeAreaInset(edge: .top)`. The title space was still there; the
text was missing.

## Cause
`.background(Color)` ignores safe areas by default. On a view sitting at the
top safe-area edge, the colour bleeds upward under the navigation bar and is
drawn over the large title.

## Fix
Keep the background inside the safe area:

```swift
.background(Color(.systemGroupedBackground), ignoresSafeAreaEdges: [])
```

`.navigationBarTitleDisplayMode(.large)` does not help; the title is already
large, just covered.
