# SwiftUI toolbar button disabled color — use foregroundStyle, not tint

## Problem

When a sheet is presented from a view with `.tint(someColor)`, that tint
is inherited by the sheet. Applying `.tint(anotherColor)` to a toolbar
button inside the sheet does NOT override the inherited tint — SwiftUI
ignores it on disabled buttons and just desaturates the inherited color
instead, which can render as near-white for light brand colors.

## Fix

Use `.foregroundStyle(color)` instead of `.tint(color)` on the toolbar
button. This sets the text color directly, bypassing tint inheritance.

```swift
Button("Create") { ... }
    .fontWeight(.semibold)
    .disabled(!canCreate)
    .foregroundStyle(canCreate ? brandGreen : Color(.tertiaryLabel))
```

## Context

Discovered in `CreateStoreSheet` — presented from `StoreBrowserView`
which has `.tint(brandGreen)`. The disabled "Create" button rendered
as near-white (desaturated green) until `.foregroundStyle` was used.
