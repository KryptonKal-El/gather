# PRD: Native Swift iOS App — Phase 7: Settings, Profile & Item Images

**ID:** prd-swift-settings-images  
**Status:** Ready  
**Created:** 2026-03-09  
**Priority:** High  
**Phase:** 7 of 8  
**Depends On:** prd-swift-recipes-advanced (Phase 6)

## Overview

Complete the Settings tab and add item image support in the native Swift app. Phase 1 created a minimal Settings screen (name, email, sign out). This phase upgrades it to full parity with the React PWA: profile avatar upload, display name editing, appearance toggle (system/light/dark), and a network connectivity indicator. It also adds the item image system — browsing product images via the Supabase edge function, uploading from camera/library, displaying thumbnails in shopping list rows, and managing images via the item context menu.

This PRD is **Swift-only** — the React PWA already has all these features. Both codebases share the same Supabase backend. No backend changes are needed.

## Design Decisions (User-Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Item images included in Phase 7 | **Yes** (A) | Ship everything visual in one phase — bigger but cohesive |
| Dark mode toggle | **System + manual override** (C) | Default to iOS system appearance; Settings toggle overrides to light/dark; persisted to UserDefaults |
| Image search for items | **Port React pattern** — call `search-products` edge function | Same Walmart → Open Food Facts → SerpAPI fallback chain |
| Profile avatar | **Camera + PhotosPicker** | Same native photo options as recipe images |
| Network indicator | **Banner at top when offline** | Non-intrusive, auto-dismisses when connection returns |

## Context: What Already Exists

### Database & Storage (shared, no changes needed)

All tables, RLS policies, storage buckets, and edge functions already exist:

- **`profile-images` storage bucket:** Public, upsert enabled. Path: `{userId}/profile.jpg`. React resizes to 256px JPEG at 0.8 quality.
- **`profiles` table:** Columns include `id`, `avatar_url`, `display_name`. Row created on sign-up. `avatar_url` stores the public URL.
- **`item-images` storage bucket:** Public, upsert enabled. Path: `{userId}/{itemId}.{ext}`. React resizes to 256px.
- **`items.image_url`:** Text column on the items table storing the item image public URL.
- **`search-products` edge function:** Accepts `?q=query&num=8`, returns `{ results: [{ url, thumbnail, title }] }`. Requires `Authorization: Bearer <anon_key>` header. Fallback chain: Walmart API → Open Food Facts → SerpAPI.

### Swift Codebase (what Phase 7 builds on)

- **`SupabaseManager.shared.client`:** Singleton pattern. Storage would use `client.storage.from("bucket")`.
- **`StorageService`** (Phase 6): Already handles recipe image upload/compression to `recipe-images` bucket. Pattern can be extended for profile and item image buckets.
- **`ImageCompressor`** (Phase 6): `compress(imageData:maxDimension:quality:)` — reusable for profile and item images.
- **`SettingsView.swift`:** Currently shows name, email, and sign-out button in a grouped `List`.
- **`AuthViewModel`:** Has `currentUser: User?` from Supabase SDK. No profile table integration yet.
- **`Item.swift`:** Model already has `imageUrl: String?` field.
- **`ItemService`:** Update DTO already encodes `imageUrl`.
- **`ListDetailViewModel`:** Manages items state — `addItem()` and `updateItem()` already support `imageUrl` parameter.
- **`ListDetailView`:** Item rows currently show name, badges, price — no image thumbnail yet.

### React Behavior to Match

**Profile avatar:** Tap avatar circle → file picker → resize to 256px JPEG → upload to `profile-images/{userId}/profile.jpg` → update `profiles.avatar_url` → refresh user display.

**Item image picker:** Tap item thumbnail → modal with two tabs: "Search online" (editable query + grid of results from edge function) and "Upload" (file picker). Selecting a search result sets `imageUrl` to the result URL. Uploading resizes to 256px → uploads to `item-images/{userId}/{itemId}.{ext}` → sets `imageUrl`. "Remove image" clears `imageUrl`.

**Theme toggle:** React uses localStorage key `shoppinglist-theme`. Reads stored preference or falls back to `prefers-color-scheme`. Toggle flips between light/dark. The Swift version should use UserDefaults and iOS `colorScheme` / `preferredColorScheme`.

**Suggestions (Suggestions.jsx):** Displayed above the shopping list. Shows "AI Suggestions" with subtitle "Based on your shopping habits." Chips with category-colored dot + name + reason + "+" button. Collapsible: shows 4, "Show N more" expands. This is Phase 8 scope — **not** included here.

