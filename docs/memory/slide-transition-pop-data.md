# iOS Slide Transition: Preserving List Data During Pop

## Problem
When a user navigates back (pop) from a list detail view, the list's `openListId` is cleared, which causes `activeList` to become null. But the exit animation needs the list data to render for 300ms while sliding out.

## Solution
The `useMobileNav` hook stores `poppingListData` — a snapshot of the list's data captured at the start of the pop transition. This data is used by `MobileListDetail` during the 300ms exit animation, then cleared when the transition completes.

```javascript
const startPopTransition = useCallback((currentListId, currentLists) => {
  const listData = currentLists.find((l) => l.id === currentListId);
  setPoppingListData(listData ?? null);
  setTransition('popping');
  // After animation completes, clear everything
  transitionTimeoutRef.current = setTimeout(() => {
    setOpenListId(null);
    setTransition(null);
    setPoppingListData(null);
  }, TRANSITION_DURATION);
}, []);
```

## Key Detail
The `lists` parameter must be passed to `useMobileNav` from the parent so it has access to the current lists array when computing `poppingListData`. Without this, the hook can't look up the list data.
