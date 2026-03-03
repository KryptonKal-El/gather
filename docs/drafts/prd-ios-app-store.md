# PRD: iOS App Store Deployment

## Introduction

Deploy ShoppingListAI to the Apple App Store as a universal (iPhone + iPad) native app using Capacitor. The existing React/Vite PWA will be wrapped in a native iOS shell, with native Apple Sign-In replacing the OAuth redirect flow, push notifications for shared list activity, and all required App Store assets (icons, splash screens, screenshots, metadata, privacy policy).

The PWA will continue to serve Android and web users. The native iOS app will provide a superior experience on Apple devices with native sign-in, push notifications, and App Store discoverability.

## Goals

- Wrap the existing React/Vite PWA in a Capacitor native iOS shell
- Replace the OAuth redirect Apple Sign-In with native Apple Sign-In (native sign-in sheet + Supabase token exchange)
- Add push notifications for shared list changes (items added/removed/checked by collaborators)
- Generate all required App Store icon sizes and splash screens from the existing design
- Configure universal links and deep linking for auth callbacks
- Prepare complete App Store submission package (screenshots, metadata, keywords, privacy policy)
- Keep the PWA working for Android/web — both experiences coexist

## User Stories

### US-001: Install Capacitor and Scaffold iOS Project

**Description:** As a developer, I need Capacitor installed and the iOS native project scaffolded so we have the foundation for the native app.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `@capacitor/core` added as dependency
- [ ] `@capacitor/cli` added as dev dependency
- [ ] `@capacitor/ios` added as dependency
- [ ] `capacitor.config.ts` created with `appId: "com.shoppinglistai.app"`, `appName: "ShoppingListAI"`, `webDir: "dist"`
- [ ] `npx cap add ios` run — `ios/` directory created with Xcode project
- [ ] `npm run build && npx cap sync ios` succeeds — web assets copied to native project
- [ ] `npx cap open ios` opens in Xcode without errors
- [ ] Add convenience scripts to `package.json`: `cap:sync`, `cap:ios`, `cap:run:ios`
- [ ] `ios/` directory added to `.gitignore` is NOT done — the iOS project MUST be committed to git
- [ ] Lint passes

### US-002: Generate App Icons for All Required Sizes

**Description:** As a developer, I need app icons generated at every size Apple requires for a universal iPhone + iPad app submission.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Install `@capacitor/assets` as dev dependency
- [ ] Create `assets/` directory with source icon at 1024x1024 or larger (extend existing `scripts/generate-icons.js` to generate a 1024x1024 PNG, or create a new source asset)
- [ ] Run `npx capacitor-assets generate --ios` to produce all required icon sizes in the Xcode asset catalog
- [ ] Xcode project has complete `AppIcon` asset catalog with all required sizes: 20pt (@2x, @3x), 29pt (@2x, @3x), 40pt (@2x, @3x), 60pt (@2x, @3x), 76pt (@1x, @2x), 83.5pt (@2x), 1024pt (@1x)
- [ ] 1024x1024 App Store marketing icon has no transparency (PNG, sRGB)
- [ ] Verify icons display correctly in Xcode asset catalog (no yellow warning triangles)
- [ ] Lint passes

### US-003: Generate Splash Screens and Configure Launch Screen

