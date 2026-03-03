# Supabase Auth: Page Refresh Session Restoration

## Problem

On page refresh, the app would show "Loading..." for ~500ms, then display the login page even though the user was authenticated. A second refresh would sometimes work.

## Cause

`AuthContext.jsx` relied solely on `onAuthStateChange` to detect the session. On page refresh, the listener fired `INITIAL_SESSION` with `session = null` before the Supabase client finished restoring the session from localStorage. The code had a 500ms `setTimeout` hack waiting for a `TOKEN_REFRESHED` event that never came, then gave up and showed the login page.

## Fix

Added an explicit `getSession()` call as a fallback after registering `onAuthStateChange`. This is the [Supabase-recommended pattern](https://supabase.com/docs/reference/javascript/auth-onauthstatechange). `getSession()` reads directly from localStorage and resolves in ~50ms.

The 500ms `setTimeout` and 10s safety timeout were removed — `getSession()` always resolves and sets `isLoading = false`.

## Key Pattern

```jsx
// Register listener first
const { data: { subscription } } = supabase.auth.onAuthStateChange(...);

// Then explicitly check session as fallback
const { data: { session } } = await supabase.auth.getSession();
```

Both paths are safe to race — React batches the state updates.
