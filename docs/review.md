# Critic Review — US-004 through US-008 (Checkpoint)

**PRD:** prd-supabase-migration  
**Stories Reviewed:** US-004, US-005, US-006, US-007, US-008  
**Review Date:** 2026-02-27  
**Reviewer:** Critic Agent

---

## Summary

This review covers the Supabase migration work from US-004 through US-008, including:
- CRUD service layer (`database.js`)
- Real-time subscriptions
- RLS policies
- Storage migration (`imageStorage.js`)
- Edge Function (`search-images/index.ts`)
- Image search client (`imageSearch.js`)
- Context updates (`ShoppingListContext.jsx`)

The implementation is **well-structured** with consistent patterns. There are **4 critical issues** requiring fixes before proceeding to US-009.

---

## Critical Issues

### CRITICAL-1: RLS policy gap — `increment_item_count` allows negative counts

**File:** `supabase/migrations/20260227220000_rls_policies.sql`  
**Lines:** 183-206

**Description:** The `increment_item_count` function has an access check but lacks validation to prevent `item_count` from going negative. An attacker with shared list access could call with a large negative value to corrupt data.

**Impact:** Data corruption, UI showing negative item counts.

**Fix:** Add floor validation:
```sql
UPDATE lists
SET item_count = GREATEST(0, item_count + amount)
WHERE id = p_list_id;
```

---

### CRITICAL-2: `item_count` tracking is inconsistent across operations

**Files:** `src/services/database.js`, `src/context/ShoppingListContext.jsx`

**Description:** The `item_count` tracking has race conditions and inconsistencies:
1. `addItem` (database.js:193) increments count in service layer
2. `removeItem` (context:286-288) decrements in context layer, only if item found AND unchecked
3. `clearCheckedItems` does not decrement (assumes items were already "checked" = decremented)
4. If `activeItems` doesn't contain the item (race with real-time), count is not adjusted

**Impact:** `item_count` drifts from reality over time, especially with concurrent users.

**Recommendation:** Use a database trigger to maintain `item_count` atomically:
```sql
CREATE OR REPLACE FUNCTION update_item_count_on_insert()
RETURNS trigger AS $$
BEGIN
  UPDATE lists SET item_count = item_count + 1 WHERE id = NEW.list_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_item_count_on_delete()
RETURNS trigger AS $$
BEGIN
  IF NOT OLD.is_checked THEN
    UPDATE lists SET item_count = item_count - 1 WHERE id = OLD.list_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER items_insert_count AFTER INSERT ON items
  FOR EACH ROW EXECUTE FUNCTION update_item_count_on_insert();

CREATE TRIGGER items_delete_count AFTER DELETE ON items
  FOR EACH ROW EXECUTE FUNCTION update_item_count_on_delete();
```

---

### CRITICAL-3: Edge Function CORS allows all origins

**File:** `supabase/functions/search-images/index.ts`  
**Lines:** 6-9

**Description:** CORS header `'Access-Control-Allow-Origin': '*'` allows any domain to call the function and consume your SerpAPI quota.

**Impact:** API abuse; quota exhaustion; cost exposure.

**Fix:** Restrict to your domains:
```typescript
const ALLOWED_ORIGINS = [
  'https://your-app.vercel.app',
  'http://localhost:4000',  // dev
];

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});
```

---

### CRITICAL-4: vite.config.js still caches Firebase domains (dead code)

**File:** `vite.config.js`  
**Lines:** 70-109

**Description:** PWA workbox configuration still references `firestore.googleapis.com` and `firebasestorage.googleapis.com` caching rules. This is explicitly listed as an acceptance criterion for US-009 but should be fixed now to avoid confusion.

**Impact:** Bloated service worker; confusing dead code; must fix for US-009 anyway.

**Fix:** Remove lines 70-109 (Firebase caching rules) and add Supabase domain caching if needed.

---

## Important Issues

### IMPORTANT-1: Missing timeouts on Supabase operations

**File:** `src/services/database.js` (all async functions)

**Description:** No timeouts configured. If Supabase hangs, UI waits indefinitely.

**Recommendation:** Add a global fetch timeout via custom fetch in Supabase client init:
```javascript
const supabase = createClient(url, key, {
  global: {
    fetch: (input, init) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      return fetch(input, { ...init, signal: controller.signal })
        .finally(() => clearTimeout(timeout));
    }
  }
});
```

---

### IMPORTANT-2: `saveStoreOrder` makes N sequential requests

**File:** `src/services/database.js`  
**Lines:** 758-772

**Description:** Reordering stores makes N sequential UPDATE calls. Slow with many stores; non-atomic on partial failure.

**Fix:** Use upsert for batch update:
```javascript
const updates = stores.map((store, i) => ({
  id: store.id,
  user_id: userId,
  name: store.name,
  color: store.color,
  categories: store.categories,
  sort_order: i,
}));
const { error } = await supabase
  .from('stores')
  .upsert(updates, { onConflict: 'id' });
```

---

### IMPORTANT-3: `subscribeSharedListRefs` makes 2 sequential queries

**File:** `src/services/database.js`  
**Lines:** 522-573

**Description:** Fetches shares, then fetches lists in separate query. Creates 2 round trips on every update.

**Recommendation:** Create a Postgres view or denormalize `list_name` into `list_shares`.

---