---

## User Stories

### US-001: ProfileService — Fetch & Update Profile

**As a** user  
**I want** my profile (avatar, display name) synced from the profiles table  
**So that** my identity is consistent across React and Swift apps

**Acceptance Criteria:**
- Create `ProfileService` with:
  - `fetchProfile(userId:)` → queries `profiles` table by `id`, returns `Profile` model (id, avatarUrl, displayName)
  - `updateDisplayName(userId:name:)` → updates `display_name` on profiles table
  - `updateAvatarUrl(userId:url:)` → updates `avatar_url` on profiles table
- `Profile` Codable model with `CodingKeys` mapping `avatar_url` → `avatarUrl`, `display_name` → `displayName`
- All errors propagated, not silently swallowed

### US-002: ProfileImageService — Avatar Upload

**As a** user  
**I want** to upload a profile photo from my camera or photo library  
**So that** my avatar appears in Settings and shared list views

**Acceptance Criteria:**
- Extend `StorageService` (or create `ProfileImageService`) with:
  - `uploadProfileImage(userId:imageData:)` → compress to 256px JPEG at 0.8 quality via `ImageCompressor`, upload to `profile-images/{userId}/profile.jpg` with upsert, return public URL
  - After upload, call `ProfileService.updateAvatarUrl()` to persist the URL
- Reuse `ImageCompressor.compress()` from Phase 6 with `maxDimension: 256`

### US-003: AuthViewModel — Profile Integration

**As a** user  
**I want** my profile loaded when I sign in  
**So that** my avatar and display name are available throughout the app

**Acceptance Criteria:**
- Add `profile: Profile?` property to `AuthViewModel`
- After successful auth (in `listenToAuthChanges` when `signedIn` / `initialSession`), fetch profile via `ProfileService.fetchProfile(userId:)`
- Expose computed properties: `displayName` (from profile or `user_metadata.full_name` or "User"), `avatarUrl` (from profile or `user_metadata.avatar_url`), `email` (from `currentUser`)
- `refreshProfile()` method to re-fetch profile after updates (avatar upload, name change)
- On `signedOut`, clear `profile`

### US-004: SettingsView — Account Section with Avatar

**As a** user  
**I want** to see and change my profile photo in Settings  
**So that** I can personalize my account

**Acceptance Criteria:**
- Account section at top: circular avatar (56pt) + display name + email
- Avatar shows profile image via `AsyncImage` if `avatarUrl` exists, otherwise shows first letter of display name with brand-green background
- Tap avatar → action sheet: "Take Photo", "Choose from Library", "Cancel"
- "Take Photo" → `UIImagePickerController` (camera) via `UIViewControllerRepresentable`
- "Choose from Library" → `PhotosPicker` from PhotosUI framework
- After selection: show loading spinner overlay on avatar, upload via `ProfileImageService`, call `authViewModel.refreshProfile()`, show new image
- Error state: brief inline error text below avatar if upload fails

### US-005: SettingsView — Display Name Editing

**As a** user  
**I want** to edit my display name  
**So that** other users see my updated name when I share lists

**Acceptance Criteria:**
- Display name row in Account section: current name with disclosure chevron or edit icon
- Tap → alert with text field pre-filled with current display name
- "Save" validates non-empty, trims whitespace, calls `ProfileService.updateDisplayName()`
- Also updates Supabase auth `user_metadata.full_name` via `client.auth.update(user: UserAttributes(data: ["full_name": .string(name)]))`
- After save, call `authViewModel.refreshProfile()`
- "Cancel" dismisses without changes

### US-006: AppearanceManager — System/Light/Dark Toggle

**As a** user  
**I want** to choose between system, light, or dark appearance  
**So that** the app respects my visual preference

**Acceptance Criteria:**
- Create `AppearanceManager` (or simple enum + UserDefaults):
  - `AppearanceSetting` enum: `.system`, `.light`, `.dark`
  - Persisted to `UserDefaults` with key `appearance-setting`
  - Default: `.system` (follows iOS system setting)
- Apply via `.preferredColorScheme()` modifier on the root `WindowGroup`:
  - `.system` → pass `nil` (follows device)
  - `.light` → pass `.light`
  - `.dark` → pass `.dark`
- Reads on app launch; changes take effect immediately

### US-007: SettingsView — Appearance Section

