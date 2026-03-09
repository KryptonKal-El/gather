# PRD: Native Swift iOS App — Phase 1: Project Setup & Auth

**ID:** prd-swift-ios-setup  
**Status:** Ready  
**Created:** 2026-03-09  
**Priority:** High  
**Phase:** 1 of 8  

## Overview

Create a native SwiftUI iOS app for Gather Lists that replaces the existing Capacitor WebView shell. This Phase 1 PRD establishes the Xcode project, integrates the Supabase Swift SDK, implements the full authentication flow (Apple Sign-In + email/password), and builds the authenticated tab bar shell that all future phases will build into.

The native app lives in `ios-native/` within the existing monorepo. It reuses the same Supabase backend, same bundle ID (`com.gatherlists`), same Apple Developer team, and same entitlements. The existing Capacitor app in `ios/` remains untouched until the native app reaches full feature parity.

## Context: Multi-Codebase Strategy

This is the first of ~8 PRDs that will rebuild the entire Gather Lists iOS app in native Swift. The React PWA (`src/`) continues to serve web and desktop users. Both codebases share:

- Same Supabase project (auth, database, realtime, storage, edge functions)
- Same database schema and RLS policies
- Same edge functions (`search-products`)
- Same Apple Developer account and App Store listing

**Going forward, every new feature PRD must include stories for both React and Swift.** This PRD is Swift-only because it's establishing the native project from scratch.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| UI Framework | SwiftUI | iOS 17+ allows full SwiftUI with NavigationStack, .searchable, .swipeActions, @Observable |
| State Management | @Observable (Observation framework) | iOS 17+ native, no Combine boilerplate, works with SwiftUI out of the box |
| Networking | Supabase Swift SDK v2.x | Official SDK, mirrors JS client API, handles auth/PostgREST/realtime/storage |
| Project Location | `ios-native/` in monorepo | Keeps both codebases together for easy cross-reference |
| Bundle ID | `com.gatherlists` (same) | Seamless upgrade path for existing TestFlight/App Store users |
| Min iOS | 17.0 | Enables @Observable, NavigationStack improvements, and latest SwiftUI features |
| Swift Version | 5.10+ | Matches Supabase Swift SDK requirement |
| Dependency Management | Swift Package Manager | Standard for modern Swift projects, no CocoaPods/Carthage needed |

## Goals

- Establish a clean, well-structured SwiftUI project that future PRD phases can build into
- Implement complete auth flow matching the React app (Apple Sign-In + email/password)
- Build the authenticated tab bar shell with 4 tabs (Lists, Recipes, Stores, Settings)
- Verify Supabase Swift SDK connectivity (auth + basic database query)
- Maintain the same bundle ID and entitlements for seamless App Store transition

## Non-Goals

- List/item CRUD (Phase 2)
- Shopping list display (Phase 3)
- Store management (Phase 4)
- Recipe features (Phases 5-6)
- Image features (Phase 7)
- Suggestions, shake-to-undo, polish (Phase 8)
- Removing the Capacitor app (done when all phases complete)
- iPad-specific layouts (portrait iPhone only for now)

## Credential & Service Access Plan

| Service | Credential Type | Stories | Timing | Fallback |
|---------|----------------|---------|--------|----------|
| Supabase | URL + Anon Key | US-002 | Upfront | Cannot proceed without — same values as `.env` |
| Apple Developer | Team ID + Sign-In capability | US-004 | Upfront | Same team/capability already configured |

The Supabase URL and anon key are the same values already in the React app's `.env` file. They need to be added to the Swift project's configuration (e.g., `Secrets.plist` or Xcode build settings). **Do not hardcode them in source files.**

---

## User Stories

### US-001: Create Xcode Project & Folder Structure

**Priority:** 1 (must be first — everything depends on this)  
**Estimate:** Medium  

Create the native SwiftUI project inside the monorepo.

**Acceptance Criteria:**

