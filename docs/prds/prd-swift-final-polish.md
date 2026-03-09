# PRD: Native Swift iOS App — Phase 8: Smart Suggestions, Offline Cache, Deep Links & Capacitor Retirement

**ID:** prd-swift-final-polish  
**Status:** Ready  
**Created:** 2026-03-09  
**Priority:** High  
**Phase:** 8 of 8  
**Depends On:** prd-swift-settings-images (Phase 7)

## Overview

The final phase of the native Swift iOS rebuild. Adds the smart suggestions engine (pairing-based, frequency-based, recency-based), basic offline read caching with stale data indicators, deep link / Universal Link handling for auth callbacks, and retires the Capacitor WebView app. After this phase, the Swift app reaches full feature parity with the React PWA and replaces the Capacitor shell entirely.

This PRD is **Swift-only** — the React PWA is unaffected. Both codebases share the same Supabase backend. No backend changes are needed.

## Design Decisions (User-Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Suggestions algorithm | **Direct port of React logic** (A) | Pairings + frequency + recency, same 18 item pairs, same priority order |
| Offline support | **Basic offline read** (B) | Cache last-fetched data locally, show stale indicator when offline, no write queue |
| Capacitor retirement | **Include as final Phase 8 story** (A) | Clean break — ship native, remove Capacitor dependency |

## Context: What Already Exists

### React Suggestions Engine (to port)

The React app's suggestion system (`src/services/suggestions.js`) uses three strategies in priority order:

1. **Pairing-based:** 18 hardcoded item pairs (bread↔butter, pasta↔tomato sauce, etc.). If one item is in the current list, suggest the other. Bidirectional.
2. **Frequency-based:** Count occurrences in history. Items purchased ≥2 times that aren't in the current list. Sorted by count descending, top 20 candidates.
3. **Recency-based:** Last 30 history entries, deduplicated, reversed (most recent first). Items not in current list.

Each suggestion has: `name`, `reason` (e.g., "Often bought together", "Purchased 5 times before", "Recently purchased"), and `category` (auto-categorized via `categorizeItem()`).

Max 8 suggestions returned. Deduplication: once a name is added from any strategy, it's not added again.

### React Suggestions UI (`src/components/Suggestions.jsx`)

- Displayed above the shopping list items
- Header: "AI Suggestions" with subtitle "Based on your shopping habits"
- Chips in a grid: category-colored dot + name + reason text + "+" button
- Collapsible: shows 4 initially, "Show N more" expands to full list
- Tapping "+" adds the item to the current list (same as typing + enter)

### 18 Item Pairings (exact match from React)

```
bread ↔ butter, pasta ↔ tomato sauce, chips ↔ salsa,
hamburger buns ↔ ground beef, hot dog buns ↔ hot dogs,
cereal ↔ milk, peanut butter ↔ jelly, eggs ↔ bacon,
lettuce ↔ tomatoes, tortillas ↔ cheese, rice ↔ beans,
spaghetti ↔ parmesan, coffee ↔ cream, crackers ↔ cheese,
avocado ↔ lime, chicken ↔ rice, salmon ↔ lemon, steak ↔ potatoes
```

### Deep Links (React Capacitor pattern)

`AppUrlListener.jsx` listens for `appUrlOpen` events on native platforms. When a URL contains `auth/callback` or `#access_token`, it extracts `access_token` and `refresh_token` from the URL fragment and calls `supabase.auth.setSession()`. This handles OAuth redirect flows (Apple Sign-In via web, email confirmation links, etc.).

The Swift equivalent uses SwiftUI's `.onOpenURL` modifier to receive Universal Links directed at `gatherlists.com/auth/callback`.

### Swift Codebase (what Phase 8 builds on)

