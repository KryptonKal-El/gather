# PRD: Native Swift iOS App — Phase 2: Lists Core

**ID:** prd-swift-lists-core  
**Status:** Ready  
**Created:** 2026-03-09  
**Priority:** High  
**Phase:** 2 of 8  
**Depends On:** prd-swift-ios-setup (Phase 1)

## Overview

Build the full shopping list management experience in the native Swift app. This covers browsing, creating, editing, deleting, and sharing lists — replacing the placeholder "Lists — Coming Soon" tab from Phase 1 with a fully functional list browser and list detail view.

Users will be able to create lists with names, emojis, and colors; tap into a list to see its items (item display is Phase 3); share lists with other users by email; and manage all their lists (owned + shared) in a single unified view.

This PRD is **Swift-only** because it's continuing the native app buildout. The React PWA already has full list functionality. Both codebases share the same Supabase backend, database schema, and RLS policies — no backend changes are needed.

## Context: What Already Exists

### Database (shared, no changes needed)

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `lists` | `id`, `owner_id`, `name`, `emoji`, `item_count`, `color`, `created_at` | Color added via migration `20260302200000` |
| `list_shares` | `id`, `list_id`, `shared_with_email`, `added_at` | UNIQUE on `(list_id, shared_with_email)` |
| `items` | `id`, `list_id`, `name`, `category`, `is_checked`, `store_id`, `quantity`, `price`, `image_url`, `added_at` | FK cascade delete from lists |
| `history` | `id`, `user_id`, `name`, `added_at` | For autocomplete (Phase 3) |

- `item_count` on `lists` is maintained by **3 database triggers** (insert, delete, check/uncheck). The client should NOT manually manage this.
- RLS uses **SECURITY DEFINER** helper functions (`is_list_owner`, `is_list_shared_with_me`) to avoid circular policy dependencies.
- Shared list access: collaborators can read/update lists and items, but cannot delete lists or manage shares.

### React Implementation (reference for parity)

- **ListSelector component** (495 lines): Shows owned + shared lists, search/filter, create form with emoji picker + color picker (10 preset colors), three-dot menu per list (Name & Icon, Share Settings, Delete List)
- **ShareListModal**: Enter email to share, shows current collaborators, remove sharing
- **ShoppingListContext**: Merges owned lists + shared list metadata, manages active list selection, realtime subscriptions for all data
- **10 preset colors**: `#1565c0`, `#2e7d32`, `#c62828`, `#ef6c00`, `#6a1b9a`, `#00838f`, `#ad1457`, `#f9a825`, `#37474f`, `#4e342e`
- **Realtime pattern**: Subscribe → initial fetch → on any Postgres change event, re-fetch entire dataset (not incremental)
- **Sharing model**: Immediate (no invite/accept flow). Owner enters email → row in `list_shares` → shared user sees it immediately.

### From Phase 1 (assumed complete)

- `SupabaseManager` singleton with initialized client
- `AuthViewModel` with `currentUser` (user ID + email)
- Tab bar shell with "Lists" tab showing placeholder
- Brand colors and font configuration

## Goals

- Full list CRUD (create, read, update, delete) with realtime sync
- List sharing by email with collaborator display
- Owned vs. shared list separation in the UI
- 10-color preset picker matching React app
- Emoji picker for list icons
- Search/filter lists
- Navigation from list browser to list detail (detail content is Phase 3, but the navigation and empty state must work)

## Non-Goals

- Item display, add item, check/uncheck, swipe-delete (Phase 3)
- Store management (Phase 4)
- Recipe features (Phases 5-6)
- Image features (Phase 7)
- Any backend/database changes (everything exists already)

## Credential & Service Access Plan

No additional credentials required beyond Phase 1. The Supabase client configured in Phase 1 provides all database and realtime access needed for list operations.

---

## User Stories

### US-001: Codable Data Models for Lists & Shares

**Priority:** 1 (everything depends on typed models)  
**Estimate:** Small

Create Swift data models that map to the Supabase `lists` and `list_shares` tables.

**Acceptance Criteria:**

