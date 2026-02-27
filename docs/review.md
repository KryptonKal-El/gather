# Critic Review: Firebase to Supabase Migration (US-001 through US-003)

**PRD**: Firebase to Supabase Backend Migration  
**Stories Reviewed**: US-001 (Database Schema), US-002 (Supabase Client), US-003 (Auth Migration)  
**Review Date**: 2026-02-27  
**Reviewer**: Critic Agent

---

## Summary

The migration covers database schema creation, Supabase client setup, and authentication context rewrite. The schema and auth implementations are **well-structured** but there are **critical runtime issues** due to incomplete migration — specifically, files still import from the now-deleted `firebase.js` and `firestore.js`. These must be fixed before the app can run.

---

## Critical Issues

### CRITICAL-1: `src/services/imageStorage.js` still imports from Firebase (RUNTIME ERROR)
**File**: `src/services/imageStorage.js` (lines 5-7)  
**Impact**: App crashes on startup; module not found  

```javascript
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { storage } from './firebase.js';
```

**Problem**: These imports reference the deleted `firebase.js` and removed `firebase` package. The file was not migrated in US-001 through US-003 (it's scheduled for US-007), but `MobileSettings.jsx` imports from it NOW:

```javascript
import { uploadProfileImage } from '../services/imageStorage.js';
```

This causes an immediate runtime crash when loading MobileSettings.

**Recommendation**: Either:
1. **Stub the export** in `imageStorage.js` temporarily (throw "not yet migrated") so the import doesn't crash
2. **Remove the import** from `MobileSettings.jsx` until US-007 completes
3. **Disable the profile upload UI** in MobileSettings until storage is migrated

---

### CRITICAL-2: `src/context/ShoppingListContext.jsx` still imports from Firebase (RUNTIME ERROR)
**File**: `src/context/ShoppingListContext.jsx` (lines 7, 11-33)  
**Impact**: App crashes on startup; module not found  

```javascript
import { increment } from 'firebase/firestore';
// ...
import {
  subscribeLists,
  subscribeItems,
  // ... many more
} from '../services/firestore.js';
```

**Problem**: The `firestore.js` service file still exists and imports from Firebase. The entire shopping list functionality is broken until US-004 (Firestore migration) and US-005 (real-time subscriptions) are complete.

**Recommendation**: The PRD correctly has these as separate stories, but the auth migration (US-003) is not truly usable until the data layer works. Consider:
1. **Completing US-004 as part of the same commit batch** (these are tightly coupled)
2. **Or** create a minimal stub that returns empty arrays so the app runs without data

---

### CRITICAL-3: `user.uid` vs `user.id` mismatch in ShoppingListContext
**File**: `src/context/ShoppingListContext.jsx` (line 47)  
**Impact**: All data queries fail silently (wrong user ID)  

```javascript
const userId = user?.uid ?? null;
```

**Problem**: Supabase auth returns `user.id`, not `user.uid`. Firebase used `uid`. This was NOT updated in ShoppingListContext, even though `App.jsx` and `MobileSettings.jsx` correctly use `user.id`.

**Note**: This file still imports from Firebase (CRITICAL-2), so it won't run yet anyway. But when US-004 is done, this must be `user?.id`.

**Recommendation**: Change to `user?.id ?? null` when migrating ShoppingListContext.

---

### CRITICAL-4: Supabase client doesn't validate env vars
**File**: `src/services/supabase.js` (lines 7-10)  
**Impact**: Cryptic "Cannot read properties of undefined" error if env vars missing  

```javascript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Problem**: If either env var is missing/undefined, `createClient` throws an opaque error. Developers will see "Invalid URL" or similar without knowing which var is missing.

**Recommendation**: Add validation:

```javascript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## Warnings

### WARNING-1: Auth loading state race condition
**File**: `src/context/AuthContext.jsx` (lines 48-62)  
**Severity**: Medium  

```javascript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setUser(mergeUserWithProfile(session.user, profile));
      } else {
        setUser(null);
      }
      setIsLoading(false);
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

**Problem**: `onAuthStateChange` is called asynchronously. If the user navigates quickly or the initial session check is slow, `isLoading` stays `true` indefinitely until the callback fires. Supabase recommends calling `getSession()` immediately for the initial state.

**Recommendation**: Add initial session check:

```javascript
useEffect(() => {
  // Get initial session synchronously
  supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (session?.user) {
      const profile = await fetchProfile(session.user.id);
      setUser(mergeUserWithProfile(session.user, profile));
    }
    setIsLoading(false);
  });

  // Subscribe to future changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setUser(mergeUserWithProfile(session.user, profile));
      } else {
        setUser(null);
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

---

### WARNING-2: Profile fetch may fail for new users (trigger timing)
**File**: `src/context/AuthContext.jsx` (line 52) and migration (lines 85-101)  
**Severity**: Medium  

**Problem**: The `handle_new_user` trigger creates a profile row AFTER the auth.users INSERT completes. But `onAuthStateChange` fires immediately when sign-up succeeds. The profile fetch in AuthContext may race with the trigger, returning null for brand new users.

**Sequence**:
1. `signUp()` -> user created in auth.users
2. `onAuthStateChange` fires with new user
3. `fetchProfile(userId)` -> may return null if trigger hasn't run yet
4. Trigger runs -> profile created

**Recommendation**: Either:
1. Add a small retry/delay in `fetchProfile` for new users
2. Create the profile client-side if `fetchProfile` returns null:

```javascript
let profile = await fetchProfile(session.user.id);
if (!profile && event === 'SIGNED_UP') {
  // Trigger may not have run yet; create profile manually
  await supabase.from('profiles').upsert({
    id: session.user.id,
    display_name: session.user.user_metadata?.full_name,
    email: session.user.email,
  });
  // Re-fetch
  profile = await fetchProfile(session.user.id);
}
```

---

### WARNING-3: `increment_item_count` function lacks RLS
**File**: `supabase/migrations/20260227213403_initial_schema.sql` (lines 105-112)  
**Severity**: Medium  

```sql
CREATE OR REPLACE FUNCTION increment_item_count(p_list_id uuid, amount int)
RETURNS void AS $$
BEGIN
  UPDATE lists
  SET item_count = item_count + amount
  WHERE id = p_list_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Problem**: `SECURITY DEFINER` runs as the function owner (service role), bypassing RLS. Any authenticated user could call this function with any `list_id` to manipulate item counts on lists they don't own.

**Recommendation**: Add ownership check inside the function:

```sql
CREATE OR REPLACE FUNCTION increment_item_count(p_list_id uuid, amount int)
RETURNS void AS $$
BEGIN
  -- Verify caller owns or has access to this list
  IF NOT EXISTS (
    SELECT 1 FROM lists
    WHERE id = p_list_id
    AND (owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM list_shares
      WHERE list_id = p_list_id
      AND shared_with_email = auth.jwt() ->> 'email'
    ))
  ) THEN
    RAISE EXCEPTION 'Access denied to list %', p_list_id;
  END IF;

  UPDATE lists
  SET item_count = item_count + amount
  WHERE id = p_list_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### WARNING-4: Missing unique constraint on list_shares