- **`CategoryDefinitions.categorizeItem(_:)`** (Phase 3): Already ported — reusable for suggestion category assignment.
- **`HistoryService`** (Phase 3): `fetchHistory(userId:)` returns `[HistoryEntry]` with `name` and `addedAt`. Realtime subscription exists.
- **`ListDetailViewModel`** (Phase 3): Has `history`, `items` (unchecked + checked), and `addItem()` method.
- **`NetworkMonitor`** (Phase 7): `isConnected` boolean, injected via `.environment()`.
- **`GatherListsApp.swift`:** Root app struct where `.onOpenURL` would be added.
- **`AuthViewModel`:** Has `signInWithApple`, `signInWithEmail`, `checkSession` — but no `setSession(accessToken:refreshToken:)` equivalent yet.
- **Entitlements** (Phase 1): Associated domains already configured for `gatherlists.com`.

---

## User Stories

### US-001: SuggestionEngine — Port React Algorithm to Swift

**As a** user  
**I want** smart item suggestions based on my shopping patterns  
**So that** I don't forget commonly purchased items

**Acceptance Criteria:**
- Create `SuggestionEngine` with:
  - Static `ITEM_PAIRINGS: [(String, String)]` — all 18 pairs from React, exact strings
  - `getSuggestions(history:currentItems:maxSuggestions:) -> [ItemSuggestion]`
  - `ItemSuggestion` struct: `name: String`, `reason: String`, `category: String`
- Algorithm matches React exactly:
  1. Build `currentNames: Set<String>` (lowercased) from current items
  2. **Pairings:** For each pair, if one side is in `currentNames` and other is not, suggest the other with reason "Often bought together"
  3. **Frequency:** Count all history entries by lowercased name. Take top 20 by count. For each with count ≥ 2 that's not in `currentNames` or already suggested, add with reason "Purchased N times before"
  4. **Recency:** Take last 30 history entries, reverse, deduplicate (preserving first occurrence). For each not in `currentNames` or already suggested, add with reason "Recently purchased"
  5. Deduplicate across all three strategies (first-wins by lowercased name)
  6. Auto-categorize each via `CategoryDefinitions.categorizeItem()`
  7. Return up to `maxSuggestions` (default 8)
- Case-insensitive matching throughout

### US-002: SuggestionsView — Chip Grid UI

**As a** user  
**I want** to see and tap suggestion chips  
**So that** I can quickly add recommended items

**Acceptance Criteria:**
- `SuggestionsView` component:
  - Header: "AI Suggestions" bold title + "Based on your shopping habits" secondary subtitle
  - Grid of chips, each showing: category-colored circle (8pt) + item name + reason text (smaller, secondary) + "+" icon
  - Tapping a chip calls `onAdd(name:)` callback
  - Collapsible: initially shows 4 chips; if more exist, "Show N more" button expands to full list; toggles to "Show less"
  - If no suggestions, render nothing (hidden)
- Chip styling: rounded rect, surface background, subtle border, category dot color from `CategoryDefinitions`

### US-003: ListDetailView — Wire Suggestions

**As a** user  
**I want** suggestions displayed above my shopping list  
**So that** I see recommendations without scrolling

**Acceptance Criteria:**
- In `ListDetailView`, compute suggestions via `SuggestionEngine.getSuggestions()`:
  - Pass `history` (from `ListDetailViewModel`) and `items` (all unchecked items)
  - Recompute when items or history change
- Display `SuggestionsView` above the item list (below the add-item bar, above the first store/category group)
- `onAdd` handler: call `viewModel.addItem(name:)` — same as manual add
- Suggestions section is collapsible with `collapsible: true`
- If the list has 0 history entries, suggestions section is hidden entirely

### US-004: OfflineCache — Local Data Persistence

**As a** user  
**I want** to see my lists and items when offline  
**So that** I can reference my shopping list in stores with poor signal

**Acceptance Criteria:**
- Create `OfflineCache` using `FileManager` + JSON encoding:
  - `save<T: Encodable>(key:data:)` → encode to JSON, write to app's caches directory
  - `load<T: Decodable>(key:) -> T?` → read from caches directory, decode
  - Keys: `lists-{userId}`, `items-{listId}`, `stores-{userId}`, `history-{userId}`
  - Each cached entry includes `cachedAt: Date` timestamp