**Description:** As a developer, I need splash screens generated for all iOS device sizes and the launch screen configured.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Install `@capacitor/splash-screen` as dependency
- [ ] Create `assets/splash.png` (2732x2732 or larger) — green background (#4caf50) with white ShoppingListAI logo centered
- [ ] Run `npx capacitor-assets generate --ios` to produce splash images for all device sizes
- [ ] Configure `SplashScreen` plugin in `capacitor.config.ts`: `launchAutoHide: false`, `backgroundColor: "#4caf50"`
- [ ] Add `SplashScreen.hide()` call in `App.jsx` after initial render/auth check completes
- [ ] Splash screen displays correctly on iPhone and iPad simulators (no stretching, no cropping)
- [ ] Lint passes

### US-004: Native Apple Sign-In with Supabase Token Exchange

**Description:** As a user, I want to sign in using the native iOS Apple Sign-In sheet instead of a browser redirect, so the login experience feels native and seamless.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** required (`Apple Developer`, `Sign in with Apple capability`, `timing: upfront`)

**Acceptance Criteria:**

- [ ] Install a Capacitor Apple Sign-In plugin (e.g., `@capacitor-community/apple-sign-in` or equivalent compatible with Capacitor 6+)
- [ ] Enable "Sign in with Apple" capability in Xcode project (Target > Signing & Capabilities)
- [ ] Update `AuthContext.jsx` → `signInWithApple()` to detect platform using `Capacitor.isNativePlatform()`
- [ ] On native: call the native Apple Sign-In plugin to get `identityToken`, then call `supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken })`
- [ ] On web: keep existing `supabase.auth.signInWithOAuth({ provider: 'apple' })` flow unchanged
- [ ] Handle first-time sign-in: capture `givenName`/`familyName` from Apple response and update Supabase user metadata (Apple only provides name on first authorization)
- [ ] Verify the Supabase Apple provider config includes the app's Bundle ID (`com.shoppinglistai.app`) as a valid Client ID
- [ ] Sign-in works on physical iOS device — native Apple Sign-In sheet appears, user authenticates, session is established
- [ ] Sign-out works on native — session is cleared, user returns to login screen
- [ ] Existing web Apple Sign-In still works (no regression)
- [ ] Lint passes

### US-005: Push Notifications — Device Token Registration

**Description:** As a developer, I need the app to register for push notifications and store device tokens in Supabase so we can send notifications to specific users.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** required (`Apple Developer`, `APNs Key`, `timing: upfront`)

**Acceptance Criteria:**

- [ ] Install `@capacitor/push-notifications` as dependency
- [ ] Enable "Push Notifications" capability in Xcode project
- [ ] Create Supabase migration for `device_tokens` table: `id` (uuid PK), `user_id` (FK → auth.users), `token` (text), `platform` (text, check: 'ios'|'android'), `created_at` (timestamptz), unique on `(user_id, token)`
- [ ] Add RLS policy: users can only manage their own tokens
- [ ] Create `src/hooks/usePushNotifications.js` hook that: requests permissions on native platform, registers with APNs, stores token in `device_tokens` table via Supabase, listens for incoming push notifications
- [ ] Hook is initialized after successful sign-in (not on app load — user must be authenticated first)
- [ ] On sign-out, remove the user's device token from `device_tokens`
- [ ] Permission request only fires on native platform (`Capacitor.isNativePlatform()` guard)
- [ ] Lint passes

### US-006: Push Notifications — Shared List Change Notifications

**Description:** As a user, I want to receive push notifications when someone I share a list with adds, removes, or checks off an item, so I stay in sync with my shopping partner.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** required (`APNs Key`, `timing: upfront`)

**Acceptance Criteria:**

- [ ] Create Supabase Edge Function `send-push` at `supabase/functions/send-push/index.ts`
- [ ] Edge Function accepts: `user_id` (recipient), `title`, `body`, `data` (for deep linking)
- [ ] Edge Function looks up device tokens for the recipient from `device_tokens` table
- [ ] Edge Function sends push notification via APNs HTTP/2 API using the APNs auth key
- [ ] Supabase secrets configured: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (p8 file content), `APNS_BUNDLE_ID`
- [ ] Create a Supabase database trigger or Realtime listener that fires `send-push` when: an item is added to a shared list, an item is removed from a shared list, an item is checked/unchecked on a shared list
- [ ] Notifications are sent to all list members EXCEPT the user who made the change
- [ ] Notification body format: "[User] added [item name] to [list name]", "[User] checked off [item name]", "[User] removed [item name] from [list name]"
- [ ] Tapping a notification opens the app to the relevant shared list (via deep link data)
- [ ] Lint passes

### US-007: Universal Links and Deep Linking

**Description:** As a developer, I need universal links configured so auth callbacks and push notification taps route correctly in the native app.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** required (`Apple Developer Team ID`, `timing: upfront`)

**Acceptance Criteria:**

- [ ] Install `@capacitor/app` plugin for URL handling
- [ ] Create `public/.well-known/apple-app-site-association` file with `applinks` for `TEAMID.com.shoppinglistai.app`
- [ ] Update `vercel.json` to serve AASA file with `Content-Type: application/json` header
- [ ] Enable "Associated Domains" capability in Xcode with `applinks:shoppinglistai.vercel.app`
- [ ] Add URL scheme `shoppinglistai://` in iOS `Info.plist` for OAuth callbacks
- [ ] Create `src/components/AppUrlListener.jsx` that listens for `appUrlOpen` events and routes to the correct screen
- [ ] Auth callback deep links resolve correctly (Supabase auth redirect → native app)
- [ ] Push notification deep links open the correct shared list
- [ ] Validate AASA file using Apple's validation tool
- [ ] Lint passes

### US-008: Status Bar and Safe Area Configuration

**Description:** As a user, I want the app to properly handle the iOS status bar, Dynamic Island, and safe areas so nothing is clipped or obscured.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Install `@capacitor/status-bar` plugin
- [ ] Configure status bar style in `capacitor.config.ts` — use `Style.Default` to follow system theme
- [ ] Set `StatusBar.setOverlaysWebView({ overlay: true })` so the app renders edge-to-edge
- [ ] Verify existing `viewport-fit=cover` meta tag and `env(safe-area-inset-*)` CSS are working correctly within the Capacitor WebView
- [ ] App content is not obscured by the notch, Dynamic Island, or home indicator on any iPhone model
- [ ] App content is not obscured by the status bar on any iPad model
- [ ] Status bar text color adapts to dark/light mode (dark text on light bg, light text on dark bg)
- [ ] Lint passes

### US-009: Suppress PWA Install Banner in Native App

**Description:** As a developer, I need the PWA install banner suppressed when the app is running inside the Capacitor native shell, since the user already has the native app installed.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Update `usePWAInstall.js` hook to detect Capacitor native platform (`Capacitor.isNativePlatform()`)
- [ ] When running in native app: `showBanner` always returns `false`
- [ ] When running in web browser: existing behavior unchanged (Android prompt + iOS Safari instructions)
- [ ] PWA update prompt (`PWAPrompt.jsx`) is also suppressed in native app (service worker updates are handled by Capacitor sync, not the PWA update flow)
- [ ] Lint passes

### US-010: Capacitor Config for Push Notification Foreground Display

**Description:** As a developer, I need push notifications to display when the app is in the foreground so users see shared list changes in real-time.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Configure `PushNotifications` plugin in `capacitor.config.ts` with `presentationOptions: ["badge", "sound", "alert"]`
- [ ] When a push notification arrives while the app is open, it displays as a standard iOS notification banner
- [ ] Badge count updates on the app icon when notifications arrive
- [ ] Lint passes

### US-011: App Store Metadata and Privacy Policy

**Description:** As a developer, I need the App Store listing prepared with all required metadata, screenshots, and a privacy policy so the app can pass App Store review.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** required (`Apple Developer`, `App Store Connect access`, `timing: after-initial-build`)

**Acceptance Criteria:**

- [ ] Create `docs/app-store/metadata.md` with: app name, subtitle, description (up to 4000 chars), keywords (up to 100 chars), category (Food & Drink), content rating info, support URL, marketing URL
- [ ] Create `docs/app-store/privacy-policy.md` with privacy policy covering: data collection (email, name via Apple Sign-In), Supabase data storage, shared list data, push notification tokens, no third-party analytics, no ad tracking
- [ ] Privacy policy hosted at a public URL (e.g., `shoppinglistai.vercel.app/privacy`) — create `public/privacy.html` or a route
- [ ] Create App Privacy "nutrition labels" documentation for App Store Connect: data types collected, data linked to user identity, data used for tracking (none)
- [ ] Add `PrivacyInfo.xcprivacy` manifest to Xcode project (required since Spring 2024) declaring API usage reasons
- [ ] Lint passes

### US-012: App Store Screenshots

**Description:** As a developer, I need screenshots captured for both iPhone and iPad at all required sizes for the App Store listing.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Capture screenshots at required sizes: 6.7" iPhone (1290x2796), 6.5" iPhone (1284x2778), 12.9" iPad Pro (2048x2732)
- [ ] Minimum 3 screenshots per device class, recommended 5-6
- [ ] Screenshots show key app features: shopping list view, shared list, image search, recipe panel, dark mode
- [ ] Screenshots saved to `docs/app-store/screenshots/` organized by device size
- [ ] Screenshots include status bar with realistic time/battery (use Xcode simulator for consistency)

### US-013: Xcode Build Configuration and Signing

**Description:** As a developer, I need the Xcode project properly configured for App Store distribution with automatic signing and correct build settings.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** required (`Apple Developer`, `signing certificate + provisioning profile`, `timing: after-initial-build`)

**Acceptance Criteria:**

- [ ] Bundle ID set to `com.shoppinglistai.app` in Xcode project
- [ ] Display name set to "ShoppingListAI"
- [ ] Version set to `1.0.0`, build number to `1`
- [ ] Deployment target set to iOS 16.0 minimum (covers 95%+ of devices)
- [ ] Automatic signing enabled with correct Apple Developer team
- [ ] Device orientation: iPhone (Portrait only), iPad (All orientations)
- [ ] Required capabilities: Sign in with Apple, Push Notifications, Associated Domains
- [ ] `npm run build && npx cap sync ios` → Xcode archive → Product > Archive succeeds without errors
- [ ] Distribute App > App Store Connect > Upload succeeds

### US-014: Update project.json with iOS/Capacitor Integration

**Description:** As a developer, I need `docs/project.json` updated to reflect the new Capacitor/iOS native app platform.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Add `"native": "capacitor"` to `stack` in `docs/project.json`
- [ ] Add `"ios": true` to `capabilities`
- [ ] Add `"pushNotifications": true` to `capabilities`
- [ ] Add integration entry: `{ "name": "capacitor", "purpose": "Native iOS app shell wrapping the React PWA" }`
- [ ] Add integration entry: `{ "name": "apns", "purpose": "Apple Push Notification service for shared list notifications" }`
- [ ] Add commands: `"cap:sync": "npm run build && npx cap sync"`, `"cap:ios": "npm run build && npx cap sync ios && npx cap open ios"`
- [ ] Lint passes

## Functional Requirements

- FR-1: The app must run identically inside the Capacitor WebView as it does in a web browser — all existing features work without regression
- FR-2: Apple Sign-In must use the native iOS sign-in sheet when running in the native app, and the existing OAuth redirect when running in a web browser
- FR-3: Push notifications must only be requested on native platforms — web users are not affected
- FR-4: Push notifications must be sent to all members of a shared list except the user who triggered the change
- FR-5: Tapping a push notification must open the app and navigate to the relevant shared list
- FR-6: The PWA install banner must not appear when running in the native app
- FR-7: The app must handle all iOS safe areas correctly (notch, Dynamic Island, home indicator, iPad status bar)
- FR-8: Universal links must route `shoppinglistai.vercel.app` URLs to the native app when installed
- FR-9: The App Store listing must include a privacy policy URL, screenshots for iPhone and iPad, and complete metadata
- FR-10: The app must target iOS 16.0+ and support both iPhone and iPad as a universal binary

## Non-Goals

- No Android native app in this PRD (Android users continue using the PWA)
- No in-app purchases or subscriptions
- No offline push notification queuing (if the user is offline, they'll see changes when they open the app via Realtime sync)
- No custom app animations or native transitions beyond what the WebView provides
- No Apple Watch companion app
- No widget support (future enhancement)
- No Mac Catalyst build (future enhancement, despite choosing iPhone + iPad)

## Technical Considerations

- **Capacitor version:** Use latest stable (6.x or 7.x — check at implementation time)
- **Supabase auth:** The `signInWithIdToken()` method requires the Bundle ID to be registered as a valid client in the Supabase Apple provider configuration. This is a dashboard setting, not a code change.
- **APNs:** Apple Push Notification service requires a `.p8` key file from the Apple Developer Console. The key is project-wide (not per-app), so one key works for all apps under the same team.
- **APNs HTTP/2:** The Edge Function must call `api.push.apple.com` (production) using HTTP/2. Deno supports HTTP/2 via `fetch()`.
- **Push notification trigger:** A Supabase database function + trigger (on `items` table INSERT/UPDATE/DELETE) that calls the `send-push` Edge Function via `pg_net` or `http` extension is the most reliable approach. Alternative: use Supabase Realtime on the server side.
- **Service worker in Capacitor:** The Workbox service worker from `vite-plugin-pwa` will still work inside Capacitor's WebView, but PWA install/update prompts should be suppressed. Caching behavior is fine to keep.
- **processLock:** The existing `processLock` in `supabase.js` uses `navigator.locks` which should work in Capacitor's WKWebView. Monitor for issues.
- **Build flow:** `npm run build` → `npx cap sync ios` → Open Xcode → Archive → Upload to App Store Connect

## Credential & Service Access Plan

| Service | Credential Type | Needed For | Request Timing | Fallback if Not Available |
|---------|----------------|------------|----------------|---------------------------|
| Apple Developer Program | $99/year membership | US-001, US-004, US-013 | upfront | Cannot build or submit without it |
| Apple Sign-In Capability | Xcode capability (via Apple Developer) | US-004 | upfront | Fall back to web OAuth flow |
| APNs Key (.p8) | Auth key from Apple Developer Console > Keys | US-005, US-006, US-010 | upfront | Build push infrastructure but notifications won't deliver until key is configured |
| App Store Connect | Access via Apple Developer account | US-011, US-012, US-013 | after-initial-build | Build and test locally; submit when ready |
| Apple Developer Team ID | 10-char alphanumeric from Apple Developer account | US-007 | upfront | Universal links won't work until configured |

## Definition of Done

Implementation is complete when:

1. The ShoppingListAI app builds and runs on a physical iPhone and iPad via Xcode
2. Native Apple Sign-In sheet appears on iOS, authenticates successfully, and establishes a Supabase session
3. Web Apple Sign-In still works via OAuth redirect (no regression)
4. Push notifications arrive on a physical iOS device when a collaborator modifies a shared list
5. Tapping a push notification opens the correct shared list in the app
6. PWA install banner does not appear inside the native app
7. App respects all iOS safe areas — no content clipped by notch, Dynamic Island, or home indicator
8. Universal links open the native app from web URLs when the app is installed
9. The app is successfully uploaded to App Store Connect via Xcode archive
10. App Store listing has complete metadata, screenshots for iPhone + iPad, privacy policy, and app privacy labels
11. `docs/project.json` reflects the new native app capabilities
12. All existing web/PWA functionality works without regression

## Success Metrics

- App accepted by App Store review on first or second submission
- Native Apple Sign-In completes in under 3 seconds
- Push notifications delivered within 5 seconds of a shared list change
- App launch to interactive in under 2 seconds on iPhone 12 or newer
- Zero regression in web/PWA experience

## Open Questions

- Should we add app rating/review prompts (e.g., `SKStoreReviewController`) after a certain number of sessions? (Deferred to future PRD)
- Should we add Siri shortcuts for common actions like "Add milk to my list"? (Deferred)
- Should we add a widget showing the current shopping list? (Deferred)
- Should we support iPad multitasking (Split View, Slide Over)? The current responsive design may already handle this, but it should be tested.
- Should the privacy policy be a standalone static page or a route within the React app?
