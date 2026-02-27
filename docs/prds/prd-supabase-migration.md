# PRD: Firebase to Supabase Backend Migration

## Introduction

Migrate ShoppingListAI's entire backend from Firebase to Supabase. The app currently uses Firebase Auth, Firestore, Firebase Storage, Cloud Functions, and Firebase Hosting. This PRD covers replacing all of those services with Supabase equivalents (Supabase Auth, Postgres, Supabase Storage, Edge Functions) and deploying the frontend to Vercel. This is a big-bang migration — all Firebase services will be replaced in a single effort since the app has no production users and a fresh start is acceptable.

## Goals

- Replace Firebase Auth with Supabase Auth (Google, Apple, email/password sign-in; remove anonymous/guest auth)
- Replace Firestore with Supabase Postgres (relational schema with migration files)
- Replace Firebase Storage with Supabase Storage (item images, profile images)
- Replace Firebase Cloud Functions with Supabase Edge Functions (SerpAPI image search proxy)
- Deploy the frontend to Vercel instead of Firebase Hosting
- Use environment variables for all Supabase configuration (no hardcoded keys)
- Maintain full feature parity — every feature that works today must work after migration
- Preserve all 7 real-time subscriptions using Supabase Realtime (Postgres Changes)
- Implement Row Level Security (RLS) policies equivalent to current Firestore security rules
- Version-control all database schema as Supabase migration files in the repo

## Scope Considerations

- permissions: relevant
  - RLS policies must enforce same access rules as current Firestore security rules (owner access, shared list access)
  - Story coverage: US-003, US-004
- support-docs: not relevant (no production users, no support docs capability)
- ai-tools: not relevant (ai capability is false)

## User Stories

### US-001: Initialize Supabase Project & Database Schema

**Description:** As a developer, I need to set up the Supabase CLI, link the project, and create the relational database schema so all subsequent stories have a database to work with.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** required (`Supabase`, `project URL + anon key + service role key`, `timing: upfront`)

**Acceptance Criteria:**

- [ ] Supabase CLI initialized in project root (`supabase/` directory created)
- [ ] Project linked to existing Supabase project
- [ ] Migration file creates all tables with correct columns, types, and constraints:
  - `profiles` (id uuid PK → auth.users, display_name, email, avatar_url, created_at)
  - `lists` (id uuid PK, owner_id FK → profiles, name, emoji, item_count int default 0, created_at)
  - `list_shares` (id uuid PK, list_id FK → lists, shared_with_email, added_at)
  - `items` (id uuid PK, list_id FK → lists, name, category, is_checked boolean, store_id FK → stores nullable, quantity int, price numeric nullable, image_url text nullable, added_at)
  - `history` (id uuid PK, user_id FK → profiles, name, added_at)
  - `stores` (id uuid PK, user_id FK → profiles, name, color, categories jsonb, sort_order int, created_at)
- [ ] Foreign keys with appropriate ON DELETE CASCADE/SET NULL behavior
- [ ] Indexes on: `lists.owner_id`, `list_shares.shared_with_email`, `list_shares.list_id`, `items.list_id`, `history.user_id`, `stores.user_id`
- [ ] Migration runs successfully via `supabase db push`
- [ ] Lint passes

### US-002: Configure Supabase Client & Environment Variables

**Description:** As a developer, I need to replace the Firebase initialization with a Supabase client so the app connects to the new backend.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** required (`Supabase`, `project URL + anon key`, `timing: upfront`)

**Acceptance Criteria:**