- Cache writes happen automatically after every successful Supabase fetch (non-blocking, background)
- Thread-safe access (actor or serial queue)

### US-005: ViewModels — Cache Integration

**As a** user  
**I want** cached data displayed instantly while fresh data loads  
**So that** I don't see empty screens on slow connections

**Acceptance Criteria:**
- `ListViewModel`: On init, load cached lists immediately, then fetch from Supabase. If fetch succeeds, update cache. If fetch fails (offline), keep cached data.
- `ListDetailViewModel`: On init, load cached items for the active list, then fetch. Same fallback pattern.
- `StoreViewModel`: Same pattern for stores.
- When showing cached data and `NetworkMonitor.isConnected` is false, set a `isShowingCachedData: Bool` flag
- When connection returns and fresh data loads, clear the flag and update cache

### US-006: Stale Data Indicator

**As a** user  
**I want** to know when I'm viewing cached data  
**So that** I understand the information might be outdated

**Acceptance Criteria:**
- When `isShowingCachedData` is true on any view model:
  - Show a subtle banner below the navigation title: "Showing cached data · Last updated [relative time]"
  - Light yellow/amber background, small text
  - Relative time: "just now", "5m ago", "1h ago", "yesterday", etc. (from `cachedAt` timestamp)
- Banner disappears immediately when fresh data loads
- Banner appears below the offline banner (from Phase 7) if both are visible — offline banner takes priority position

### US-007: DeepLinkHandler — onOpenURL for Auth Callbacks

**As a** user  
**I want** auth callbacks handled when the app opens via Universal Link  
**So that** email confirmation and OAuth flows complete seamlessly

**Acceptance Criteria:**
- Add `.onOpenURL` modifier to the root `WindowGroup` in `GatherListsApp.swift`
- When URL contains `auth/callback` or fragment `#access_token`:
  - Parse URL fragment to extract `access_token` and `refresh_token`
  - Call `SupabaseManager.shared.client.auth.session(from:)` or manually set session via `setSession(accessToken:refreshToken:)`
  - `AuthViewModel` will pick up the change via `authStateChanges` listener
- When URL doesn't match auth patterns: ignore (log for debugging)
- Handle both `https://gatherlists.com/auth/callback#...` and `gather://auth/callback#...` URL schemes

### US-008: AuthViewModel — setSession Support

**As a** developer  
**I want** AuthViewModel to support setting sessions from deep links  
**So that** auth flows that redirect back to the app work correctly

**Acceptance Criteria:**
- Add `handleDeepLink(url:)` method to `AuthViewModel`:
  - Parse the URL for auth callback indicators
  - Extract tokens from URL fragment
  - Call Supabase SDK's session restoration method
  - The existing `authStateChanges` listener handles the rest (updates `isAuthenticated`, `currentUser`, fetches profile)
- Handle errors gracefully — if tokens are invalid, log and ignore (user stays on login screen)

### US-009: RecipeViewModel — Offline Cache

**As a** user  
**I want** my recipes and collections viewable offline  
**So that** I can reference recipes while cooking without internet

**Acceptance Criteria:**
- `RecipeViewModel`: Load cached collections + recipes on init, then fetch fresh
- Cache key: `collections-{userId}`, `recipes-{collectionId}`
- Same `isShowingCachedData` pattern as US-005
- Stale data indicator in `CollectionBrowserView` and `CollectionRecipeListView`

### US-010: Kill Capacitor — Remove WebView Shell

**As a** developer  
**I want** to remove the Capacitor iOS app configuration  
**So that** we ship only the native Swift app