**File**: `supabase/migrations/20260227213403_initial_schema.sql` (lines 39-45)  
**Severity**: Low  

```sql
CREATE TABLE list_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  shared_with_email text NOT NULL,
  added_at timestamptz DEFAULT now()
);
```

**Problem**: No unique constraint on `(list_id, shared_with_email)`. A user could accidentally share the same list with the same person multiple times, creating duplicate rows.

**Recommendation**: Add a unique constraint:

```sql
CREATE TABLE list_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  shared_with_email text NOT NULL,
  added_at timestamptz DEFAULT now(),
  UNIQUE (list_id, shared_with_email)
);
```

---

### WARNING-5: `handle_new_user` trigger lacks error handling
**File**: `supabase/migrations/20260227213403_initial_schema.sql` (lines 85-96)  
**Severity**: Low  

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Problem**: If the INSERT fails (e.g., due to a constraint violation), the entire user sign-up transaction would fail. The `ON CONFLICT DO NOTHING` clause would make this safer.

**Recommendation**:

```sql
INSERT INTO public.profiles (id, display_name, email)
VALUES (
  NEW.id,
  NEW.raw_user_meta_data->>'full_name',
  NEW.email
)
ON CONFLICT (id) DO NOTHING;
```

---

### WARNING-6: Login error mapping incomplete
**File**: `src/components/Login.jsx` (lines 13-26)  
**Severity**: Low  

```javascript
const friendlyError = (message) => {
  switch (message) {
    case 'Invalid login credentials':
      return 'Incorrect email or password.';
    case 'User already registered':
      return 'An account with this email already exists.';
    // ...
  }
};
```

**Problem**: Supabase error messages can vary by version. Some common ones not mapped:
- `"Email not confirmed"` (if email confirmation enabled later)
- `"Signup is not enabled"` (if auth disabled)
- `"AuthApiError: ..."` wrapper messages