**As a** user  
**I want** a visual toggle for app appearance in Settings  
**So that** I can switch between system, light, and dark modes

**Acceptance Criteria:**
- "Appearance" section below Account section
- `Picker` with `.segmented` style showing three options: "System", "Light", "Dark"
- Selecting an option immediately updates `AppearanceManager` and applies the change
- Current selection persists across app launches via UserDefaults

### US-008: ItemImageService — Upload & Delete Item Images

**As a** user  
**I want** to upload images for my shopping items  
**So that** I can visually identify products in my list

**Acceptance Criteria:**
- Create `ItemImageService` with:
  - `uploadItemImage(userId:itemId:imageData:)` → compress to 256px JPEG at 0.8 via `ImageCompressor`, upload to `item-images/{userId}/{itemId}.jpg` with upsert, return public URL
  - `deleteItemImage(userId:itemId:)` → remove `[.jpg, .jpeg, .png, .webp]` variants from `item-images` bucket (silent on not-found)
- After upload, update item via `ItemService.updateItem()` with new `imageUrl`
- After delete, update item with `imageUrl: nil`
- Reuse `ImageCompressor.compress()` from Phase 6

### US-009: ProductSearchService — Edge Function Client

**As a** user  
**I want** to search for product images online  
**So that** I can quickly find the right image for a grocery item

**Acceptance Criteria:**
- Create `ProductSearchService` with:
  - `searchProducts(query:count:)` → calls `search-products` edge function via HTTP GET
  - URL: `{SUPABASE_URL}/functions/v1/search-products?q={query}&num={count}`
  - Header: `Authorization: Bearer {SUPABASE_ANON_KEY}`
  - Returns `[ProductSearchResult]` where each has `url: String`, `thumbnail: String`, `title: String`
  - Default `count` = 8
- Read Supabase URL and anon key from `Secrets.plist` via `SupabaseManager`
- Construct the edge function base URL: `{supabaseUrl}/functions/v1/`
- Handle HTTP errors gracefully — return empty array on failure, log error
- Decode JSON response: `{ "results": [...] }`

### US-010: ItemImagePickerSheet — Search + Upload Tabs

**As a** user  
**I want** a modal to search for or upload an item image  
**So that** I can choose the best image for my shopping item

**Acceptance Criteria:**
- `.sheet` presentation with "Item Image" title and close button
- If item already has an image: show preview at top with `AsyncImage` + "Remove image" button
- Two-tab `Picker` with `.segmented` style: "Search online" and "Upload"
- **Search tab:**
  - Text field pre-filled with item name (editable), "Search" button
  - Loading indicator during search
  - Grid of results (3 columns, `LazyVGrid`) showing thumbnails via `AsyncImage`
  - Tap a result → sets `imageUrl` to the result's `url`, dismisses sheet
  - "No images found" empty state after search with no results
  - Error text if search fails
- **Upload tab:**
  - Two buttons: "Take Photo" (camera via `UIImagePickerController`) and "Choose from Library" (`PhotosPicker`)
  - After selection: show loading, upload via `ItemImageService`, update item, dismiss
  - Error text if upload fails
- "Remove image" calls `ItemImageService.deleteItemImage()` and clears `imageUrl`, dismisses

### US-011: ListDetailView — Item Image Thumbnails

**As a** user  
**I want** to see product images next to items in my shopping list  
**So that** I can visually scan my list

**Acceptance Criteria:**
- Each item row shows a 36×36 rounded-rect thumbnail on the leading edge
- If `imageUrl` is non-nil: `AsyncImage` with the URL, placeholder shimmer, `.fill` content mode
- If `imageUrl` is nil: light gray circle with "+" icon (tapping opens `ItemImagePickerSheet`)
- Tap on thumbnail (whether it has an image or not) → presents `ItemImagePickerSheet` for that item
- Checked items: thumbnail still visible but dimmed (0.5 opacity) along with the rest of the row
- Images load lazily as rows scroll into view (default `AsyncImage` behavior)

### US-012: Item Context Menu — Image Actions

**As a** user  
**I want** to manage item images from the long-press context menu  
**So that** I can add, change, or remove images without expanding the edit panel

**Acceptance Criteria:**
- Add to existing item context menu:
  - "Set Image" (if no image) or "Change Image" (if image exists) → presents `ItemImagePickerSheet`
  - "Remove Image" (only if image exists, destructive) → clears `imageUrl` via `ItemImageService.deleteItemImage()` + item update
- Context menu items appear after the existing Edit/Quantity/Store/Category/Delete options

