# iOS 26 Glass Sheet Material Makes Button Text Invisible

## Problem
On iOS 26.2, SwiftUI sheets use a translucent "glass" material by default. Inside a `Form` on a sheet, `Button` labels render their `Text` with the default button tint color, which becomes invisible against the glass background.

## What doesn't work
- `.presentationBackground(.regularMaterial)` — no effect
- `.presentationBackground(Color(UIColor.systemGroupedBackground))` — no effect
- `.scrollContentBackground(.visible)` or `.hidden` — no effect
- `.toolbarBackground(.visible, for: .navigationBar)` — no effect

## What works
1. **Use `Form` instead of `List`** — Form content area is more opaque than List
2. **`.buttonStyle(.plain)` on buttons inside Form** — prevents the default button tint from making text invisible. Text renders in `.primary` color (black/white) which is readable.
3. **Explicit `.foregroundStyle(.blue)` on button labels** that should look like action buttons (since `.plain` removes the tint)
4. **Explicit `.fontWeight(.semibold)` + `.foregroundStyle(.blue)` on toolbar buttons** — toolbar buttons (like "Done") also get washed out by the glass nav bar

## Pattern
```swift
// Inside Form on a sheet:
Button {
    action()
} label: {
    HStack {
        Image(systemName: "plus.circle.fill")
            .foregroundStyle(.green)
        Text("Label")  // Will be readable in .primary color
    }
}
.buttonStyle(.plain)  // KEY: prevents invisible text

// For action-style buttons:
Button { ... } label: {
    HStack {
        Image(systemName: "arrow.uturn.backward")
        Text("Use Default")
    }
    .foregroundStyle(.blue)  // Explicit blue since .plain removes tint
}
.buttonStyle(.plain)
```

## Toolbar buttons
```swift
.toolbar {
    ToolbarItem(placement: .topBarTrailing) {
        Button("Done") { dismiss() }
            .fontWeight(.semibold)
            .foregroundStyle(.blue)  // Explicit color for glass nav bar
    }
}
```
