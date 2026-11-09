# SwiftUI Canvas inside TimelineView draws stale @State

## Problem
`SnowfallView` filled its `@State var flakes` in `.task`, then drew them in a
`Canvas` inside `TimelineView(.animation)`. Nothing appeared. Logging inside the
Canvas closure showed it ran every frame but always saw `flakes.count == 0`.

## Why
The TimelineView content (and its Canvas renderer) kept the values it captured
on first render; the later `@State` assignment never reached the renderer.

## Fix
Build the data before the first render: generate it in the view's `init` and
store it in a `let` (also `startDate`). `.task` only waits and calls `onFinish`.

## Testing seasonal effects
`HolidaySeason` honours a `forceSnowfall` launch argument:
`xcrun simctl launch --terminate-running-process <udid> com.gatherlists -forceSnowfall YES`.
`print()` output needs `simctl launch --console-pty` to be seen.
