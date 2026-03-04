# PRD: Rebrand ShoppingListAI → Gather

**Status:** Draft
**Created:** 2026-03-04
**Author:** Planner

## Overview

Full rebrand of ShoppingListAI to **Gather**. Every user-facing and machine-readable reference to "ShoppingListAI" becomes "Gather" (or the appropriate derivative). This includes UI text, PWA metadata, iOS/Capacitor config, Supabase edge functions, App Store metadata, legal pages, internal docs, and package manifests.

**Tagline:** "Gather your lists, meals, and more."

### What's Blocked

Three aspects of this rebrand require assets/decisions the user will provide separately:

1. **Logo** — New logo image file (will replace current logo in Login, App header, PWA icons, favicon, apple-touch-icon)
2. **Brand colors** — New color palette (will update CSS custom properties / design tokens)
3. **Custom domain** — New domain (e.g., `getgather.app`) replacing `shoppinglistai.vercel.app` (affects CORS origins, Apple Sign-In config, Universal Links, privacy policy URLs, entitlements)

Stories that depend on these are marked with `⏳ BLOCKED` and can be implemented once assets arrive.

---

## User Stories

### Phase 1: Core UI Rebrand (Not Blocked)

#### US-001: Update App Header Branding
**Priority:** High
**Files:** `src/App.jsx`

Replace "ShoppingListAI" with "Gather" in the desktop header logo area (line ~614) and any welcome/greeting text (line ~515).

**Acceptance Criteria:**
- Desktop header displays "Gather" instead of "ShoppingListAI"
- Welcome message references "Gather"
- No visual layout regression — same spacing, font weight, alignment

---

#### US-002: Update Login Screen Branding
**Priority:** High
**Files:** `src/components/Login.jsx`

Replace "ShoppingListAI" with "Gather" on the login screen (line ~69). Add the tagline "Gather your lists, meals, and more." below the app name.

**Acceptance Criteria:**
- Login screen shows "Gather" as the app name
- Tagline appears below the app name in a lighter/smaller font treatment
- Login screen looks clean and balanced with the new text

---

#### US-003: Update PWA Install Banner
**Priority:** High
**Files:** `src/components/PWAInstallBanner.jsx`

Replace "ShoppingListAI" with "Gather" in the install banner text (line ~41). Include tagline in the banner description.

**Acceptance Criteria:**
- PWA install banner shows "Gather" as the app name
- Tagline "Gather your lists, meals, and more." appears in the banner
- Banner layout and dismiss behavior unchanged

---

#### US-004: Update Page Title & HTML Metadata
**Priority:** High
**Files:** `index.html`

Update the `<title>` tag (line ~6), meta description, and `apple-mobile-web-app-title` (line ~17) to use "Gather".

**Acceptance Criteria:**
- Browser tab shows "Gather" as page title
- Meta description references Gather
- iOS home screen bookmark shows "Gather"

---

#### US-005: Update PWA Manifest
**Priority:** High
**Files:** `vite.config.js`

Update the VitePWA plugin manifest config: `name` → "Gather", `short_name` → "Gather", `description` → updated to reference Gather (lines ~12-14).

**Acceptance Criteria:**
- PWA manifest name and short_name are "Gather"
- PWA manifest description references Gather
- `npm run build` succeeds with updated manifest

---

#### US-006: Update package.json Name
**Priority:** Medium
**Files:** `package.json`

Change the `name` field (line ~2) from `"shoppinglistai"` to `"gather"`.

**Acceptance Criteria:**
- `package.json` name is `"gather"`
- `npm install` succeeds without errors
- `package-lock.json` regenerates cleanly

---

#### US-007: Update Capacitor Config
**Priority:** High
**Files:** `capacitor.config.ts`