### US-013: NetworkMonitor — Connectivity Indicator

**As a** user  
**I want** to know when I'm offline  
**So that** I understand why data isn't syncing

**Acceptance Criteria:**
- Create `NetworkMonitor` using `NWPathMonitor` from Network framework:
  - `@Observable` class with `isConnected: Bool` property
  - Monitors on a background `DispatchQueue`
  - Updates `isConnected` on `@MainActor` when path status changes
  - Start monitoring on `init`, cancel on `deinit`
- Inject as `.environment()` from `GatherListsApp`
- When `isConnected` is false: show a non-intrusive banner at the top of the active view
  - Red/orange background, white text: "No Internet Connection"
  - Appears with slide-down animation
  - Auto-dismisses with slide-up when connection returns
- Banner shown in `MainTabView` above the `TabView` content so it persists across tabs

### US-014: GatherListsApp — Root Appearance + Network Wiring

**As a** developer  
**I want** appearance and network state wired at the app root  
**So that** all views inherit these settings

**Acceptance Criteria:**
- Read `AppearanceManager` setting on launch; apply `.preferredColorScheme()` to the root `WindowGroup`
- Create `NetworkMonitor` instance as `@State` in `GatherListsApp`, inject via `.environment()`
- Create `AppearanceManager` instance as `@State` in `GatherListsApp`, inject via `.environment()`
- No regression to existing auth flow or tab navigation

---

## Technical Notes

### Storage Bucket Access Pattern

Phase 6 established the pattern for Supabase Storage in Swift. All three buckets (`recipe-images`, `profile-images`, `item-images`) use the same approach:

```swift
let data = try await SupabaseManager.shared.client.storage
    .from("bucket-name")
    .upload(path: filePath, file: compressedData, options: FileOptions(upsert: true))

let publicUrl = try SupabaseManager.shared.client.storage
    .from("bucket-name")
    .getPublicURL(path: filePath)
```

### Edge Function Access Pattern

The `search-products` edge function is a simple HTTP GET. The Swift app needs to construct the URL manually since the Supabase Swift SDK doesn't have a built-in edge function invocation method for GET requests with query parameters:

```swift
var components = URLComponents(string: "\(supabaseUrl)/functions/v1/search-products")
components?.queryItems = [
    URLQueryItem(name: "q", value: query),
    URLQueryItem(name: "num", value: String(count))
]
var request = URLRequest(url: components!.url!)
request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
```

### Camera Access

Camera requires `NSCameraUsageDescription` in `Info.plist`. Phase 6 may have already added this for recipe images — verify before adding. Photo library access uses `PhotosPicker` (PhotosUI) which does not require a privacy string (iOS 16+).

### Image Resize Reuse

`ImageCompressor` from Phase 6 handles all resizing:
- Profile images: `maxDimension: 256, quality: 0.8`
- Item images: `maxDimension: 256, quality: 0.8`
- Recipe images: `maxDimension: 1200, quality: 0.8` (Phase 6)

---

## Credential & Service Access Plan

No external credentials required for this PRD. All functionality uses the existing Supabase project (database, storage, realtime, auth, edge functions). The `profile-images` and `item-images` storage buckets are already configured. The `search-products` edge function is already deployed.

## Definition of Done

Implementation is complete when:

1. Settings shows profile avatar (image or letter fallback), display name, and email
2. Tapping avatar presents camera/library options; selected image uploads to `profile-images` bucket and displays immediately
3. Display name is editable via alert; saved to both `profiles` table and auth `user_metadata`
4. Appearance section has a 3-way segmented picker (System/Light/Dark) that takes effect immediately
5. Appearance preference persists across app launches via UserDefaults
6. Item rows in the shopping list show 36×36 image thumbnails (or "+" placeholder)
7. Tapping an item thumbnail opens the image picker sheet with search and upload tabs
8. Product search calls the `search-products` edge function and displays results in a grid
9. Selecting a search result sets the item's `imageUrl` immediately
10. Upload from camera/library compresses to 256px JPEG, uploads to `item-images` bucket, and updates the item
11. "Remove image" clears the item image from storage and database
12. Context menu includes "Set Image" / "Change Image" / "Remove Image" actions
13. A "No Internet Connection" banner appears when offline and auto-dismisses when connectivity returns
14. All features work on iPhone simulator
15. No regression in Phases 1–6 functionality (auth, lists, items, stores, recipes, collections)
16. Build succeeds
