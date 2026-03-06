# PRD: Custom Domain Migration (gatherlists.com)

## Introduction

Gather Lists now has a custom domain: `gatherlists.com`. All code references to `gatherapp.vercel.app` must be updated to use the new domain as primary, while keeping the old Vercel domain in CORS allow-lists as a fallback during transition.

## Goals

- Update Apple Sign-In redirect URI to `gatherlists.com`
- Update Universal Links / associated domains to `gatherlists.com`
- Add `gatherlists.com` to edge function CORS allow-lists (keep old domain too)
- Update user-facing URLs in privacy policy and App Store metadata
- Ensure Capacitor sync propagates entitlement changes

## Prerequisites (Manual — User)

Before Builder implements, the user must complete:

1. **Vercel:** Add `gatherlists.com` in project Settings → Domains, configure DNS
2. **Apple Developer Portal:** Update Services ID return URLs to include `https://gatherlists.com`
3. **Supabase Dashboard:** Update Auth → Site URL to `https://gatherlists.com` and add to Redirect URLs

## User Stories

### US-001: Update Apple Sign-In redirectURI

**Description:** As a user, I need Apple Sign-In to redirect to the new domain so authentication works on `gatherlists.com`.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `src/context/AuthContext.jsx` `redirectURI` changed from `https://gatherapp.vercel.app` to `https://gatherlists.com`
- [ ] Lint passes

### US-002: Update edge function CORS origins

**Description:** As a user, I need the edge functions to accept requests from the new domain so image search works on `gatherlists.com`.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `supabase/functions/search-products/index.ts` CORS allow-list includes both `https://gatherlists.com` and `https://gatherapp.vercel.app`
- [ ] `supabase/functions/search-images/index.ts` CORS allow-list includes both `https://gatherlists.com` and `https://gatherapp.vercel.app`
- [ ] Lint passes

### US-003: Update iOS associated domains

**Description:** As a user, I need Universal Links to work with the new domain so deep links from `gatherlists.com` open the app.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `ios/App/App/App.entitlements` associated domains includes `applinks:gatherlists.com`
- [ ] Keep `applinks:gatherapp.vercel.app` as fallback entry

### US-004: Update AASA file for new domain

**Description:** As a developer, I need the Apple App Site Association file to be served on the new domain so Universal Links verify correctly.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `public/.well-known/apple-app-site-association` is present (already exists — no change needed if Vercel serves it on the new domain automatically)
- [ ] Verify AASA content uses correct bundle ID `53L3M4444A.com.gatherlists`

### US-005: Update privacy policy URLs

**Description:** As a user, I need the privacy policy to reference the correct domain.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `public/privacy.html` contact URL changed from `gatherapp.vercel.app` to `gatherlists.com`
- [ ] `docs/app-store/privacy-policy.md` URL changed from `gatherapp.vercel.app` to `gatherlists.com`

### US-006: Update App Store metadata URLs

**Description:** As a developer, I need App Store metadata to reference the new domain for support and marketing URLs.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `docs/app-store/metadata.md` Support URL changed to `https://gatherlists.com`
- [ ] `docs/app-store/metadata.md` Marketing URL changed to `https://gatherlists.com`

### US-007: Sync iOS project with Capacitor

**Description:** As a developer, I need to run cap sync so the entitlement changes propagate to the iOS project.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `npm run build` succeeds
- [ ] `npx cap sync ios` completes without errors

## Functional Requirements

- FR-1: Replace `gatherapp.vercel.app` with `gatherlists.com` as the primary domain in auth, privacy, and metadata files
- FR-2: Add `gatherlists.com` alongside `gatherapp.vercel.app` in CORS allow-lists (keep both)
- FR-3: Add `gatherlists.com` alongside `gatherapp.vercel.app` in iOS associated domains (keep both)
- FR-4: Do NOT update references in `docs/prds/` files — those are historical records
- FR-5: Run `npx cap sync ios` to propagate entitlement changes

## Non-Goals

- No DNS configuration (done manually by user in Vercel)
- No Apple Developer Portal changes (done manually by user)
- No Supabase Dashboard changes (done manually by user)
- No removal of `gatherapp.vercel.app` from CORS/entitlements (kept as fallback)

## Technical Considerations

- **Vercel** will auto-redirect `gatherapp.vercel.app` → `gatherlists.com` once the custom domain is configured, so keeping the old domain in CORS is just a safety net
- **AASA file** is already at `public/.well-known/apple-app-site-association` — Vercel will serve it on the new domain automatically
- **Edge functions** are deployed on Supabase, not Vercel — CORS must explicitly allow both origins

## Definition of Done

- All source files updated with `gatherlists.com` as primary domain
- `gatherapp.vercel.app` retained in CORS and entitlements as fallback
- Zero remaining sole-references to `gatherapp.vercel.app` in auth redirect or user-facing URLs
- `npm run build` and `npx cap sync ios` succeed

## Credential & Service Access Plan

No external credentials required for this PRD. DNS, Apple Developer, and Supabase changes are manual prerequisites completed by the user.
