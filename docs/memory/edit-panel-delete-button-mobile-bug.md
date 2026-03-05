# Edit Panel Delete Button Bug on Mobile

## Problem

The Delete button in the ShoppingItem edit panel does not work on mobile devices (or mobile emulation in Playwright). Clicking/tapping the button has no effect - the item is not deleted.

## Location

- Component: `src/components/ShoppingItem.jsx` (lines 486-496)
- The button: `<button onClick={onRemove} aria-label="Remove {item.name}">Delete</button>`

## Investigation Findings

1. **Native click events DO reach the button** - Adding a native `addEventListener('click', ...)` to the button shows the event fires.

2. **React's onClick handler does NOT execute** - Despite the native event firing, the `onRemove` prop function is never called.

3. **Other buttons in the edit panel work** - The quantity stepper (+/-) buttons work correctly on mobile.

4. **Swipe-to-delete works** - The swipe gesture delete (which also calls `onRemove`) works perfectly on mobile.

5. **Calling onClick directly via React fiber works** - Accessing `fiber.memoizedProps.onClick()` and calling it manually works, but the deletion still doesn't happen (suggesting `activeList` may be undefined in that context).

## Possible Root Causes

1. **React synthetic event delegation issue** - React 17+ delegates events to the root. Something may be preventing the synthetic event from reaching the handler.

2. **Touch event interaction** - On mobile, the edit panel or parent components may be handling touch events in a way that interferes with click events on the delete button specifically.

3. **Stale closure / activeList issue** - The `handleRemoveItem` function in App.jsx has an early return `if (!activeList) return;`. If `activeList` is undefined when the handler runs, nothing happens.

4. **Event propagation stopped somewhere** - A parent element may be calling `stopPropagation()` that affects only this button.

## Workaround

Close the edit panel and use swipe-to-delete instead. This is implemented in the E2E test `e2e/swipe-delete.spec.js`.

## To Reproduce

1. Open the app on a mobile device or Playwright mobile-chrome project
2. Navigate into a shopping list
3. Add an item
4. Tap the edit (pencil) button on the item
5. Tap the Delete button
6. Observe: nothing happens

## Priority

Medium - Users can still delete items via swipe gesture, but the button should work.
