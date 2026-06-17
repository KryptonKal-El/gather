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

### Previous fix (now removed — see below)

An explicit `getSession()` fallback was added after registering `onAuthStateChange`. This was later removed: supabase-js v2 already delivers the current session via the `INITIAL_SESSION` event, so the extra call was redundant and added lock churn.

## The real remaining bug: deadlock inside `onAuthStateChange` (fixed 2026-06)

Even with `processLock`, the app still got stuck on "Loading..." intermittently, needing 2–3 refreshes. Root cause: the `onAuthStateChange` callback was `async` and `await`ed `fetchProfile()` (a `supabase.from('profiles')` query) **inside the callback**. supabase-js invokes that callback *while holding the auth lock* during `INITIAL_SESSION`/token refresh; the profile query then needs the same lock to read the token → re-entrant acquire on the non-reentrant `processLock` → **deadlock**. The callback never returns, so `setIsLoading(false)` never runs.

Intermittent because it only deadlocks when the stored token needs refreshing on load (e.g. after idle). Fresh token → no lock held during the callback → loads fine.

### Fix (the rule: never call Supabase inside `onAuthStateChange`)
- Keep the `onAuthStateChange` callback **synchronous** — set a base user from the `session` object and flip `isLoading` false; do not await anything.
- Fetch the profile in a **separate `useEffect`** keyed on `user.id` (outside the lock), then merge it in.
- Dropped the redundant `getSession()` (rely on `INITIAL_SESSION`).
- Added a 5s loading failsafe so the app can never hang on the loading screen permanently.

This same deadlock is also why DB **writes** wedged after the tab sat idle (token refresh on next op contended the lock). See `AuthContext.jsx`.

## Tradeoff

`processLock` doesn't synchronize across browser tabs. If the app is opened in multiple tabs simultaneously, concurrent token refreshes could theoretically race. For a PWA that's typically single-tab, this is acceptable. If multi-tab support becomes important, consider switching back to `navigatorLock` with a reduced `lockAcquireTimeout` (e.g., 500ms).
