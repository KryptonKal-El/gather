# State Management Conventions

Applies to `src/context/` and any Context + hooks-based state in the project.

## Context Shape

The value provided by a context must follow this shape:

```js
{
  state: {
    // raw data from Supabase / local state
    lists, sharedListRefs, sharedListMetas,
    activeItems, history,
    stores, userCategoryDefaults, userStoreDefaults,
    // … other domain-specific fields
  },
  actions: {
    // all mutation functions (create, update, delete, reorder, etc.)
    createListAction, updateListAction, deleteListAction,
    // …
  },
  activeList,   // top-level derived value — most-recently selected list
  sortedLists,  // useMemo computed from state.lists
  allLists,     // useMemo computed combining owned + shared lists
  // … other top-level derived values as needed
}
```

Do not flatten everything into a single object. Keep `state` and `actions` separated. Top-level derived values (computed via `useMemo`) sit alongside `state` and `actions` at the top level when they are consumed widely.

## Context Creation

```js
const MyContext = createContext(null);
```

Export the context as a named export. Export a custom hook as the consumer interface — do not export `useContext(MyContext)` directly.

```js
/** @returns {Object} The shopping list context value. */
export function useShoppingList() {
  return useContext(ShoppingListContext);
}
```

## Actions

- All action functions must be wrapped in `useCallback` with correct dependencies.
- Every action that calls Supabase must guard against a missing user:

```js
const createItem = useCallback(async (name) => {
  if (!userId) return;
  …
}, [userId]);
```

## Subscriptions

- Set up realtime subscriptions in `useEffect`.
- Return the unsubscribe function directly from the effect.
- Re-run subscriptions when `sessionVersion` changes (token-refresh recovery):

```js
useEffect(() => {
  const unsubscribe = subscribeToItems(listId, handleChange);
  return unsubscribe;
}, [listId, sessionVersion]);
```

## One-Time Async Effects

Use a `useRef` flag to prevent a `useEffect` from running more than once (e.g. initial data load):

```js
const hasFetched = useRef(false);
useEffect(() => {
  if (hasFetched.current) return;
  hasFetched.current = true;
  fetchData();
}, []);
```

## Derived Data

Use `useMemo` for values derived from state that would otherwise recompute on every render.

```js
const sortedLists = useMemo(
  () => [...lists].sort((a, b) => a.sortOrder - b.sortOrder),
  [lists]
);
```

## Local Storage Cache

Use `localStorage` as a cache layer for user preferences and last-selected state (e.g. last-selected list, list order). Read on mount, write on change.

## Debounced Supabase Sync

For high-frequency updates (e.g. item name editing), debounce the Supabase write using `setTimeout`/`clearTimeout` stored in a `useRef`:

```js
const syncTimer = useRef(null);

function scheduleSync(value) {
  clearTimeout(syncTimer.current);
  syncTimer.current = setTimeout(() => syncToSupabase(value), 500);
}
```

## Optimistic Updates

Use optimistic updates selectively — only where the latency is noticeable to the user. Always roll back on error.
