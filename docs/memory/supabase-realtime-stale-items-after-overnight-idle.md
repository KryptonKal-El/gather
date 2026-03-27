# Supabase Realtime: Stale Items After Overnight Idle

## Problem

When the web app is left open overnight and the user returns:
1. Switching between lists shows the wrong items
2. The list header/selection updates correctly, but items displayed are from the previous list
3. Console shows repeated `InvalidJWTToken: Token has expired` errors

## Root Cause

Three-part failure chain:

1. **JWT expires after long idle** - Supabase access tokens expire (typically 1 hour), triggering background token refresh
2. **Realtime channels break silently** - Existing Supabase Realtime channels were established with the old JWT and don't automatically re-authenticate when the token refreshes
3. **No fail-closed behavior on list switch** - When switching lists, if the new subscription fails, the old `activeItems` state persists, showing stale items from the previous list

## Fix

### 1. Track session version for resubscription (AuthContext.jsx)

Added `sessionVersion` counter that increments on `TOKEN_REFRESHED` events. This signals downstream contexts to recreate subscriptions.

```javascript
const [sessionVersion, setSessionVersion] = useState(0);
const lastAccessTokenRef = useRef(null);

// In onAuthStateChange:
if (previousToken && currentToken !== previousToken && event === 'TOKEN_REFRESHED') {
  setSessionVersion((v) => v + 1);
}
```

### 2. Fail-closed behavior on list switch (ShoppingListContext.jsx)

When switching lists, immediately clear items and set loading state BEFORE starting the new subscription:

```javascript
// Immediately clear items and set loading (fail-closed: never show stale items)
setActiveItems([]);
setActiveItemsLoading(true);
```

### 3. Resubscribe on token refresh (ShoppingListContext.jsx)

All subscription effects now include `sessionVersion` in their dependency arrays:

```javascript
useEffect(() => {
  // ... subscription logic
}, [userId, activeListId, sessionVersion]); // sessionVersion triggers resubscription
```

### 4. Graceful auth error handling (database.js)

Subscription functions now return empty arrays on JWT/auth errors instead of leaving state unchanged:

```javascript
if (error.message?.includes('JWT') || error.code === 'PGRST301') {
  callback([]);
}
```

## Files Changed

- `src/context/AuthContext.jsx` - Added `sessionVersion` signal
- `src/context/ShoppingListContext.jsx` - Fail-closed behavior, loading state, sessionVersion dependency
- `src/services/database.js` - Auth error handling in subscriptions

## Behavior After Fix

- Switching lists always clears items first (no stale items ever shown)
- Loading indicator shown while items fetch
- Token refresh automatically triggers all subscriptions to recreate
- Auth errors result in empty state (fail-closed) rather than stale data