1. A `GatherList` model (or similar name) with properties: `id` (UUID), `ownerId` (UUID), `name` (String), `emoji` (String?), `itemCount` (Int), `color` (String), `createdAt` (Date). Conforms to `Codable` and `Identifiable`.
2. A `ListShare` model with properties: `id` (UUID), `listId` (UUID), `sharedWithEmail` (String), `addedAt` (Date). Conforms to `Codable` and `Identifiable`.
3. Column name mapping uses `CodingKeys` to convert between snake_case DB columns and camelCase Swift properties (e.g., `owner_id` ↔ `ownerId`, `item_count` ↔ `itemCount`, `shared_with_email` ↔ `sharedWithEmail`).
4. Default values match database defaults: `itemCount = 0`, `color = "#1565c0"`, `emoji = nil`.
5. Models compile and are usable with the Supabase Swift SDK's `.select()` and `.insert()` queries.
6. xcodebuild build succeeds.

---

### US-002: ListService — CRUD Operations

**Priority:** 2  
**Estimate:** Medium

Create a service layer that wraps Supabase queries for list and share operations.

**Acceptance Criteria:**

1. A `ListService` class (or actor) provides these async methods:
   - `fetchOwnedLists(userId:)` → `[GatherList]` — fetches lists where `owner_id = userId`, ordered by `created_at` ascending.
   - `createList(userId:name:emoji:color:)` → `GatherList` — inserts a new list and returns it.
   - `updateList(listId:updates:)` — updates name, emoji, and/or color on a list.
   - `deleteList(listId:)` — deletes a list (items cascade-delete via FK).
   - `shareList(listId:email:)` — inserts a `list_shares` row with normalized (lowercased, trimmed) email.
   - `unshareList(listId:email:)` — deletes the `list_shares` row matching `list_id` + `shared_with_email`.
   - `fetchSharesForList(listId:)` → `[ListShare]` — returns all shares for a given list.
   - `fetchSharedWithMe(email:)` → fetches `list_shares` rows for the user's email, then fetches the parent `lists` to return merged data including list name and owner ID.
2. All methods use the Supabase Swift SDK's PostgREST API (`from("table").select()`, `.insert()`, `.update()`, `.delete()`).
3. Errors are thrown with descriptive context (e.g., "Failed to create list: name=Groceries").
4. The service does NOT manually manage `item_count` — that's handled by database triggers.
5. xcodebuild build succeeds.

---

### US-003: ListViewModel — State Management with @Observable

**Priority:** 3  
**Estimate:** Large

Create the main observable view model that manages all list state, including realtime subscriptions.

**Acceptance Criteria:**

1. A `ListViewModel` using `@Observable` manages: `ownedLists: [GatherList]`, `sharedLists: [GatherList]` (lists shared with the current user), `activeListId: UUID?`, `isLoading: Bool`, `error: String?`, `searchQuery: String`.
2. A computed property `allLists` merges owned + shared lists (owned first, then shared).
3. A computed property `filteredLists` filters `allLists` by `searchQuery` against list name and emoji.
4. On initialization (given a user ID and email), the view model:
   - Fetches owned lists via `ListService`.
   - Fetches shared list references via `ListService.fetchSharedWithMe(email:)`.
   - Auto-selects the first list as active if none is selected.
5. Realtime subscriptions are set up for:
   - The `lists` table filtered by `owner_id = userId` — on any change, re-fetch owned lists.
   - The `list_shares` table filtered by `shared_with_email = userEmail` — on any change, re-fetch shared refs and their parent list metadata.
   - Individual shared list metadata — when a shared list's name/emoji/color changes, the UI updates.
6. Exposes action methods: `createList(name:emoji:color:)`, `updateList(id:name:emoji:color:)`, `deleteList(id:)`, `selectList(id:)`.
7. `deleteList` only works for lists the user owns. After deletion, auto-selects the next available list.
8. Realtime channels are properly cleaned up when the view model is deinitialized.
9. xcodebuild build succeeds.

---

### US-004: List Browser View — Owned & Shared Sections

**Priority:** 4  
**Estimate:** Medium

Build the main list browser UI that replaces the placeholder "Lists — Coming Soon" tab.

**Acceptance Criteria:**