**Acceptance Criteria:**
- Remove `ios/` directory (the Capacitor Xcode project)
- Remove Capacitor dependencies from `package.json`: `@capacitor/app`, `@capacitor/core`, `@capacitor/ios`, `@capacitor/splash-screen`, `@capacitor/status-bar`, `@capacitor-community/apple-sign-in`
- Remove `capacitor.config.ts`
- Remove `AppUrlListener.jsx` component and its usage in `App.jsx`
- Remove Capacitor platform checks: any `Capacitor.isNativePlatform()` guards, `Capacitor.getPlatform()` checks
- Update `vite.config.js` if it has Capacitor-specific config
- Update `usePWAInstall.js` to remove Capacitor platform detection (PWA install banner should show on all web platforms)
- Run `npm install` to update lockfile
- Run `npm run build` to verify React app still builds
- **Keep:** `public/.well-known/apple-app-site-association` (still needed for the native Swift app's Universal Links)
- **Keep:** The React PWA continues to work at `gatherlists.com` for web/desktop users

### US-011: Post-Capacitor Cleanup — Verify React PWA

**As a** developer  
**I want** the React PWA verified after Capacitor removal  
**So that** web users are unaffected

**Acceptance Criteria:**
- `npm run build` succeeds with zero errors
- No runtime imports of `@capacitor/*` packages remain in the bundle
- PWA install banner still works on Android (via `beforeinstallprompt`) and iOS Safari (instructional)
- Apple Sign-In still works via web OAuth redirect (Supabase handles the redirect, not Capacitor)
- All Supabase auth flows (sign-in, sign-up, sign-out) work in the browser
- Service worker registration still functions
- No console errors related to missing Capacitor plugins

---

## Technical Notes

### Suggestions Performance

The suggestion engine runs synchronously on the main actor since it's pure computation over in-memory arrays. For typical history sizes (< 1000 entries), this completes in < 1ms. If performance becomes an issue with very large histories, the computation can be moved to a background task.

### Offline Cache Storage

Using the app's `cachesDirectory` means iOS can purge these files under storage pressure — this is acceptable since the data is a cache of server state, not user-generated content. The cache acts as a read-through layer:

```
Launch → Load cache (instant) → Show cached data → Fetch Supabase (async) → Update UI + cache
                                                  ↳ If fetch fails → Keep cached data, show stale indicator
```

### Capacitor Removal Scope

The Capacitor removal is **additive for the React codebase** — it removes code. The `ios/` directory is ~50 files of generated Xcode project. The npm packages to remove are dev/build dependencies. The React app itself gains simplicity: no more platform branching, no more native plugin imports.

The native Swift app at `ios-native/` is completely independent and unaffected by Capacitor removal.

### Deep Link URL Parsing

Universal Links arrive as `https://gatherlists.com/auth/callback#access_token=...&refresh_token=...`. The Supabase Swift SDK may handle this natively via `Auth.handle(_:)` or similar. Check SDK docs before implementing manual parsing — the SDK may have a built-in handler.

---

## Credential & Service Access Plan

No external credentials required for this PRD. All functionality uses the existing Supabase project (database, storage, realtime, auth, edge functions). No new services or API keys are needed.

## Definition of Done

Implementation is complete when:

1. Smart suggestions appear above the shopping list with pairing, frequency, and recency reasons
2. Suggestion chips show category-colored dots and are collapsible (4 initially, expandable)
3. Tapping a suggestion chip adds the item to the current list
4. Suggestions algorithm matches React: 18 pairings, frequency ≥ 2 threshold, last 30 recency, max 8
5. Lists, items, stores, and recipes are cached locally after each successful fetch
6. When offline, cached data displays immediately with a "Showing cached data" indicator
7. When connection returns, fresh data loads and cache updates
8. Universal Links to `gatherlists.com/auth/callback` are handled — tokens extracted and session set
9. Auth callback deep links complete the sign-in flow without user intervention
10. `ios/` directory (Capacitor project) is removed
11. All Capacitor npm packages are removed from `package.json`
12. `AppUrlListener.jsx` and all `Capacitor.isNativePlatform()` references are removed
13. `npm run build` succeeds after Capacitor removal
14. React PWA continues to work for web/desktop users (auth, lists, recipes, PWA install)
15. No regression in Phases 1–7 Swift functionality
16. Build succeeds for both React (`npm run build`) and Swift (Xcode)
