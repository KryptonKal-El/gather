# PRD: Apple Auth Setup & Google Auth Removal

## Introduction

Replace Google OAuth with Apple Sign-In as the sole social login provider alongside email/password. Apple Sign-In code is already fully wired into the app (AuthContext, Login component, button + styling) via Supabase OAuth redirect — but it's disabled in the Supabase dashboard and local config. Google Sign-In needs to be cleanly removed from three files. The login screen layout should be rearranged to put the Apple button on top, followed by a divider, then the email/password form below.

## Goals

- Enable Apple Sign-In as a working social auth option for users
- Remove Google Sign-In completely (no Google users exist)
- Rearrange the login screen: Apple button on top → divider → email form below
- Keep the login experience clean, polished, and consistent in light/dark mode

## User Stories

### US-001: Remove Google Sign-In

**Description:** As a developer, I want to remove all Google OAuth code so the app no longer offers or references Google sign-in.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `signInWithGoogle` function removed from `AuthContext.jsx`
- [ ] `signInWithGoogle` removed from the context provider `value` prop
- [ ] `signInWithGoogle` removed from the `useAuth` JSDoc return type
- [ ] JSDoc comments in `AuthContext.jsx` no longer mention "Google sign-in"
- [ ] `handleGoogle` handler removed from `Login.jsx`
- [ ] `signInWithGoogle` removed from `useAuth()` destructure in `Login.jsx`
- [ ] Google sign-in button (including multicolor SVG) removed from `Login.jsx`
- [ ] JSDoc comment in `Login.jsx` no longer mentions "Google"
- [ ] `.googleBtn`, `.googleBtn:hover`, `.googleBtn:disabled`, `.googleIcon` styles removed from `Login.module.css`
- [ ] No remaining references to "Google" in auth-related source files
- [ ] Lint passes
- [ ] Verify in browser
- [ ] Works in both light and dark mode

### US-002: Rearrange Login Screen Layout

**Description:** As a user, I want the Apple sign-in button to appear prominently at the top of the login screen, with the email form below, so the fastest sign-in option is most visible.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Login screen layout order (top to bottom): Logo → Tagline → Apple button → Divider ("or") → Email/password form
- [ ] The Apple button is the first interactive element below the tagline
- [ ] The divider with "or" separates the Apple button from the email form
- [ ] Email form remains fully functional (sign in / sign up toggle, validation, error display)
- [ ] Visual spacing and alignment are balanced — no awkward gaps or cramped sections
- [ ] Lint passes
- [ ] Verify in browser
- [ ] Works in both light and dark mode

### US-003: Enable Apple Sign-In in Supabase

**Description:** As a user, I want to sign in with my Apple ID so I can quickly access my shopping lists without creating a new email/password account.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** required (`Apple Developer`, `Service ID + private key`, `timing: upfront`)

**Acceptance Criteria:**

- [ ] Apple Sign-In is enabled in the Supabase project dashboard (Authentication → Providers → Apple)
- [ ] Apple Service ID (`client_id`) is configured in Supabase
- [ ] Apple private key (`.p8` file contents) is configured as the secret in Supabase
- [ ] Supabase redirect URL is registered in Apple Developer Console as a valid redirect
- [ ] `supabase/config.toml` `[auth.external.apple]` section updated: `enabled = true`, `client_id` populated
- [ ] Clicking "Sign in with Apple" on the login screen redirects to Apple's consent screen
- [ ] After Apple consent, user is redirected back and automatically signed in
- [ ] User's name (from Apple) appears correctly in the app header/settings
- [ ] A profile row is auto-created in the `profiles` table via the existing `handle_new_user` trigger
- [ ] Sign-out works correctly for Apple-authenticated users
- [ ] Lint passes
- [ ] Verify in browser
- [ ] Works in both light and dark mode

## Functional Requirements

- FR-1: Remove the `signInWithGoogle` function, its handler, button, SVG icon, and CSS styles from `AuthContext.jsx`, `Login.jsx`, and `Login.module.css`
- FR-2: Reorder the `Login.jsx` JSX so the Apple button renders first, then the "or" divider, then the email/password form
- FR-3: Enable Apple as an OAuth provider in the Supabase dashboard with valid Apple Developer credentials
- FR-4: Update `supabase/config.toml` to reflect Apple provider enabled with client_id
- FR-5: Ensure the Supabase redirect URL (callback URL) is added to the Apple Developer Console's list of authorized redirect URIs

## Non-Goals

- No changes to the email/password auth flow
- No changes to the sign-out flow
- No migration of existing users (no Google users exist)
- No changes to desktop header or MobileSettings — they are auth-provider-agnostic
- No addition of other social providers (GitHub, Facebook, etc.)
- No changes to RLS policies or database schema — they are already auth-provider-agnostic

## Design Considerations

- The login screen currently shows: Email form → divider → Apple button → Google button
- New layout: Apple button → divider → email form
- The Apple button uses the existing `.appleBtn` styling (black background, white text, Apple logo SVG) — no style changes needed
- Removing the Google button and reordering will naturally clean up the layout
- The unused `.guestBtn` CSS class can optionally be cleaned up but is not required

## Technical Considerations

- **Framework:** React (Vite)
- **Auth provider:** Supabase Auth with OAuth redirect flow (PKCE)
- **No SDKs needed:** Apple Sign-In uses Supabase's built-in OAuth redirect — no `apple-signin-js` or similar package required
- **Files changed (US-001 + US-002):**
  - `src/context/AuthContext.jsx` — Remove `signInWithGoogle`, update JSDoc
  - `src/components/Login.jsx` — Remove Google handler/button, reorder Apple above email form
  - `src/components/Login.module.css` — Remove `.googleBtn` and `.googleIcon` styles
- **Files changed (US-003):**
  - `supabase/config.toml` — Enable Apple provider, set client_id
  - Supabase dashboard — Configure Apple provider credentials
  - Apple Developer Console — Register redirect URI

## Credential & Service Access Plan

| Service | Credential Type | Needed For | Request Timing | Fallback if Not Available |
|---------|-----------------|------------|----------------|---------------------------|
| Apple Developer | Service ID + private key (.p8) | US-003 | upfront | US-001 and US-002 can proceed without credentials; US-003 blocked until Apple Developer credentials are configured |

## Definition of Done

Implementation is complete when:

1. The Google sign-in button, handler, function, and CSS are fully removed with zero remaining references in auth files
2. The login screen renders Apple button → divider → email form (top to bottom)
3. Apple Sign-In is enabled in Supabase and clicking the button successfully initiates the Apple OAuth flow
4. A new user signing in via Apple is auto-created in the `profiles` table and can access the full app
5. The login screen looks clean and balanced in both light and dark mode on mobile and desktop viewports
6. Lint passes with no errors

## Success Metrics

- Users can sign in with Apple ID in under 3 taps (button → Apple consent → redirected back)
- Login screen loads with Apple as the most prominent sign-in option
- Zero references to Google remain in auth-related code

## Open Questions

None — scope is clear and all clarifications have been addressed.
