# PRD: Update Bundle ID to com.gatherlists

## Introduction

The iOS bundle ID has been changed from `com.gather.app` to `com.gatherlists` in Apple Developer portal. All project files referencing the old bundle ID must be updated to match, otherwise Capacitor builds, Apple Sign-In, and Universal Links will break.

## Goals

- Update all references to `com.gather.app` → `com.gatherlists` across the codebase
- Ensure Capacitor builds target the correct bundle ID
- Ensure Apple Sign-In uses the correct `clientId`
- Ensure Universal Links AASA file references the correct app ID

## User Stories

### US-001: Update Capacitor config bundle ID

**Description:** As a developer, I need the Capacitor config to use the new bundle ID so native builds target the correct app identity.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `capacitor.config.ts` `appId` changed from `com.gather.app` to `com.gatherlists`
- [ ] Lint passes

### US-002: Update Xcode project bundle identifier

**Description:** As a developer, I need the Xcode project to use the new bundle ID so iOS builds and signing work correctly.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `ios/App/App.xcodeproj/project.pbxproj` `PRODUCT_BUNDLE_IDENTIFIER` changed to `com.gatherlists` (both Debug and Release)
- [ ] `ios/App/App/Info.plist` `CFBundleURLName` changed from `com.gather.app` to `com.gatherlists`

### US-003: Update Apple Sign-In clientId

**Description:** As a user, I need Apple Sign-In to use the correct bundle ID so authentication works.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `src/context/AuthContext.jsx` Apple Sign-In `clientId` changed from `com.gather.app` to `com.gatherlists`
- [ ] Lint passes

### US-004: Update Universal Links AASA file

**Description:** As a user, I need Universal Links to work with the new bundle ID so deep links open the app correctly.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `public/.well-known/apple-app-site-association` `appIDs` updated from `53L3M4444A.com.gather.app` to `53L3M4444A.com.gatherlists`
- [ ] Both `applinks` and `webcredentials` sections updated

### US-005: Sync iOS project with Capacitor

**Description:** As a developer, I need to run `npx cap sync ios` after the config change so the iOS project picks up the new bundle ID.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `npx cap sync ios` completes without errors
- [ ] `npm run build` succeeds

## Functional Requirements

- FR-1: Replace all occurrences of `com.gather.app` with `com.gatherlists` in source and config files
- FR-2: Do NOT update references in `docs/prds/` files — those are historical records
- FR-3: Run `npx cap sync ios` to propagate the change to the native project

## Non-Goals

- No changes to Apple Developer portal (already done by user)
- No changes to Supabase Apple Sign-In provider config (uses Services ID `com.shoppinglistai.*`, which is separate)
- No changes to the URL scheme (`gather://`) — that stays as-is
- No App Store Connect changes (handled manually)

## Technical Considerations

- **Capacitor** uses `appId` in `capacitor.config.ts` as the source of truth for native project identity
- **Apple Sign-In** native flow uses the bundle ID as `clientId` — must match what's registered in Apple Developer
- **AASA file** must use the format `{TEAM_ID}.{BUNDLE_ID}` — so `53L3M4444A.com.gatherlists`
- The Xcode `project.pbxproj` has the bundle identifier in both Debug and Release build configurations

## Definition of Done

- All 5 files updated with `com.gatherlists`
- Zero remaining references to `com.gather.app` in non-docs source files
- `npm run build` succeeds
- `npx cap sync ios` succeeds

## Credential & Service Access Plan

No external credentials required for this PRD. The Apple Developer portal bundle ID change was already completed by the user.