### IMPORTANT-4: Real-time subscriptions re-fetch everything on any change

**File:** `src/services/database.js` (all 7 subscriptions)

**Description:** On any `postgres_changes` event, the callback re-fetches the entire dataset instead of using the event payload for incremental updates.

**Impact:** Unnecessary bandwidth; scales poorly with large lists.

**Track for later:** This is a significant refactor. Document as tech debt.

---

### IMPORTANT-5: `addItemsAction` adds history entries sequentially

**File:** `src/context/ShoppingListContext.jsx`  
**Lines:** 266-269

**Description:** Adding 20 items makes 20 sequential history INSERT calls.

**Fix:** Create `addHistoryEntries` batch function:
```javascript
export const addHistoryEntries = async (userId, names) => {
  const rows = names.map(name => ({ user_id: userId, name }));
  await supabase.from('history').insert(rows);
};
```

---

### IMPORTANT-6: `imageSearch.js` fails silently

**File:** `src/services/imageSearch.js`  
**Lines:** 14-38

**Description:** When edge function URL is missing or fetch fails, returns empty array with only console error. User sees no indication.

**Fix:** Return structured error or throw:
```javascript
export const searchImages = async (query, count = 8) => {
  const baseUrl = import.meta.env.VITE_SUPABASE_EDGE_FUNCTION_URL;
  if (!baseUrl) {
    throw new Error('Image search not configured');
  }
  // ...
```

---

## Minor Issues

### MINOR-1: Stale docstring references Firestore

**File:** `src/context/ShoppingListContext.jsx`  
**Lines:** 42-44

**Description:** Comment says "Subscribes to Firestore real-time listeners" but now uses Supabase.

**Fix:** Update to "Subscribes to Supabase Realtime listeners".

---

### MINOR-2: `deleteItemImage` tries 4 extensions

**File:** `src/services/imageStorage.js`  
**Lines:** 43-49

**Description:** Tries to delete `.jpg`, `.jpeg`, `.png`, `.webp` because extension is unknown. 3 of 4 calls always fail.

**Recommendation:** Store extension in database or accept as minor inefficiency.

---

### MINOR-3: Empty catch in `deleteItemImage`

**File:** `src/services/imageStorage.js`  
**Lines:** 50-52

**Description:** Silently catches all errors, could hide real issues.

**Fix:** Log unexpected errors:
```javascript
} catch (err) {
  if (err?.message && !err.message.includes('not found')) {
    console.warn('Unexpected error deleting item image:', err);
  }
}
```

---

### MINOR-4: Missing PropTypes on `ShoppingListProvider`

**File:** `src/context/ShoppingListContext.jsx`

**Description:** Per AGENTS.md, React components should have PropTypes. `children` prop not validated.

**Fix:**
```javascript
import PropTypes from 'prop-types';
// ...
ShoppingListProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
```

---

## What's Done Well

1. **Comprehensive RLS policies** — All 6 tables have RLS with appropriate owner/shared access patterns. The `increment_item_count` RPC includes access verification.

2. **Consistent snake_case/camelCase mapping** — All CRUD functions transform correctly in both directions.

3. **JSDoc on all exports** — Proper documentation as required by conventions.

4. **Error context** — All error messages include relevant IDs (`listId`, `itemId`, etc.) with `{ cause: error }`.

5. **Subscription cleanup** — All subscribe functions return proper cleanup functions.

6. **Storage policies correctly scoped** — Path-based access using `(storage.foldername(name))[1] = auth.uid()::text`.

7. **Edge Function structure** — Clean error handling, proper HTTP status codes, type annotations.

8. **Email normalization** — Consistent `toLowerCase().trim()` on email in sharing functions.

9. **Unique constraint on shares** — `UNIQUE (list_id, shared_with_email)` prevents duplicates.

10. **API compatibility preserved** — Function signatures match old Firestore API for drop-in replacement.

---

## Requirements Traceability

| Story | Status | Notes |
|-------|--------|-------|
| US-004 | Partial | CRUD correct but `item_count` tracking has issues |
| US-005 | Pass | All 7 subscriptions with unique channels and cleanup |
| US-006 | Partial | RLS comprehensive but `increment_item_count` needs floor check |
| US-007 | Pass | Storage upload/delete working; policies correct |
| US-008 | Partial | Edge function works but CORS too permissive |

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 4 |
| Important | 6 |
| Minor | 4 |
| Positive | 10 |

---

## Action Items

### Must Fix Before US-009

| Issue | Effort | Owner |
|-------|--------|-------|
| CRITICAL-1: Negative item_count | Low | Database migration |
| CRITICAL-2: item_count consistency | Medium | Database triggers |
| CRITICAL-3: Edge Function CORS | Low | Edge function |
| CRITICAL-4: Firebase caching rules | Low | vite.config.js |

### Should Fix Soon

| Issue | Effort |
|-------|--------|
| IMPORTANT-1: Supabase timeouts | Low |
| IMPORTANT-2: saveStoreOrder batch | Low |
| IMPORTANT-5: History batch insert | Low |
| IMPORTANT-6: imageSearch error UX | Low |
| MINOR-1: Stale docstring | Trivial |

### Track as Tech Debt

| Issue | Impact |
|-------|--------|
| IMPORTANT-3: N+2 queries for shared lists | Performance |
| IMPORTANT-4: Re-fetch on every change | Bandwidth/scale |