- [ ] `@supabase/supabase-js` installed as a dependency
- [ ] New `src/services/supabase.js` exports a configured Supabase client
- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars used (not hardcoded)
- [ ] `.env.example` updated with Supabase vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_EDGE_FUNCTION_URL`) and Firebase vars removed
- [ ] Old `src/services/firebase.js` removed
- [ ] All Firebase SDK packages removed from `package.json` (`firebase`)
- [ ] Lint passes

### US-003: Migrate Authentication

**Description:** As a user, I want to sign in with Google, Apple, or email/password so I can access my shopping lists, and the app no longer uses Firebase Auth.

**Documentation:** No

**Tools:** No

**Considerations:** permissions

**Credentials:** none (Supabase Auth providers configured via Supabase dashboard)

**Acceptance Criteria:**

- [ ] `src/context/AuthContext.jsx` rewritten to use Supabase Auth
- [ ] Google sign-in works via `supabase.auth.signInWithOAuth({ provider: 'google' })`
- [ ] Apple sign-in works via `supabase.auth.signInWithOAuth({ provider: 'apple' })`
- [ ] Email/password sign-in works via `supabase.auth.signInWithPassword()`
- [ ] Email/password sign-up works via `supabase.auth.signUp()` with email confirmation disabled (immediate access)
- [ ] Anonymous/guest auth removed from the app entirely
- [ ] Auth state listener uses `supabase.auth.onAuthStateChange()`
- [ ] `useAuth()` hook still exposes: `user`, `isLoading`, `signInWithGoogle`, `signInWithApple`, `signInWithEmail`, `signUpWithEmail`, `signOut`, `refreshUser`
- [ ] User properties mapped correctly: `user.id` (was `uid`), `user.email`, `user.user_metadata.full_name` (was `displayName`), `user.user_metadata.avatar_url` (was `photoURL`)
- [ ] A `profiles` row is auto-created on sign-up (via database trigger or `onAuthStateChange` handler)
- [ ] Login error codes mapped to user-friendly messages (Supabase error format differs from Firebase)
- [ ] `src/components/Login.jsx` updated — guest sign-in button removed
- [ ] `src/components/MobileSettings.jsx` updated for new user property paths
- [ ] `src/App.jsx` updated — `isAnonymous` checks removed
- [ ] Firebase Auth imports fully removed from codebase
- [ ] Lint passes
- [ ] Verify in browser
- [ ] Works in both light and dark mode

### US-004: Migrate Firestore to Supabase Postgres (CRUD & Service Layer)

**Description:** As a developer, I need to rewrite the Firestore service layer to use Supabase Postgres so all shopping list, item, store, and history operations work against the new database.

**Documentation:** No

**Tools:** No

**Considerations:** permissions

**Credentials:** none

**Acceptance Criteria:**

- [ ] `src/services/firestore.js` replaced with `src/services/database.js` using Supabase client
- [ ] All CRUD operations migrated:
  - **Lists:** createList, updateList, deleteList (cascade deletes items + shares)
  - **Items:** addItem, addItems (batch insert), updateItem, removeItem, clearCheckedItems
  - **Stores:** createStore, updateStore, deleteStore, saveStoreOrder (batch update)
  - **History:** addHistoryEntry
  - **Sharing:** shareList, unshareList
- [ ] `item_count` increment/decrement handled via Supabase RPC function or direct update
- [ ] Batch writes replaced with Supabase transactions or multi-row operations
- [ ] `serverTimestamp()` replaced with Postgres `DEFAULT now()` or `new Date().toISOString()`
- [ ] `deleteField()` for unsharing replaced with row deletion from `list_shares` table
- [ ] `src/context/ShoppingListContext.jsx` updated to import from new `database.js`
- [ ] `increment` import from `firebase/firestore` removed from `ShoppingListContext.jsx`
- [ ] All Firestore imports fully removed from codebase
- [ ] Lint passes

### US-005: Migrate Real-time Subscriptions

**Description:** As a user, I want my shopping lists, items, and shared lists to update in real-time so I see changes instantly when collaborating, using Supabase Realtime instead of Firestore onSnapshot.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] All 7 real-time listeners migrated to Supabase Realtime (Postgres Changes):
  1. `subscribeLists` — user's owned lists (filter: `owner_id=eq.{userId}`)
  2. `subscribeItems` — items in active list (filter: `list_id=eq.{listId}`)
  3. `subscribeSharedItems` — items in active shared list (same as above, different auth context)
  4. `subscribeList` — single shared list metadata
  5. `subscribeHistory` — user's item history (filter: `user_id=eq.{userId}`)
  6. `subscribeStores` — user's stores (filter: `user_id=eq.{userId}`)
  7. `subscribeSharedListRefs` — lists shared with current user's email (filter: `shared_with_email=eq.{email}`)
- [ ] Subscriptions handle INSERT, UPDATE, and DELETE events
- [ ] Subscriptions return full data payload (enable Realtime for tables in Supabase dashboard or via migration)
- [ ] Subscription cleanup (`.unsubscribe()`) works correctly on component unmount / dependency change
- [ ] `ShoppingListContext.jsx` manages subscriptions via `useEffect` with proper cleanup (same pattern as current)
- [ ] Real-time updates are visually immediate (no perceptible delay vs current Firestore behavior)
- [ ] Lint passes
- [ ] Verify in browser

### US-006: Implement Row Level Security (RLS) Policies

**Description:** As a developer, I need to define RLS policies so users can only access their own data and shared lists, equivalent to the current Firestore security rules.

**Documentation:** No

**Tools:** No

**Considerations:** permissions

**Credentials:** none

**Acceptance Criteria:**

- [ ] RLS enabled on all tables
- [ ] Migration file creates all RLS policies:
  - **profiles:** Users can read/update their own profile only
  - **lists:** Owner has full CRUD; shared users (email in `list_shares`) can read and update
  - **items:** Access follows parent list permissions (owner or shared user of the list)
  - **list_shares:** Owner of the list can insert/delete; recipient can read their own shares
  - **history:** Owner only (full CRUD)
  - **stores:** Owner only (full CRUD)
- [ ] Shared list access verified: user A shares list with user B's email → user B can read/write items on that list
- [ ] Non-owner cannot delete a list or its shares
- [ ] RLS policies use `auth.uid()` and `auth.jwt() ->> 'email'` for identity checks
- [ ] Migration runs successfully via `supabase db push`
- [ ] Lint passes

### US-007: Migrate Firebase Storage to Supabase Storage

**Description:** As a user, I want to upload item images and profile photos that are stored in Supabase Storage instead of Firebase Storage.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Supabase Storage buckets created (via migration or setup script):
  - `item-images` bucket (public read, authenticated write)
  - `profile-images` bucket (public read, authenticated write)
- [ ] Storage policies enforce:
  - Users can upload/delete only in their own path (`{user_id}/`)
  - Public read access for serving images
- [ ] `src/services/imageStorage.js` rewritten to use Supabase Storage:
  - `uploadItemImage` → uploads to `item-images/{userId}/{itemId}.{ext}`
  - `deleteItemImage` → deletes from `item-images/` path
  - `uploadProfileImage` → uploads to `profile-images/{userId}/profile.jpg`
- [ ] `resizeImage` utility preserved (client-side resize before upload)
- [ ] Profile image URL stored in `profiles.avatar_url` column (not Firebase Auth `photoURL`)
- [ ] `updateProfile` from `firebase/auth` removed — replaced with Supabase `profiles` table update
- [ ] `src/components/ShoppingItem.jsx` works with new upload function
- [ ] `src/components/MobileSettings.jsx` works with new profile image upload
- [ ] All Firebase Storage imports removed
- [ ] Lint passes
- [ ] Verify in browser
- [ ] Works in both light and dark mode

### US-008: Migrate Cloud Function to Supabase Edge Function

**Description:** As a user, I want image search to work using a Supabase Edge Function so the SerpAPI proxy no longer depends on Firebase Cloud Functions.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** required (`SerpAPI`, `API key`, `timing: after-initial-build`)

**Acceptance Criteria:**

- [ ] Supabase Edge Function created: `supabase/functions/search-images/index.ts`
- [ ] Edge Function accepts GET requests with `q` (query) and `num` (count, default 8) parameters
- [ ] Edge Function calls SerpAPI and returns image results (same response shape as current)
- [ ] CORS headers set correctly for the frontend origin
- [ ] `SERPAPI_KEY` stored as Supabase secret (`supabase secrets set SERPAPI_KEY=...`)
- [ ] `src/services/imageSearch.js` updated to call the Edge Function via `VITE_SUPABASE_EDGE_FUNCTION_URL` env var
- [ ] Vite dev proxy updated to proxy to Supabase Edge Function (or use direct URL in dev)
- [ ] `functions/` directory (Firebase Cloud Functions) removed entirely
- [ ] `firebase-admin` and `firebase-functions` removed from dependencies
- [ ] Lint passes
- [ ] Verify in browser

### US-009: Deploy Frontend to Vercel & Remove Firebase Hosting

**Description:** As a developer, I need to deploy the SPA to Vercel and remove all Firebase Hosting configuration so the app is fully independent of Firebase.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** required (`Vercel`, `account access`, `timing: after-initial-build`)

**Acceptance Criteria:**

- [ ] Vercel project created and linked (via `vercel` CLI or dashboard)
- [ ] `vercel.json` created with:
  - SPA rewrite rule (`/** → /index.html`)
  - Cache headers for `/assets/**` (immutable, 1 year)
  - No-cache for `/sw.js`
- [ ] Environment variables configured in Vercel dashboard (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_EDGE_FUNCTION_URL`)
- [ ] Build command: `npm run build`, output directory: `dist`
- [ ] `firebase.json` removed
- [ ] `.firebaserc` removed
- [ ] `firebase-tools` removed from devDependencies (if present)
- [ ] PWA service worker caching rules updated in `vite.config.js`:
  - Remove `firestore.googleapis.com` caching rule
  - Remove `firebasestorage.googleapis.com` caching rule
  - Add Supabase domain caching rules if needed (Supabase REST API, Storage CDN)
- [ ] Deployment succeeds and app loads correctly on Vercel URL
- [ ] Lint passes
- [ ] Verify in browser

### US-010: Final Cleanup & Verification

**Description:** As a developer, I need to verify that all Firebase references are completely removed and the app works end-to-end on Supabase.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Zero references to `firebase` in any source file (grep verification)
- [ ] Zero Firebase packages in `package.json`
- [ ] No Firebase-related files remain: `firebase.json`, `.firebaserc`, `functions/`
- [ ] `.env.example` reflects only Supabase/SerpAPI vars
- [ ] `docs/project.json` updated: `backend: "supabase"`, `hosting: "vercel"`, `functions: "supabase-edge-functions"`, `database: "postgres"`, `auth: "supabase-auth"`, remove `firebase` integration, add `supabase` integration
- [ ] `docs/memory/shared-lists-firestore-rules.md` archived or removed (no longer relevant)
- [ ] Full end-to-end test:
  - Sign up with email → profile created
  - Sign in with Google → profile created
  - Sign in with Apple → profile created
  - Create list → appears in real-time
  - Add items to list → appear in real-time
  - Check/uncheck items → updates in real-time
  - Upload item image → image displays
  - Share list with email → recipient sees shared list
  - Recipient adds item to shared list → owner sees it in real-time
  - Unshare list → recipient loses access
  - Delete list → cascade deletes items and shares
  - Create/edit/delete/reorder stores → works correctly
  - Search for item images → returns results
  - Upload profile image → avatar displays
  - Sign out and sign back in → data persists
- [ ] Lint passes
- [ ] Verify in browser
- [ ] Works in both light and dark mode

## Functional Requirements

- FR-1: The Supabase client must be initialized with environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), never hardcoded
- FR-2: All database schema must be defined as Supabase migration files in `supabase/migrations/`
- FR-3: Auth must support Google, Apple, and email/password sign-in (anonymous auth removed)
- FR-4: A `profiles` row must be created automatically when a new user signs up
- FR-5: All 7 current real-time subscriptions must work via Supabase Realtime with equivalent responsiveness
- FR-6: RLS policies must enforce that users can only access their own data and data explicitly shared with them
- FR-7: Shared list access must work by email matching — owner shares with an email, recipient with that email sees the list
- FR-8: Batch operations (multi-item add, clear checked, delete list cascade, reorder stores) must be atomic or functionally equivalent
- FR-9: Item count on lists must stay accurate as items are added/removed/checked
- FR-10: Image upload must preserve client-side resize (max 256px for profile, original behavior for items)
- FR-11: The SerpAPI image search must work via Supabase Edge Function with the same request/response contract
- FR-12: The frontend must deploy to Vercel with proper SPA routing, caching, and service worker configuration
- FR-13: PWA offline caching must be updated to cache Supabase API responses instead of Firebase endpoints

## Non-Goals

- No data migration from Firebase (fresh start, no existing production users)
- No new features — this is a pure infrastructure migration with feature parity
- No changes to the UI/UX beyond removing the guest sign-in button
- No Supabase Auth email templates customization (use defaults initially)
- No CI/CD pipeline setup for Vercel (manual deploy or Vercel GitHub integration is sufficient)
- No local Supabase development environment (connect directly to hosted project)
- No Firebase Analytics replacement (analytics was never implemented)
- No Firebase Messaging replacement (messaging was never implemented)

## Design Considerations

- The only UI change is removing the "Continue as Guest" button from the login screen
- All other UI remains identical — the migration is invisible to users
- Existing CSS modules and component structure are preserved
- Dark mode continues to work as-is

## Technical Considerations

- **Supabase client library:** `@supabase/supabase-js` v2
- **Database:** Postgres (managed by Supabase)
- **Real-time:** Supabase Realtime uses WebSocket connections; ensure Realtime is enabled for all tables that need subscriptions
- **RLS + Realtime:** Supabase Realtime respects RLS policies — subscriptions only receive rows the user is authorized to see
- **Edge Functions:** Written in TypeScript (Deno runtime), deployed via `supabase functions deploy`
- **Supabase Storage:** Uses signed URLs or public bucket URLs; the `item-images` and `profile-images` buckets should be public-read for simplicity
- **Auth provider config:** Google and Apple OAuth providers must be configured in the Supabase dashboard (redirect URLs, client IDs) — this is a manual step, not in code
- **Firestore `increment()` replacement:** Use a Postgres function or direct SQL `SET item_count = item_count + 1` via Supabase RPC
- **Firestore `serverTimestamp()` replacement:** Use `DEFAULT now()` on timestamp columns
- **Firestore subcollections → flat tables:** The nested `users/{uid}/lists/{lid}/items/{iid}` model becomes flat `items` table with `list_id` foreign key; access scoping moves from path-based to RLS-based
- **Composite queries:** The triple-where query for `unshareList` becomes a simple `DELETE FROM list_shares WHERE list_id = X AND shared_with_email = Y`
- **Service layer architecture preserved:** The clean separation (components → context → services → SDK) remains; only the service layer internals change
- **Vite proxy:** Update `vite.config.js` dev proxy to point to Supabase Edge Function URL instead of Firebase emulator

## Credential & Service Access Plan

| Service | Credential Type | Needed For | Request Timing | Fallback if Not Available |
|---------|-----------------|------------|----------------|---------------------------|
| Supabase | Project URL + anon key | US-001, US-002 (all stories) | upfront | Cannot proceed without Supabase project access |
| Supabase | Service role key | US-001 (migrations) | upfront | Can create schema via dashboard but loses version control |
| SerpAPI | API key | US-008 | after-initial-build | Edge Function can be built and tested with mock responses first |
| Vercel | Account access | US-009 | after-initial-build | Frontend works locally; deploy is the final step |
| Google OAuth | Client ID + secret | US-003 (Google sign-in) | after-initial-build | Other auth methods work; Google can be added later |
| Apple OAuth | Client ID + secret + key | US-003 (Apple sign-in) | after-initial-build | Other auth methods work; Apple can be added later |

## Definition of Done

This PRD is complete when:

1. **Zero Firebase dependencies remain** — no Firebase packages in `package.json`, no Firebase imports in source code, no Firebase config files (`firebase.json`, `.firebaserc`, `functions/`)
2. **All database schema is version-controlled** — Supabase migration files in `supabase/migrations/` define all tables, indexes, RLS policies, and functions
3. **Authentication works** — Google, Apple, and email/password sign-in all function correctly; anonymous auth is removed
4. **Full CRUD works** — Lists, items, stores, history, and sharing all create/read/update/delete correctly via Supabase Postgres
5. **Real-time works** — All 7 subscriptions deliver updates immediately when data changes (including cross-user shared list updates)
6. **Security is enforced** — RLS policies prevent unauthorized access; users can only see their own data and explicitly shared lists
7. **Image upload works** — Item images and profile images upload to Supabase Storage and display correctly
8. **Image search works** — SerpAPI proxy runs as a Supabase Edge Function and returns results
9. **Frontend deploys to Vercel** — The app loads, routes correctly, caches assets, and the service worker functions
10. **The full end-to-end flow passes** — The comprehensive test checklist in US-010 passes entirely
11. **Lint passes** across the entire codebase
12. **`docs/project.json` is updated** to reflect the new stack

## Success Metrics

- Complete feature parity with the Firebase version — no regressions
- All real-time subscriptions deliver updates within the same perceived latency as Firestore
- App loads and functions correctly when deployed to Vercel
- Database schema is fully reproducible from migration files alone

## Resolved Questions

- **Email verification on sign-up:** Allow immediate access (no email confirmation required). Matches current Firebase behavior. Can be enabled later if needed.
- **Edge Function URL:** Configure via environment variable (`VITE_SUPABASE_EDGE_FUNCTION_URL`) for consistency with the rest of the Supabase config.
- **Custom email templates:** Skip for now (non-goal). Use Supabase defaults for password reset and email verification flows. Can be customized later.