1. The Lists tab shows a scrollable list of all lists, separated into two sections: "My Lists" (owned) and "Shared with me" (shared lists from other users).
2. The "Shared with me" section header only appears when there are shared lists.
3. Each list row displays: emoji (if set, otherwise a default icon), list name, item count badge, and the list's color as a left-edge accent (4px wide, matching the React app's treatment).
4. Shared lists show a "Shared" badge (blue tint) to distinguish them from owned lists.
5. Tapping a list row navigates to the list detail view (which shows items — the detail content is Phase 3, but navigation must work and show at minimum the list name in the nav title + an empty state message like "No items yet").
6. A search bar at the top filters lists by name and emoji as the user types.
7. The view uses the `ListViewModel` for all data and actions.
8. Loading state shows a spinner while initial data loads.
9. Empty state shows a friendly message when the user has no lists ("Create your first list!" with a button).
10. The view supports both light and dark mode.
11. xcodebuild build succeeds.

---

### US-005: Create List Flow — Name, Emoji & Color Picker

**Priority:** 5  
**Estimate:** Medium

Implement the create-list interface with name input, emoji picker, and 10-color preset picker.

**Acceptance Criteria:**

1. A "+" button in the list browser's toolbar/navigation bar triggers the create flow.
2. The create flow is presented as a **bottom sheet** (`.sheet` modifier), sliding up like iOS Reminders' "New List" — feels native and keeps context visible behind it.
3. The sheet contains: a text field for the list name, an emoji picker button that opens the custom emoji grid (see below), and a row of 10 color preset circles.
4. The 10 preset colors match the React app exactly: `#1565c0`, `#2e7d32`, `#c62828`, `#ef6c00`, `#6a1b9a`, `#00838f`, `#ad1457`, `#f9a825`, `#37474f`, `#4e342e`.
5. The selected color circle has a visible checkmark or border indicator.
6. Default color is `#1565c0` (the first preset).
7. The emoji picker is a **custom grid picker** (not the system keyboard) — a scrollable grid of commonly used emojis organized by category (e.g., Food & Drink, Animals, Objects, Smileys) with a search bar at the top. Presented as a nested sheet or navigation push within the create sheet.
8. Tapping "Create" (or submitting) calls `ListViewModel.createList(name:emoji:color:)` and auto-selects the new list. The sheet dismisses automatically.
9. The name field is required — the "Create" button is disabled when the name is empty.
10. The sheet has a "Cancel" and "Create" button in a top navigation bar area.
11. xcodebuild build succeeds.

---

### US-006: List Context Menu — Edit & Delete

**Priority:** 6  
**Estimate:** Medium

Add contextual actions for each list: edit name/emoji/color and delete.

**Acceptance Criteria:**

1. Each list row in the browser has a context menu (long press or swipe actions or a three-dot button) with options based on ownership:
   - **Owned lists:** "Name & Icon" (edit), "Share Settings" (opens share view — US-007), "Delete List"
   - **Shared lists:** No edit/delete options (collaborators cannot modify list metadata or delete)
2. "Name & Icon" opens an edit sheet (bottom sheet, same style as create) where the user can change the list name, emoji, and color (same 10 presets + custom emoji grid picker as create).
3. Saving the edit calls `ListViewModel.updateList(id:name:emoji:color:)`.
4. "Delete List" shows a confirmation dialog ("Delete '[list name]'? This will remove the list and all its items. This cannot be undone.").
5. Confirming delete calls `ListViewModel.deleteList(id:)`.
6. If the deleted list was the active list, the view auto-navigates to the next available list.
7. The context menu/swipe actions feel native to iOS (use `.contextMenu`, `.swipeActions`, or `Menu` as appropriate).
8. xcodebuild build succeeds.

---

### US-007: Share List Modal — Add & Remove Collaborators

**Priority:** 7  
**Estimate:** Medium

Implement list sharing by email, matching the React app's ShareListModal.

**Acceptance Criteria:**

1. "Share Settings" from the list context menu opens a share view/sheet.
2. The share view shows: the list name at the top, a text field to enter an email address, an "Add" button to share, and a list of current collaborators (from `list_shares`).
3. Adding a collaborator calls `ListService.shareList(listId:email:)` with the email lowercased and trimmed.
4. Each collaborator row shows their email and a "Remove" button (trash icon or swipe-to-remove).
5. Removing a collaborator calls `ListService.unshareList(listId:email:)`.
6. The collaborator list updates in realtime (via the `list_shares` subscription from US-003).
7. Basic validation: prevent sharing with an empty email, show an error if the email is already shared (UNIQUE constraint), prevent sharing with the owner's own email.
8. Only list owners can access Share Settings. This option does not appear for shared lists.
9. xcodebuild build succeeds.

