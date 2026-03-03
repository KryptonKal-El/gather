# Supabase Auth: Page Refresh Session Restoration

## Problem

On page refresh, the app shows "Loading..." for ~5 seconds, then finally resolves to the dashboard. In some cases it showed the login page instead.

## Root Cause

React Strict Mode double-mount + Supabase navigator lock contention.

Timeline on every refresh:
1. First mount acquires a Web Locks API lock on the auth token
2. Strict Mode unmounts the first instance — lock is orphaned (cleanup unsubscribes but can't release the Supabase-internal navigator lock)
3. Second mount's `getSession()` blocks for **5000ms** waiting for the orphaned lock
4. After 5s timeout, Supabase force-steals the lock and resolves
5. User sees "Loading..." for the entire 5 seconds

The Supabase error message confirms it:
> `Lock "lock:sb-...-auth-token" was not released within 5000ms. This may indicate an orphaned lock from a component unmount (e.g., React Strict Mode).`

## Fix

Configured the Supabase client to use `processLock` (in-process mutex) instead of the default `navigatorLock` (Web Locks API). This avoids the cross-tab lock that gets orphaned by Strict Mode.

```javascript
import { processLock } from '@supabase/auth-js';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: processLock,
  },
});
```

### Why processLock works

- `processLock` is an in-process mutex exported by `@supabase/auth-js` (the same package that provides `navigatorLock`)
- It doesn't use the Web Locks API, so there's no cross-tab lock to orphan
- For a single-tab PWA, cross-tab lock synchronization isn't needed
- Session restores in ~50ms instead of ~5000ms

### Previous fix (still in place, still helpful)

Added an explicit `getSession()` call as a fallback after registering `onAuthStateChange`. This is the Supabase-recommended pattern and provides fast session resolution even without the lock fix.

## Tradeoff

`processLock` doesn't synchronize across browser tabs. If the app is opened in multiple tabs simultaneously, concurrent token refreshes could theoretically race. For a PWA that's typically single-tab, this is acceptable. If multi-tab support becomes important, consider switching back to `navigatorLock` with a reduced `lockAcquireTimeout` (e.g., 500ms).
