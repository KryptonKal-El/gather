# PRD: App Store Distribution Prep

## Introduction

Prepare Gather Lists for Apple App Store distribution by creating the required public-facing pages (marketing landing page and support page), populating the test account with screenshot-worthy data, and capturing iOS Simulator screenshots for the App Store listing. The app already has a native Swift iOS build, App Store metadata draft, privacy policy, and icon assets — this PRD covers the remaining gaps to submit.

## Goals

- Create a marketing landing page at `gatherlists.com` (static HTML) so the root domain serves a public-facing page instead of the React app
- Create a support page at `gatherlists.com/support` with FAQ and contact info
- Move the React PWA to be served at `gatherlists.com/app` instead of root
- Populate the test account with realistic, visually appealing data for screenshots
- Capture App Store screenshots on iOS Simulator (iPhone 15 Pro Max)
- Review and update App Store metadata to accurately reflect current features
- Set Support URL to `https://gatherlists.com/support` and Marketing URL to `https://gatherlists.com` in metadata

## User Stories

### US-001: Marketing Landing Page

**Description:** As a visitor, I want to see a professional landing page at `gatherlists.com` so I understand what Gather Lists is and can download it.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Static HTML file at `public/index-marketing.html` (see US-005 for Vercel routing)
- [ ] Hero section with app name, tagline ("Gather your lists, meals, and more"), and the stacked logo from `public/logo/stacked.svg`
- [ ] App Store download badge (use Apple's official badge artwork, link to: `https://apps.apple.com/app/id6760205400`)
- [ ] 3-4 feature highlight cards: Smart Lists, Real-Time Sharing, Recipes & Meal Planning, Works Everywhere (web + iOS)
- [ ] Footer with links to: Support (`/support`), Privacy Policy (`/privacy.html`), App (`/app`), and copyright "© 2026 Gather Lists"
- [ ] Responsive design — looks good on mobile (375px+) and desktop
- [ ] Uses system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, ...`) matching `privacy.html` styling conventions
- [ ] Gather Lists brand colors: primary green `#4CAF50`, dark background `#1a1a2e` if using a dark hero section
- [ ] Page includes proper `<meta>` tags: `og:title`, `og:description`, `og:image` (use icon-512x512.png), `og:url`
- [ ] Page includes `<meta name="apple-itunes-app" content="app-id=6760205400">` smart app banner
- [ ] No JavaScript required — pure HTML + CSS (inline styles like `privacy.html`)
- [ ] Lint passes (HTML validity)

### US-002: Support Page

**Description:** As a user needing help, I want to find answers to common questions at `gatherlists.com/support` so I can resolve issues without emailing.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Static HTML file at `public/support.html`
- [ ] Page title: "Support — Gather Lists"
- [ ] FAQ accordion section with 8-10 questions covering:
  - How do I create a new list?
  - How do I share a list with someone?
  - How do I add items to my list?
  - Can I use Gather Lists on multiple devices?
  - How do I change my profile picture?
  - How do I create and manage recipes?
  - Is my data private and secure?
  - How do I switch between light and dark mode?
  - How do I delete my account?
  - How do I contact support?
- [ ] Accordion uses CSS-only expand/collapse (no JavaScript required) — `<details>`/`<summary>` elements
- [ ] Contact section at the bottom with support email: `support@gatherlists.com`
- [ ] Back link to `gatherlists.com` (marketing page)
- [ ] Matches visual style of `privacy.html` (container card, system font stack, rounded corners, subtle shadow)
- [ ] Responsive design — works on mobile and desktop
- [ ] Lint passes (HTML validity)

### US-003: Vercel Routing — Serve Marketing at Root, App at /app

**Description:** As a developer, I need to update the Vercel routing so the marketing page is served at `/`, the React app at `/app`, and the support page at `/support`.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Update `vercel.json` rewrites so:
  - `/` serves `public/index-marketing.html`
  - `/app` and `/app/*` serve `index.html` (the React SPA)
  - `/support` serves `public/support.html`
  - `/privacy.html` continues to serve `public/privacy.html`
  - `/.well-known/*` continues to pass through
  - All other routes fall through to the SPA at `/app`
- [ ] Update the Vite config `base` option to `/app` so all built assets are served under `/app/assets/`
- [ ] Update the PWA manifest `start_url` and `scope` to `/app`
- [ ] Update the service worker scope to `/app`
- [ ] Update any hardcoded references to `/` in the React app that assume root (e.g., login redirects, OAuth callbacks)
- [ ] Update Supabase auth redirect URLs to use `gatherlists.com/app` instead of `gatherlists.com`
- [ ] The marketing page links "Open App" / "Try Web App" to `/app`
- [ ] Existing Universal Links / deep links still work (route to `/app` paths)
- [ ] Build succeeds (`npm run build`)
- [ ] Verify in browser: `gatherlists.com` shows marketing page, `gatherlists.com/app` shows the React app

### US-004: Update App Store Metadata

**Description:** As a developer preparing for submission, I need the App Store metadata to accurately reflect the current native iOS app features.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Review `docs/app-store/metadata.md` against the actual native iOS app features
- [ ] Verify the description accurately describes current capabilities (review what's real vs. aspirational)
- [ ] Update Support URL to `https://gatherlists.com/support`
- [ ] Update Marketing URL to `https://gatherlists.com`
- [ ] Verify subtitle is ≤30 characters (current: "Gather your lists, meals, and more." is 35 chars — needs trimming)
- [ ] Verify keywords are ≤100 characters total
- [ ] Update "What's New" text if needed
- [ ] Ensure no references to features that don't exist in the native app
- [ ] File saved and committed

### US-005: Create Screenshot Test Data

**Description:** As a developer preparing screenshots, I need realistic, visually appealing data in the test account so the App Store screenshots look professional.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** required (`Supabase`, `screenshot account: screenshots@gatherlists.com / Test1234`, `timing: upfront`)

**Acceptance Criteria:**

- [ ] Log into the screenshot account (`screenshots@gatherlists.com` / `Test1234`) via the iOS Simulator app or web app
- [ ] Create 4-5 lists with varied names, colors, and emojis:
  - "🛒 Weekly Groceries" (green) — primary list, 12-15 items with images, grouped by store/category
  - "🎉 Party Supplies" (purple/pink) — 6-8 fun items
  - "✈️ Trip Packing" (blue) — packing list type, 8-10 items
  - "🏠 Home Essentials" (orange) — basic list, 5-6 items
  - "🍳 Meal Prep" (yellow) — grocery list, 8-10 items
- [ ] Primary list ("Weekly Groceries") has items with:
  - Product images attached (use the image search feature)
  - Multiple stores assigned (e.g., Walmart, Target, Costco)
  - Mix of checked and unchecked items
  - Quantities and units on some items
- [ ] Create 2 recipe collections:
  - "Weeknight Dinners" (🍝) — 3-4 recipes with images, ingredients, and steps
  - "Healthy Breakfasts" (🥗) — 2-3 recipes with images
- [ ] At least 1 recipe has a hero image
- [ ] Share at least 1 list with the e2e test account (`e2e-test@gatherapp.dev`) so collaborator avatars are visible in screenshots
- [ ] Configure at least 1 home screen widget (if possible on Simulator)
- [ ] Data looks natural and realistic — not "Test Item 1", "Test Item 2"

### US-006: Capture App Store Screenshots

**Description:** As a developer, I need to capture polished screenshots on iPhone 15 Pro Max Simulator for the App Store listing.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** required (`Supabase`, `screenshot account: screenshots@gatherlists.com / Test1234`, `timing: upfront`)

**Acceptance Criteria:**

- [ ] All screenshots captured on iPhone 15 Pro Max Simulator (6.7" — 1290 × 2796)
- [ ] Status bar shows 9:41 AM (Apple's standard) — set Simulator time if possible
- [ ] Capture the following screens in **light mode** (6-8 screenshots):
  1. **Lists overview** — ListBrowserView showing 4-5 lists with colors, emojis, shared indicators
  2. **Shopping list detail** — Items grouped by store/category with product images, some checked
  3. **Add item** — Add item bar active with autocomplete suggestions visible
  4. **Recipe collections** — CollectionBrowserView showing collections with recipe counts
  5. **Recipe detail** — RecipeDetailView with hero image, ingredients, steps
  6. **Sharing** — Share modal open on a list, or shared list with collaborator avatars visible
  7. **Dark mode** — Lists overview or shopping list detail in dark mode
  8. **Widgets** (optional) — Home screen showing Gather Lists widget if feasible on Simulator
- [ ] Screenshots saved to `docs/app-store/screenshots/iphone-6.7/` with descriptive filenames
- [ ] Screenshots are clean — no debug overlays, no console logs visible, no error states
- [ ] Each screenshot shows meaningful, realistic data (from US-005)
- [ ] Screenshots committed to the repo

### US-007: Update Screenshot README

**Description:** As a developer, I need the screenshot guide updated to reflect what was actually captured and how.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Update `docs/app-store/screenshots/README.md` with:
  - List of actual screenshots captured with filenames and descriptions
  - Device and Simulator version used
  - Date captured
  - Note on test data setup (reference US-005)
- [ ] Remove references to Capacitor-based capture methods (Capacitor was retired)
- [ ] Update the recommended screenshots list to match what was actually captured
- [ ] File saved and committed

## Functional Requirements

- FR-1: `gatherlists.com` (root) serves a static marketing landing page — not the React app
- FR-2: `gatherlists.com/app` serves the React PWA (SPA with catch-all routing)
- FR-3: `gatherlists.com/support` serves a static support/FAQ page
- FR-4: `gatherlists.com/privacy.html` continues to serve the existing privacy policy
- FR-5: All static pages (marketing, support, privacy) are pure HTML + CSS — no JavaScript, no React
- FR-6: All static pages are responsive and match the visual style of the existing `privacy.html`
- FR-7: App Store metadata accurately reflects the native iOS app's current features
- FR-8: App Store screenshots show realistic data on iPhone 15 Pro Max Simulator
- FR-9: Support URL and Marketing URL in metadata point to the correct pages

## Non-Goals

- No analytics or tracking on marketing/support pages
- No contact form with backend — just an email link
- No blog or changelog page
- No A/B testing or conversion optimization
- No iPad screenshots (can be added later)
- No App Store Connect submission itself — this PRD prepares the assets only
- No localization of marketing/support pages

## Design Considerations

- **Visual consistency:** Marketing and support pages should share the same design language as `privacy.html` — clean white card on light gray background, system font stack, rounded corners, subtle shadow
- **Brand assets:** Use logos from `public/logo/` — do NOT regenerate SVGs. Available variants:
  - `stacked.svg` — best for marketing hero (icon + name + tagline, vertical layout)
  - `icon-name.svg` — horizontal logo for headers
  - `icon-only.svg` — app icon only
- **Brand colors:** Primary green `#4CAF50`, dark mode background `#1a1a2e`, text `#333`
- **App Store badge:** Use Apple's official "Download on the App Store" SVG badge. Link to `https://apps.apple.com/app/id6760205400`.

## Technical Considerations

- **Routing change is the riskiest story (US-003).** Moving the React app from `/` to `/app` touches Vite config, PWA manifest, service worker, OAuth redirects, and Universal Links. This should be implemented carefully and tested thoroughly.
- **Vercel serves files from `public/` before catch-all rewrites.** This means `public/support.html` will be served at `/support.html` automatically, but we need a rewrite for `/support` (without `.html`) to also serve it.
- **PWA scope change:** Changing `scope` from `/` to `/app` may require users to re-install the PWA. This is acceptable since the app is pre-launch.
- **Screenshot capture on Simulator:** Use `xcrun simctl io booted screenshot <filename>.png` for clean captures. Set the status bar time with `xcrun simctl status_bar booted override --time "9:41"`.
- **Existing `scripts/capture-screenshots.js`** is Playwright-based and captures the web version — it does NOT capture the native iOS app. Screenshots for this PRD should be from the native iOS Simulator, not Playwright.

## Definition of Done

- `gatherlists.com` shows a professional marketing landing page with App Store badge, feature highlights, and links to support/privacy/app
- `gatherlists.com/app` serves the React PWA with full functionality (login, lists, recipes, etc.)
- `gatherlists.com/support` shows a FAQ page with 8-10 questions and a contact email
- `gatherlists.com/privacy.html` continues to work unchanged
- App Store metadata in `docs/app-store/metadata.md` is accurate and complete with correct Support/Marketing URLs
- `docs/app-store/screenshots/iphone-6.7/` contains 6-8 clean screenshots from iOS Simulator showing realistic data
- All static pages are responsive and visually consistent
- Build succeeds, no broken routes, OAuth still works at the new `/app` path

## Credential & Service Access Plan

| Service | Credential Type | Needed For | Request Timing | Fallback if Not Available |
|---------|-----------------|------------|----------------|---------------------------|
| Supabase | Screenshot account (`screenshots@gatherlists.com` / `Test1234`) | US-005, US-006 | upfront | Cannot create test data or capture authenticated screenshots without credentials |
| Supabase | E2E test account (`e2e-test@gatherapp.dev`) | US-005 (shared list target) | upfront | Share with screenshot account's own second device instead |
| App Store Connect | Apple Developer account | Submitting app (not in this PRD) | after-initial-build | All assets can be prepared without App Store Connect access |

## Manual Steps (Not Automated)

After US-003 (routing change) is deployed:

- [ ] **Supabase Dashboard:** Update auth redirect URLs in Supabase project dashboard (Authentication → URL Configuration):
  - Add `https://gatherlists.com/app` to Redirect URLs
  - Update Site URL to `https://gatherlists.com/app` (or keep as `https://gatherlists.com` and add `/app` to allowed redirects)
  - Keep `http://localhost:4000` for local dev
  - Keep `https://gatherlists.com` as a fallback redirect during transition

## Open Questions

~~What is the support contact email address?~~ → `support@gatherlists.com` (Namecheap email forwarding configured)

~~Is there a second test account available?~~ → Yes, use `e2e-test@gatherapp.dev` as the share target for collaborator avatar screenshots.

~~What is the App Store app ID?~~ → `6760205400`

~~Does the Supabase auth redirect URL list need updating?~~ → Yes, added as manual step above.
