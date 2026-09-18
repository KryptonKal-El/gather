# Xcode 27: "unable to type-check this expression in reasonable time" in big SwiftUI bodies

## Problem
After updating to Xcode 27.0 (Sep 2026), `ListDetailView.swift` stopped compiling with
"the compiler is unable to type-check this expression in reasonable time", even though the
file had not changed since the last shipped build. The error pointed at an innocent line
(`item.recurrenceRule != nil && recurrenceRule == nil`) inside a closure passed to a `.sheet`.

## What doesn't work
- Adding `: Bool` annotations or splitting the flagged line into sub-expressions. The error
  just moves to the next statement, then to `body` itself.

## Why
Multi-statement closures inside a view's modifier chain are solved as part of the *same*
expression as the whole chain, so they share one time budget. The flagged line is only where
the budget happened to run out — the real culprit is the size of the `body` chain
(a dozen `.alert`/`.sheet`/`.onChange` modifiers with inline closures).

## Fix
Shrink the chain, not the flagged line:
1. Split `body` into two chained properties (`body` = `listContentWithAlerts` + sheets/tasks).
2. Move large inline sheet content with many-parameter closures into a helper
   (`editItemSheet(for:)`).

When adding more modifiers to an already huge `body`, add them to the smaller piece or
extract a helper, or the timeout will come back.