1. A new Xcode project is created at `ios-native/GatherLists.xcodeproj` (or `ios-native/GatherLists/GatherLists.xcodeproj`) using SwiftUI App lifecycle (no storyboards, no UIKit AppDelegate).
2. Bundle ID: `com.gatherlists`
3. Deployment target: iOS 17.0
4. Swift version: 5.10+
5. Device orientation: Portrait only (iPhone)
6. The project compiles and runs on iOS Simulator showing a placeholder "Hello, Gather Lists!" screen.
7. Folder structure follows this pattern:
   ```
   ios-native/
   └── GatherLists/
       ├── GatherLists.xcodeproj
       ├── GatherLists/
       │   ├── GatherListsApp.swift          (app entry point)
       │   ├── Config/
       │   │   └── Secrets.plist             (Supabase URL + anon key, git-ignored)
       │   ├── Models/                       (data models, empty for now)
       │   ├── Services/                     (Supabase client, auth service)
       │   ├── ViewModels/                   (observable view models)
       │   ├── Views/
       │   │   ├── Auth/                     (login views)
       │   │   ├── Lists/                    (list views, empty for now)
       │   │   ├── Recipes/                  (recipe views, empty for now)
       │   │   ├── Stores/                   (store views, empty for now)
       │   │   ├── Settings/                 (settings views)
       │   │   └── Components/              (shared/reusable views)
       │   ├── Assets.xcassets               (app icon, colors, images)
       │   ├── Info.plist
       │   ├── GatherLists.entitlements
       │   └── Preview Content/
       └── GatherLists.xcodeproj/
   ```
8. Add `.gitignore` entries for `ios-native/` Xcode artifacts (`*.xcuserdata`, `DerivedData/`, `build/`, etc.) if not already covered by the repo's root `.gitignore`.
9. The project builds successfully via `xcodebuild -project ios-native/GatherLists/GatherLists.xcodeproj -scheme GatherLists -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' build`.

---

### US-002: Integrate Supabase Swift SDK & Configuration

**Priority:** 2  
**Estimate:** Small  

Add the Supabase Swift SDK and configure the client.

**Acceptance Criteria:**

1. Supabase Swift SDK (`https://github.com/supabase/supabase-swift.git`) added as a Swift Package Manager dependency, version 2.x (latest stable).
2. A `Config/Secrets.plist` file holds `SUPABASE_URL` and `SUPABASE_ANON_KEY` values (same as the React `.env`).
3. `Secrets.plist` is added to `.gitignore` so credentials are never committed.
4. A `Secrets.plist.example` file exists with placeholder values for onboarding.
5. A `Services/SupabaseManager.swift` singleton (or similar) initializes the Supabase client:
   ```swift
   // Conceptual — exact API may differ
   let client = SupabaseClient(
       supabaseURL: URL(string: supabaseUrl)!,
       supabaseKey: supabaseAnonKey
   )
   ```
6. The client is accessible app-wide (via singleton, environment object, or dependency injection).
7. The project builds successfully with the SDK integrated.
8. A simple smoke test: on app launch, print the Supabase client status or attempt an anonymous health check to verify connectivity.

---

### US-003: Auth State Management & Session Persistence

**Priority:** 3  
**Estimate:** Medium  

Build the authentication state layer that gates the entire app behind login.

**Acceptance Criteria:**

1. An `AuthViewModel` (or `AuthManager`) using `@Observable` manages auth state: `isLoading`, `isAuthenticated`, `currentUser`, `error`.
2. On app launch, the view model checks for an existing session via `supabase.auth.session`. If a valid session exists, the user is authenticated immediately (no login screen flash).
3. Auth state changes are observed via `supabase.auth.authStateChanges` stream.
4. Session auto-refresh is enabled (via SDK defaults or explicit `startAutoRefresh()`).
5. The root `GatherListsApp.swift` conditionally renders:
   - Loading spinner while `isLoading` is true
   - Login view when `isAuthenticated` is false
   - Main tab view when `isAuthenticated` is true