Update `appId` from `"com.shoppinglistai"` to `"com.gather.app"` (or user's chosen bundle ID) and `appName` from `"ShoppingListAI"` to `"Gather"` (lines ~4-5).

**Note:** Changing the bundle ID means this is effectively a new app in the App Store. The user should confirm the new bundle ID before Builder implements this.

**Acceptance Criteria:**
- `capacitor.config.ts` uses new appId and appName
- `npx cap sync` succeeds

---

#### US-008: Update iOS Info.plist
**Priority:** High
**Files:** `ios/App/App/Info.plist`

Update `CFBundleDisplayName` (line ~10), URL scheme name (line ~30), and URL scheme identifier (line ~33) to use "Gather" and the new bundle ID.

**Acceptance Criteria:**
- iOS display name is "Gather"
- URL scheme uses gather-based identifiers
- Info.plist is valid XML

---

#### US-009: Update Xcode Project Bundle Identifiers
**Priority:** High
**Files:** `ios/App/App.xcodeproj/project.pbxproj`

Update `PRODUCT_BUNDLE_IDENTIFIER` entries (lines ~312, ~335) from `com.shoppinglistai` to the new bundle ID.

**Acceptance Criteria:**
- All bundle identifier references use the new ID
- Xcode project file is valid and parseable

---

#### US-010: Update Privacy Policy
**Priority:** High
**Files:** `public/privacy.html`, `docs/app-store/privacy-policy.md`

Replace all instances of "ShoppingListAI" with "Gather" in the public-facing privacy policy and its markdown source (lines ~6, 103, 109, 181, 196 in privacy.html).

**Acceptance Criteria:**
- Privacy policy HTML and markdown both reference "Gather" throughout
- No broken HTML structure
- Page renders correctly at `/privacy.html`

---

#### US-011: Update App Store Metadata
**Priority:** High
**Files:** `docs/app-store/metadata.md`, `docs/app-store/app-privacy-labels.md`

Update all App Store copy to use "Gather" as the app name. Add the tagline to the App Store description. Update `docs/app-store/app-privacy-labels.md` header.

**Acceptance Criteria:**
- App Store title is "Gather"
- App Store subtitle includes tagline
- Description copy uses "Gather" throughout
- Privacy labels document references "Gather"

---

#### US-012: Update Supabase Config
**Priority:** Low
**Files:** `supabase/config.toml`

Update `project_id` (line ~5) from ShoppingListAI-based name to gather-based name.

**Acceptance Criteria:**
- `supabase/config.toml` project_id references "gather"

---

#### US-013: Update Internal Docs & Agent Config
**Priority:** Low
**Files:** `docs/project.json`, `docs/prds/*.json` (13 files), `docs/bugs/prd-bugs.json`, `docs/review.md`

Update the `name` field in `docs/project.json` to "Gather". Update `project` fields in all PRD JSON files. Update references in bug tracking and review docs.

**Acceptance Criteria:**
- `docs/project.json` name is "Gather"
- All PRD JSON files have `"project": "Gather"`
- Bug PRD references updated
- `docs/review.md` references updated

---

#### US-014: Update SQL Migration Comments
**Priority:** Low
**Files:** `supabase/migrations/*.sql` (4 files)

Update comment headers in migration files that reference "ShoppingListAI".

**Acceptance Criteria:**
- Migration file comments reference "Gather"
- SQL files remain valid and executable

---

#### US-015: Update Service JSDoc
**Priority:** Low
**Files:** `src/services/database.js`

Update JSDoc comment (line ~2) referencing "ShoppingListAI".

**Acceptance Criteria:**
- JSDoc comment references "Gather"

---

### Phase 2: Blocked on Logo & Colors ⏳

#### US-016: Replace Logo Assets ⏳ BLOCKED on logo file
**Priority:** High
**Files:** `public/favicon.ico`, `public/apple-touch-icon.png`, PWA icon files (192x192, 512x512), `src/App.jsx` (logo rendering), `src/components/Login.jsx` (logo rendering)

Replace the current logo/icon across all touchpoints with the new Gather logo provided by the user. Generate required sizes: favicon (16x16, 32x32), apple-touch-icon (180x180), PWA icons (192x192, 512x512).

**Acceptance Criteria:**
- All icon sizes generated from the new logo
- Favicon displays correctly in browser tabs
- Apple touch icon renders on iOS home screen
- PWA install uses new icon
- App header and login screen show new logo
- No broken image references

---

#### US-017: Update Brand Colors ⏳ BLOCKED on color palette
**Priority:** High
**Files:** CSS custom properties / design tokens (likely in `src/App.module.css` or a global stylesheet)

Apply the new brand color palette provided by the user. Update primary, secondary, and accent colors across the app.

**Acceptance Criteria:**
- All brand colors updated to new palette
- Dark mode colors adjusted to complement new palette
- No contrast/accessibility regressions (WCAG AA minimum)
- Login screen, header, buttons, and accent elements all use new colors

---

### Phase 3: Blocked on Custom Domain ⏳

#### US-018: Update CORS Origins in Edge Functions ⏳ BLOCKED on domain
**Priority:** High
**Files:** `supabase/functions/search-products/index.ts`, `supabase/functions/search-images/index.ts`

Replace `shoppinglistai.vercel.app` CORS origin with the new custom domain in all edge functions.

**Acceptance Criteria:**
- Both edge functions accept requests from the new domain
- Old domain removed from CORS allowlist (or kept temporarily for migration)
- Edge functions deploy successfully with `supabase functions deploy`

---

#### US-019: Update Apple Sign-In Config ⏳ BLOCKED on domain
**Priority:** High
**Files:** `src/context/AuthContext.jsx`

Update the Apple Sign-In `clientId` and `redirectURI` (lines ~107-108) to use the new bundle ID and domain.

**Acceptance Criteria:**
- Apple Sign-In clientId matches new bundle ID
- redirectURI points to new domain
- Apple Sign-In flow works end-to-end (requires Apple Developer portal updates too)

---

#### US-020: Update Universal Links & Entitlements ⏳ BLOCKED on domain
**Priority:** High
**Files:** `public/.well-known/apple-app-site-association`, `ios/App/App/App.entitlements`

Update the apple-app-site-association file with the new bundle ID (lines ~6, 12). Update App.entitlements associated domains (line ~11) to the new domain.

**Acceptance Criteria:**
- AASA file contains new bundle ID and correct paths
- Entitlements reference new domain for associated domains
- Universal Links verification passes on the new domain

---

#### US-021: Update Privacy Policy URLs ⏳ BLOCKED on domain
**Priority:** Medium
**Files:** `public/privacy.html`

Update any URLs in the privacy policy that reference `shoppinglistai.vercel.app` to the new custom domain.

**Acceptance Criteria:**
- All URLs in privacy policy point to new domain
- No broken links

---

### Phase 4: Optional / Deferred

#### US-022: Rename ShoppingList React Components (Optional)
**Priority:** Low
**Files:** `src/components/ShoppingList.jsx`, `src/context/ShoppingListContext.jsx`, `src/hooks/useShoppingList.js`, `src/App.jsx`, `src/components/MobileListDetail.jsx`, `src/main.jsx`

Consider renaming internal React component/context/hook names from `ShoppingList` to something more aligned with the "Gather" brand (e.g., `GroceryList`, `ListManager`, or keep as-is since "shopping list" is a descriptive term, not a brand name).

**Recommendation:** Keep as-is. "ShoppingList" is a descriptive term for the feature, not the brand name. Renaming would be a large refactor with risk and no user-facing benefit.

**Acceptance Criteria (if done):**
- All component, context, hook, and import references updated consistently
- No broken imports
- App functions identically after rename

---

## Credential & Service Access Plan

| Service | Credential Type | Stories | Request Timing | Fallback |
|---------|----------------|---------|----------------|----------|
| Apple Developer Portal | Developer account access | US-007, US-008, US-009, US-019, US-020 | After initial build | Local build works; App Store submission blocked |
| Vercel | Project settings access | US-018 (domain), US-021 | After initial build | Dev/preview deploys work on existing domain |
| Supabase Dashboard | Project admin | US-018 (edge function deploy) | After initial build | Local edge function testing works |
| Custom Domain Registrar | Domain DNS access | US-018, US-019, US-020, US-021 | After initial build | All non-domain stories can proceed |

No new API keys or secrets are required. The rebrand uses existing service accounts — only configuration values change.

---

## Flag Review

| Story | Support Article? | Tools? | Test Intensity | Reasoning |
|-------|------------------|--------|----------------|-----------|
| US-001: App Header | ❌ No | ❌ No | low | Text swap |
| US-002: Login Screen | ❌ No | ❌ No | low | Text + tagline addition |
| US-003: PWA Install Banner | ❌ No | ❌ No | low | Text swap |
| US-004: HTML Metadata | ❌ No | ❌ No | low | Config change |
| US-005: PWA Manifest | ❌ No | ❌ No | low | Config change |
| US-006: package.json | ❌ No | ❌ No | low | Config change |
| US-007: Capacitor Config | ❌ No | ❌ No | medium | Affects native build |
| US-008: iOS Info.plist | ❌ No | ❌ No | medium | Affects native build |
| US-009: Xcode Bundle IDs | ❌ No | ❌ No | medium | Affects native build |
| US-010: Privacy Policy | ❌ No | ❌ No | low | Text swap |
| US-011: App Store Metadata | ❌ No | ❌ No | low | Text swap |
| US-012: Supabase Config | ❌ No | ❌ No | low | Internal config |
| US-013: Internal Docs | ❌ No | ❌ No | low | Docs only |
| US-014: SQL Comments | ❌ No | ❌ No | low | Comments only |
| US-015: Service JSDoc | ❌ No | ❌ No | low | Comment only |
| US-016: Logo Assets | ❌ No | ❌ No | medium | Visual assets |
| US-017: Brand Colors | ❌ No | ❌ No | medium | Visual styling |
| US-018: CORS Origins | ❌ No | ❌ No | high | Functional — breaks API calls if wrong |
| US-019: Apple Sign-In | ❌ No | ❌ No | high | Functional — breaks auth if wrong |
| US-020: Universal Links | ❌ No | ❌ No | high | Functional — breaks deep links if wrong |
| US-021: Privacy URLs | ❌ No | ❌ No | low | Text swap |
| US-022: Component Rename | ❌ No | ❌ No | medium | Large refactor (recommended: skip) |

No support articles or AI tools updates needed — this is purely a branding/config change.

---

## Definition of Done

Implementation is complete when:

1. **Zero references to "ShoppingListAI" in user-facing UI** — Login screen, app header, PWA install banner, page title all show "Gather"
2. **Tagline visible** in login screen, PWA install banner, App Store description, and desktop header
3. **PWA manifest** uses "Gather" for name, short_name, and description
4. **HTML metadata** (`<title>`, meta description, apple-mobile-web-app-title) all reference "Gather"
5. **Capacitor config** uses new bundle ID and "Gather" app name
6. **iOS config files** (Info.plist, project.pbxproj) use new bundle ID and "Gather" display name
7. **Privacy policy** (HTML + markdown) references "Gather" throughout
8. **App Store metadata** uses "Gather" with tagline
9. **package.json** name updated; `npm install` and `npm run build` succeed
10. **Internal docs** (project.json, PRD JSONs, bugs, review) updated
11. **`npm run build` succeeds** with no ShoppingListAI references in the build output
12. **`npx cap sync` succeeds** with updated Capacitor config
13. **(When logo provided)** All icon sizes generated and rendering correctly
14. **(When colors provided)** New color palette applied with WCAG AA contrast compliance
15. **(When domain provided)** CORS origins, Apple Sign-In, Universal Links, and privacy URLs all point to new domain

---

## Implementation Notes for Builder

- **Phase 1 (US-001 through US-015) can start immediately** — no external blockers
- **Phase 2 (US-016, US-017)** requires logo file and color palette from the user
- **Phase 3 (US-018 through US-021)** requires the custom domain to be purchased and DNS configured
- **US-022 is optional** and recommended to skip — "ShoppingList" as a React component name is descriptive, not branding
- When changing the Capacitor bundle ID (US-007), this creates a **new app identity** — the old `com.shoppinglistai` app and the new `com.gather.app` will be treated as different apps by iOS. Dorian should confirm the new bundle ID before implementation.
- Perform a global search for `ShoppingListAI`, `shoppinglistai`, `shopping-list-ai`, and `Shopping List AI` (case-insensitive) after all changes to verify nothing was missed.