---

### US-008: List Detail View — Navigation & Empty State

**Priority:** 8  
**Estimate:** Small

Create the list detail view that users navigate to when tapping a list. The actual item content comes in Phase 3, but the navigation shell and empty state must work now.

**Acceptance Criteria:**

1. Tapping a list in the browser pushes a detail view using `NavigationStack` / `NavigationLink`.
2. The detail view's navigation title shows the list name (with emoji if set).
3. The detail view shows the list's color as an accent (e.g., in the nav bar tint or a header element).
4. **Share status indicator:** If the list is shared, display a small indicator in the navigation bar area showing the number of collaborators (e.g., a person icon with badge count like "👥 3", or "Shared with 3 people" subtitle). For owned lists, this reflects outgoing shares. For lists shared with the user, show "Shared by [owner]" or similar. If the list is not shared, no indicator appears.
5. When the list has no items, display a centered empty state: friendly illustration or icon + "No items yet" + "Add items to get started" subtitle.
6. A back button (or swipe-back gesture) returns to the list browser. SwiftUI's default `NavigationStack` back navigation is sufficient.
7. The detail view receives the list ID and can resolve the list metadata from the `ListViewModel`.
8. A toolbar area is prepared for the "Add Item" input that Phase 3 will build (can be an empty placeholder or just the nav bar for now).
9. The view supports both light and dark mode.
10. xcodebuild build succeeds.

---

### US-009: Realtime Sync — Live Updates Across Devices

**Priority:** 9  
**Estimate:** Medium

Verify and polish realtime behavior so that changes made on the React web app or another device appear instantly in the Swift app.

**Acceptance Criteria:**

1. When a list is created/renamed/deleted on the React web app, the Swift app's list browser updates within a few seconds without manual refresh.
2. When a list is shared with the current user (on web or another device), it appears in the "Shared with me" section automatically.
3. When a share is removed, the list disappears from the shared section automatically.
4. When `item_count` changes (items added/removed on web), the badge updates in the list browser.
5. Pull-to-refresh is available as a manual fallback in the list browser.
6. No duplicate realtime channels are created when navigating between tabs or backgrounding/foregrounding the app.
7. Realtime channels reconnect after network interruption (the Supabase SDK handles this, but verify it works).
8. xcodebuild build succeeds.

---

## Flag Review

| Story | Support Article? | Tools? | Test Intensity | Reasoning |
|-------|------------------|--------|----------------|-----------|
| US-001: Codable Data Models | No | No | low | Data structure definitions |
| US-002: ListService CRUD | No | No | medium | Core data operations |
| US-003: ListViewModel | No | No | medium | State management with realtime |
| US-004: List Browser View | No | No | medium | Primary list UI |
| US-005: Create List Flow | No | No | medium | User input form + color/emoji |
| US-006: Edit & Delete | No | No | medium | Destructive actions with confirmation |
| US-007: Share List Modal | No | No | medium | Cross-user sharing logic |
| US-008: List Detail View | No | No | low | Navigation shell + empty state |
| US-009: Realtime Sync | No | No | high | Cross-device data consistency |

## Definition of Done

Implementation is complete when:

1. **All 9 user stories pass their acceptance criteria.**
2. **The native app shows a fully functional list browser** — owned and shared lists with correct separation, colors, emojis, and item count badges.
3. **List CRUD works end-to-end** — create with name/emoji/color, edit, delete with confirmation.
4. **Sharing works** — share by email, see collaborators, remove sharing. Shared lists appear/disappear automatically.
5. **Realtime sync works across codebases** — changes on the React web app are reflected in the Swift app within seconds, and vice versa.
6. **Navigation works** — tap a list to see the detail view (empty state for now), back to list browser.
7. **Search/filter works** — filtering lists by name and emoji.
8. **Dark mode works** — all views respect system appearance.
9. **No backend changes** — all data operations use the existing Supabase schema, RLS policies, and triggers.
10. **No changes to React app or Capacitor app** — `src/` and `ios/` remain untouched.
11. **`xcodebuild build` succeeds** on all stories.

