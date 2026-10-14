# iOS simulator tool: screenshots lag and quick taps get dropped

## Problem

Driving the app with the simulator control tool, a screenshot taken right after a tap often
shows the screen *before* the tap, so it looks like the tap did nothing. Repeating the tap then
does it twice (e.g. opens a menu and immediately dismisses it). Separately, plain quick taps on
SwiftUI `Toggle` switches and on items in a just-opened `Menu` were sometimes ignored.

## Fix

- Take a second screenshot before deciding a tap failed.
- Use `duration: 0.12` on taps for toggles, menu items and toolbar buttons; those registered
  every time.
- After a swipe-scroll, wait for the list to settle (screenshot again) before tapping by
  coordinate, or the tap lands on whatever row scrolled under it.
- Dismiss the keyboard with the Return key; tapping outside a Form text field did not.