**Recommendation**: Consider a more defensive pattern:

```javascript
const friendlyError = (message) => {
  if (message?.includes('Invalid login credentials')) {
    return 'Incorrect email or password.';
  }
  if (message?.includes('already registered')) {
    return 'An account with this email already exists.';
  }
  // ... etc
  return 'Something went wrong. Please try again.';
};
```

---

## Suggestions

### SUGGESTION-1: Add index on `history.name` for autocomplete performance
**File**: `supabase/migrations/20260227213403_initial_schema.sql`  
**Context**: The history table is used for autocomplete. Searches by name prefix would benefit from an index.

```sql
CREATE INDEX idx_history_name ON history(name text_pattern_ops);
```

---

### SUGGESTION-2: Consider `updated_at` columns for caching/sync
**Files**: All tables  
**Context**: The schema lacks `updated_at` timestamps. These are useful for:
- Client-side cache invalidation
- Conflict resolution in offline-first scenarios
- Debugging data issues

---

### SUGGESTION-3: Add `displayName` field to sign-up flow
**File**: `src/context/AuthContext.jsx` (lines 108-114)  
**Context**: The `signUpWithEmail` function doesn't collect or pass a display name.

```javascript
const signUpWithEmail = async (email, password, displayName = null) => {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: displayName }
    }
  });
  // ...
};
```

---

## What's Done Well

1. **Database Schema**: Well-structured relational design with appropriate foreign keys and ON DELETE CASCADE/SET NULL behavior.

2. **Indexes**: All the right indexes are created (owner_id, list_id, user_id, shared_with_email).

3. **Profile Trigger**: Auto-creating profiles on sign-up via database trigger is the correct pattern for Supabase.

4. **Realtime Setup**: All tables are added to `supabase_realtime` publication, enabling real-time subscriptions.

5. **Auth Context API**: The `useAuth` hook exposes the same methods as before (signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, signOut, refreshUser), maintaining API compatibility.

6. **Profile Merging**: The `mergeUserWithProfile` pattern correctly attaches profile data to the user object for consistent access.

7. **Error Propagation**: Auth functions properly throw errors for callers to handle rather than swallowing them.

8. **PropTypes Updated**: `MobileSettings.jsx` correctly updated PropTypes to reflect new user shape with `user_metadata` and `profile` properties.

9. **User Property Paths**: `App.jsx` and `MobileSettings.jsx` correctly access user properties via the new paths (`user.user_metadata.full_name`, `user.profile.avatar_url`).

10. **Firebase Package Removed**: `package.json` correctly shows `firebase` replaced by `@supabase/supabase-js`.

---

## Requirements Traceability

| Story | Status | Notes |
|-------|--------|-------|
| US-001 | Partial Pass | Schema correct but `increment_item_count` needs RLS check; missing unique constraint on `list_shares` |
| US-002 | Partial Pass | Client works but needs env var validation |
| US-003 | Partial Pass | Auth works but `imageStorage.js` still imports Firebase (blocks MobileSettings); race condition on initial load |

---

## Final Assessment

**Status**: **NOT READY** - Critical blockers must be fixed

### Required Before Testing

| Priority | Issue | Fix |
|----------|-------|-----|
| P0 | CRITICAL-1: imageStorage.js Firebase imports | Stub exports or remove import from MobileSettings |
| P0 | CRITICAL-2: ShoppingListContext Firebase imports | Complete US-004 or stub with empty arrays |
| P0 | CRITICAL-4: Missing env var validation | Add validation in supabase.js |

### Required Before Merge

| Priority | Issue | Fix |
|----------|-------|-----|
| P1 | WARNING-1: Auth loading race | Add `getSession()` call |
| P1 | WARNING-3: increment_item_count RLS bypass | Add ownership check |
| P1 | WARNING-4: Missing unique constraint | Add to list_shares table |

### Post-Merge Follow-ups

- WARNING-2: Profile fetch retry for new users
- WARNING-5: ON CONFLICT DO NOTHING for trigger
- WARNING-6: More robust error message matching

---

## Summary

| Category | Count |
|----------|-------|
| Critical Issues | 4 |
| Warnings | 6 |
| Suggestions | 3 |
| Positive Notes | 10 |

The migration is **well-architected** but **incomplete** for the stories marked as done. The critical issues are straightforward to fix — primarily dealing with files that weren't migrated yet but are imported by migrated files. The database schema is solid with minor security hardening needed.