## Implementation Notes for Builder

### Supabase Swift SDK — List Queries

```swift
// Fetch owned lists
let lists: [GatherList] = try await supabase
    .from("lists")
    .select()
    .eq("owner_id", userId)
    .order("created_at")
    .execute()
    .value

// Create list
let newList: GatherList = try await supabase
    .from("lists")
    .insert(["owner_id": userId, "name": name, "emoji": emoji, "color": color, "item_count": 0])
    .select()
    .single()
    .execute()
    .value

// Update list
try await supabase
    .from("lists")
    .update(["name": name, "emoji": emoji, "color": color])
    .eq("id", listId)
    .execute()

// Delete list (items cascade-delete via FK)
try await supabase
    .from("lists")
    .delete()
    .eq("id", listId)
    .execute()
```

### Supabase Swift SDK — Realtime Subscriptions

```swift
// Subscribe to owned lists changes
let channel = supabase.channel("lists-\(userId)")
channel.onPostgresChange(
    AnyAction.self,
    schema: "public",
    table: "lists",
    filter: "owner_id=eq.\(userId)"
) { _ in
    // Re-fetch owned lists
    await fetchOwnedLists()
}
await channel.subscribe()
```

### Sharing Query Pattern

```swift
// Fetch shared list refs (two-step like React)
// 1. Get list_shares for this email
let shares: [ListShare] = try await supabase
    .from("list_shares")
    .select("id, list_id, added_at")
    .eq("shared_with_email", email)
    .execute()
    .value

// 2. Fetch parent lists for those share refs
let listIds = shares.map(\.listId)
let lists: [GatherList] = try await supabase
    .from("lists")
    .select()
    .in("id", listIds)
    .execute()
    .value
```

### Custom Emoji Grid Picker

The emoji picker should be a self-contained SwiftUI view that can be reused across the app (list create/edit in Phase 2, and later for recipe collections in Phase 5). Implementation approach:

- Use a static emoji dataset organized by category (Smileys, Food & Drink, Animals, Objects, Symbols, etc.)
- Categories rendered as sections in a `LazyVGrid`
- Search bar at top filters across all categories
- Tapping an emoji selects it and dismisses the picker
- A "Remove" option clears the current emoji (sets to nil)
- The dataset can be generated at compile time or bundled as a JSON resource — emoji unicode ranges are well-defined

### 10 Preset Colors

```swift
static let presetColors: [String] = [
    "#1565c0", "#2e7d32", "#c62828", "#ef6c00", "#6a1b9a",
    "#00838f", "#ad1457", "#f9a825", "#37474f", "#4e342e"
]
```

### Key Architectural Notes

- **item_count is trigger-managed** — never increment/decrement it from the client. Just read it.
- **Sharing is email-based and immediate** — no invite/accept flow. Insert into `list_shares` and the collaborator sees it instantly via realtime.
- **Realtime pattern is re-fetch-all** — on any change event, re-run the full query. Don't try to do incremental updates from the change payload.
- **RLS enforces permissions** — the client doesn't need to check ownership for most operations. RLS will reject unauthorized actions.
- **Collaborator permissions**: Can read/update lists and items. Cannot delete lists or manage shares.

## Suggested Implementation Order

1. **US-001** — Data models (everything depends on these)
2. **US-002** — Service layer (view model depends on this)
3. **US-003** — View model with realtime (views depend on this)
4. **US-004** — List browser view
5. **US-005** — Create list flow
6. **US-006** — Edit & delete context menu
7. **US-007** — Share modal
8. **US-008** — List detail navigation
9. **US-009** — Realtime verification & polish

## Future Phases (Reference)

| Phase | PRD | Description |
|-------|-----|-------------|
| 3 | prd-swift-shopping-list | Add items, grouped display, check/uncheck, swipe-delete, undo |
| 4 | prd-swift-stores | Store CRUD, color picker, drag reorder, category editor |
| 5 | prd-swift-recipes-core | Collections, recipe CRUD, recipe detail, recipe form |
| 6 | prd-swift-recipes-advanced | Share collections, add-to-list, templates, import |
| 7 | prd-swift-images | Image picker, product search, photo upload |
| 8 | prd-swift-polish | Suggestions, settings, dark mode, shake-to-undo, final QA, remove Capacitor |