6. A `signOut()` method clears the session and returns to the login view.
7. The auth state persists across app launches (SDK's default keychain storage).

---

### US-004: Apple Sign-In Flow

**Priority:** 4  
**Estimate:** Medium  

Implement native Apple Sign-In using `AuthenticationServices` framework.

**Acceptance Criteria:**

1. The `GatherLists.entitlements` file includes the `com.apple.developer.applesignin` capability (same as existing Capacitor app).
2. The login view shows a "Sign in with Apple" button using SwiftUI's `SignInWithAppleButton` or a custom styled button matching the Gather Lists brand.
3. Tapping the button triggers the native `ASAuthorizationController` flow.
4. On success, the Apple ID token is passed to Supabase via `supabase.auth.signInWithIdToken(credentials: .init(provider: .apple, idToken: idToken, nonce: nonce))`.
5. A SHA256-hashed nonce is generated for each sign-in attempt and verified by Supabase.
6. On success, the app transitions to the authenticated tab view.
7. On failure, an error message is displayed to the user.
8. The sign-in works on a physical device (requires Apple Developer team signing).
9. The Apple Sign-In associates with the same Supabase user as the React app's Apple Sign-In (same provider, same Apple ID → same `auth.users` row).

---

### US-005: Email/Password Sign-In & Sign-Up

**Priority:** 5  
**Estimate:** Medium  

Implement email/password authentication matching the React app's login form.

**Acceptance Criteria:**

1. The login view has a toggle or tab to switch between Apple Sign-In and email/password.
2. Email/password form has: email field, password field, "Sign In" button, "Sign Up" link/toggle.
3. Sign-in calls `supabase.auth.signIn(email:password:)`.
4. Sign-up calls `supabase.auth.signUp(email:password:)`.
5. On success, the app transitions to the authenticated tab view.
6. On failure, a clear error message is displayed (e.g., "Invalid email or password", "Account already exists").
7. Form validation: email format check, password minimum length (Supabase default: 6 chars).
8. The keyboard dismisses on submit or tap outside.
9. The login view is visually branded: Gather Lists logo/icon at top, brand colors (`#B5E8C8` → `#A8D8EA` gradient, text `#3D7A63`), Nunito font if available or system font as fallback.

---

### US-006: Authenticated Tab Bar Shell

**Priority:** 6  
**Estimate:** Small  

Build the main `TabView` that authenticated users see, with placeholder content for each tab.

**Acceptance Criteria:**

1. After authentication, the user sees a `TabView` with 4 tabs: Lists, Recipes, Stores, Settings.
2. Each tab has an SF Symbol icon:
   - Lists: `list.bullet` or `checklist`
   - Recipes: `book` or `fork.knife`
   - Stores: `storefront` or `building.2`
   - Settings: `gearshape`
3. Each tab shows a placeholder view with the tab name (e.g., "Lists — Coming Soon") so it's clear the shell works.
4. Tab bar uses the Gather Lists primary color (`#3D7A63`) for the selected tab tint.
5. The Settings tab includes a working "Sign Out" button that calls `signOut()` and returns to the login view.
6. The Settings tab displays the current user's email and display name (from `supabase.auth.session.user`).
7. The tab bar supports both light and dark mode (uses system appearance with custom accent color).
8. The app builds and runs on iOS Simulator successfully.
9. `xcodebuild` build succeeds.

---

### US-007: App Icon, Launch Screen & Entitlements

**Priority:** 7  
**Estimate:** Small  

Configure the app's visual identity and entitlements to match the existing App Store listing.

**Acceptance Criteria:**

1. The app icon in `Assets.xcassets` uses the existing Gather Lists icon (copy from `ios/App/App/Assets.xcassets/AppIcon.appiconset/` or regenerate from `public/logo/icon.svg`).
2. The launch screen shows the Gather Lists stacked logo (icon + name + tagline) on a white background, matching the existing Capacitor app's splash screen.
3. Dark mode launch screen variant uses `#1a1a2e` background with white text (matching existing).
4. Entitlements file includes:
   - `com.apple.developer.applesignin` → `["Default"]`
   - `com.apple.developer.associated-domains` → `["applinks:gatherlists.com"]`
5. `Info.plist` includes:
   - `CFBundleDisplayName`: "Gather Lists"
   - `CFBundleURLTypes`: URL scheme `gather` with identifier `com.gatherlists`
   - `UISupportedInterfaceOrientations`: Portrait only
6. Privacy manifest (`PrivacyInfo.xcprivacy`) matches the existing Capacitor app's declarations.
7. Build succeeds and the app icon is visible in Simulator's home screen.

---

## Flag Review

| Story | Support Article? | Tools? | Test Intensity | Reasoning |
|-------|------------------|--------|----------------|-----------|
| US-001: Xcode Project Setup | No | No | low | Project scaffolding |
| US-002: Supabase SDK Integration | No | No | low | SDK integration, config |
| US-003: Auth State Management | No | No | medium | Auth state logic, session persistence |
| US-004: Apple Sign-In | No | No | medium | Native auth flow, requires physical device |
| US-005: Email/Password Auth | No | No | medium | Form validation, error handling |
| US-006: Tab Bar Shell | No | No | low | UI scaffolding |
| US-007: App Icon & Entitlements | No | No | low | Asset configuration |

## Definition of Done

Implementation is complete when:

1. **All 7 user stories pass their acceptance criteria.**
2. **The native app builds and runs on iOS Simulator** — `xcodebuild` succeeds.
3. **Apple Sign-In works on a physical device** — same Apple ID logs into the same Supabase account as the React app.
4. **Email/password works** — same credentials work in both native and React apps.
5. **The tab bar shell is visible** after authentication with 4 tabs.
6. **Sign out works** — returns to login, session is cleared.
7. **Session persists** — killing and relaunching the app stays authenticated.
8. **Dark mode works** — the login view and tab bar respect system appearance.
9. **No changes to existing files** — the Capacitor app in `ios/` and the React app in `src/` are untouched.
10. **`Secrets.plist` is git-ignored** — no credentials in the repository.

## Implementation Notes for Builder

### Supabase Swift SDK Quick Reference

```swift
// Package dependency
.package(url: "https://github.com/supabase/supabase-swift.git", from: "2.0.0")

// Client init
import Supabase
let supabase = SupabaseClient(supabaseURL: url, supabaseKey: key)

// Apple Sign-In
let credentials = OpenIDConnectCredentials(provider: .apple, idToken: idToken, nonce: hashedNonce)
try await supabase.auth.signInWithIdToken(credentials: credentials)

// Email auth
try await supabase.auth.signIn(email: email, password: password)
try await supabase.auth.signUp(email: email, password: password)

// Session
let session = try await supabase.auth.session
let user = session.user

// Auth state stream
for await (event, session) in supabase.auth.authStateChanges {
    // handle event
}

// Sign out
try await supabase.auth.signOut()
```

### Brand Constants

```swift
// Colors
static let primaryGreen = Color(hex: "#3D7A63")
static let gradientStart = Color(hex: "#B5E8C8")
static let gradientEnd = Color(hex: "#A8D8EA")
static let heartPink = Color(hex: "#F9A8C9")
static let subtitleGreen = Color(hex: "#85BFA8")

// Font
// Nunito (if bundled) or system default as fallback
```

### Existing Capacitor Entitlements to Match

```xml
<key>com.apple.developer.applesignin</key>
<array><string>Default</string></array>
<key>com.apple.developer.associated-domains</key>
<array>
    <string>applinks:gatherlists.com</string>
</array>
```

## Suggested Implementation Order

1. **US-001** — Xcode project (everything depends on this)
2. **US-002** — Supabase SDK (auth depends on this)
3. **US-003** — Auth state management (login UI depends on this)
4. **US-004** — Apple Sign-In
5. **US-005** — Email/password auth
6. **US-006** — Tab bar shell
7. **US-007** — App icon, launch screen, entitlements

## Future Phases (Reference)

| Phase | PRD | Description |
|-------|-----|-------------|
| 2 | prd-swift-lists-core | Browse/create/edit/delete/share lists |
| 3 | prd-swift-shopping-list | Add items, grouped display, check/uncheck, swipe-delete, undo |
| 4 | prd-swift-stores | Store CRUD, color picker, drag reorder, category editor |
| 5 | prd-swift-recipes-core | Collections, recipe CRUD, recipe detail, recipe form |
| 6 | prd-swift-recipes-advanced | Share collections, add-to-list, templates, import |
| 7 | prd-swift-images | Image picker, product search, photo upload |
| 8 | prd-swift-polish | Suggestions, settings, dark mode, shake-to-undo, final QA, remove Capacitor |
