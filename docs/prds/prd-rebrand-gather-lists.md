# PRD: Rebrand "Gather" to "Gather Lists"

## Background

The name "Gather" is already taken in the Apple App Store. The app must be rebranded to **"Gather Lists"** before TestFlight submission. The designer has provided updated logo SVG files with a new two-tone name treatment: "Gather" in large bold `#3D7A63` + "Lists" in smaller/lighter `#85BFA8`.

The tagline remains unchanged: **"Gather your lists, meals, and more."**

## Scope

This PRD covers:
1. Replacing all 4 logo SVG files with the new designer-provided variants (two-tone "Gather Lists" treatment)
2. Updating every "Gather" app-name reference across the codebase to "Gather Lists"
3. Regenerating all iOS/PWA assets from the updated SVGs
4. Updating App Store metadata

**Out of scope:**
- The tagline "Gather your lists, meals, and more." stays as-is (it already contains "lists")
- The Apple Services ID `com.shoppinglistai.*` stays as-is (backend-only, users never see it)
- The bundle ID `com.gather.app` stays as-is
- The URL `gatherapp.vercel.app` stays as-is
- The `package.json` name field "gather" stays as-is (npm package name, not user-facing)
- The URL scheme `gather://` stays as-is

## Logo Treatment

The new SVG uses a **two-tone text style** for the app name:
- "Gather " — `font-size` larger, `font-weight: 800`, `fill: #3D7A63`
- "Lists" — `font-size` smaller, `font-weight: 600`, `fill: #85BFA8`

This is achieved with `<tspan>` elements in the SVG `<text>` nodes.

### Variant Details

| Variant | File | Name Text Treatment |
|---------|------|---------------------|
| APP ICON | `icon-only.svg` | No text (icon only) — unchanged |
| ICON + NAME | `icon-name.svg` | `<tspan font-size="46">Gather </tspan><tspan font-size="26" font-weight="600" fill="#85BFA8">Lists</tspan>` |
| FULL LOGO WITH TAGLINE | `icon-name-tagline.svg` | Two-tone name + tagline below |
| STACKED / CENTERED | `stacked.svg` | `<tspan font-size="52">Gather </tspan><tspan font-size="28" font-weight="600" fill="#85BFA8">Lists</tspan>` + tagline |

## Credential & Service Access Plan

No external credentials required for this PRD. All changes are local code, assets, and metadata.

---

## User Stories

### US-001: Save New All-Variants SVG Reference File ✅ PRE-COMPLETED

**Status:** Already done by Planner. The new all-variants SVG has been saved to `public/logo/gather-logo-all-variants.svg`.

**Builder action:** None — skip this story. The file is already in place.

---

### US-002: Extract and Replace Logo SVG Files

**As a** developer  
**I want** the individual logo SVG files extracted from the all-variants SVG  
**So that** each logo variant file contains the updated "Gather Lists" two-tone treatment

**Acceptance Criteria:**
- [ ] `public/logo/icon-only.svg` — **NO CHANGE NEEDED**. Current file matches the APP ICON section in the all-variants SVG exactly. Leave as-is.
- [ ] `public/logo/icon-name.svg` — Replace with the ICON + NAME section. Key changes from old:
  - Text `y` attribute: `118` → `126`
  - Single `<text>Gather</text>` → tspan treatment: `<tspan font-size="46">Gather </tspan><tspan font-size="26" font-weight="600" fill="#85BFA8">Lists</tspan>`
- [ ] `public/logo/icon-name-tagline.svg` — Replace with the FULL LOGO WITH TAGLINE section. Key changes from old:
  - Single `<text>Gather</text>` → tspan treatment: `<tspan font-size="54">Gather </tspan><tspan font-size="30" font-weight="600" fill="#85BFA8">Lists</tspan>`
- [ ] `public/logo/stacked.svg` — Replace with the STACKED / CENTERED section. Key changes from old:
  - Single `<text>Gather</text>` → tspan treatment: `<tspan font-size="52">Gather </tspan><tspan font-size="28" font-weight="600" fill="#85BFA8">Lists</tspan>`
  - Tagline `x` attribute: `450` → `463` (recentered for wider name)
- [ ] Each file is a valid standalone SVG with its own `viewBox`, `defs`, gradients, and filters
- [ ] SVG content comes directly from the designer's file — do NOT hand-modify coordinates or regenerate

**Extraction source:** `public/logo/gather-logo-all-variants.svg` (already saved by Planner)

**Key rule:** Use the original designer SVG content directly. Do not regenerate or modify SVG coordinates. Each standalone file needs its own `<defs>` with gradient + filter definitions — copy the appropriate ones from the all-variants `<defs>` section.

**Standalone SVG structure for each file:**
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="[section viewBox]" width="[w]" height="[h]">
  <defs>
    <style>@import url(...);</style>  <!-- only for files with text -->
    <linearGradient .../>
    <filter .../>
  </defs>
  [icon shapes]
  [text elements if applicable]
</svg>
```

**viewBox values** (derive from element positions in all-variants):
- `icon-only.svg`: `viewBox="76 60 148 148"` (unchanged from current)
- `icon-name.svg`: `viewBox="296 55 310 110"` (unchanged outer bounds, text content changed)
- `icon-name-tagline.svg`: `viewBox="184 236 520 108"` (unchanged outer bounds, text content changed)
- `stacked.svg`: `viewBox="310 410 280 225"` (height increased from 210→225 to accommodate new tagline position at y=621)

**Key rule:** Use the original designer SVG content directly. Do not regenerate or modify SVG coordinates.

---

### US-003: Update HTML Page Title and Meta Tags

**As a** user  
**I want** the browser tab and meta tags to say "Gather Lists"  
**So that** the app name is consistent everywhere

**Acceptance Criteria:**
- [ ] `index.html` `<title>` → `Gather Lists`
- [ ] `index.html` `<meta name="description">` → `Gather Lists — your lists, meals, and more.`
- [ ] `index.html` `<meta name="apple-mobile-web-app-title">` → `Gather Lists`

**File:** `index.html`

---

### US-004: Update Capacitor App Name

**As a** developer  
**I want** the Capacitor config to use "Gather Lists"  
**So that** the native iOS app displays the correct name

**Acceptance Criteria:**
- [ ] `capacitor.config.ts` → `appName: 'Gather Lists'`

**File:** `capacitor.config.ts`

---

### US-005: Update iOS Display Name

**As a** user  
**I want** the iOS home screen to show "Gather Lists" under the app icon  
**So that** the app name matches the App Store listing

**Acceptance Criteria:**
- [ ] `ios/App/App/Info.plist` → `CFBundleDisplayName` → `Gather Lists`

**File:** `ios/App/App/Info.plist`

---

### US-006: Update Desktop Header Branding

**As a** user  
**I want** the desktop header to show the actual "Gather Lists" logo  
**So that** the in-app branding matches the designer's treatment exactly

**Current state:** The desktop header renders icon + text manually via `<img src="/logo/icon-only.svg">` + `<h1>Gather</h1>` + `<span>tagline</span>` inside a `logoGroup > logoRow` structure.

**Target state:** Replace the entire `logoGroup` content with a single `<img>` referencing the `icon-name-tagline.svg` variant (which already contains the icon, two-tone "Gather Lists", and tagline).

**Acceptance Criteria:**
- [ ] Replace the `logoGroup` internals (logoRow with icon-only.svg img + h1 + tagline span) with a single `<img src="/logo/icon-name-tagline.svg" alt="Gather Lists" />` 
- [ ] The `<h1>` can wrap the `<img>` for semantic heading: `<h1><img src="/logo/icon-name-tagline.svg" alt="Gather Lists" class={styles.headerLogo} /></h1>`
- [ ] Style the img to fit the header appropriately (similar height to the current icon+text combo, roughly 42–48px tall)
- [ ] Remove the now-unused `.logoRow`, `.logoIcon`, `.logo`, `.tagline` CSS rules from `App.module.css` if they are no longer referenced anywhere
- [ ] Visually verify the header looks clean with the SVG logo on both light and dark themes

**Files:** `src/App.jsx`, `src/App.module.css`

---

### US-007: Update Login Screen Branding

**As a** user  
**I want** the login screen to show the actual "Gather Lists" logo  
**So that** first-time users see the designer's intended brand treatment

**Current state:** The login screen renders a stacked layout manually: `<img src="/logo/icon-only.svg">` + `<h1>Gather</h1>` + `<p>tagline</p>` inside a `logoStack`.

**Target state:** Replace the `logoStack` content with a single `<img>` referencing the `stacked.svg` variant (which already contains the icon, two-tone "Gather Lists", and tagline in a centered stacked layout).

**Acceptance Criteria:**
- [ ] Replace the `logoStack` internals (icon-only.svg img + h1 + tagline p) with a single `<img src="/logo/stacked.svg" alt="Gather Lists" class={styles.logoImg} />`
- [ ] Wrap in `<h1>` for semantics if appropriate, or use a visually hidden `<h1>Gather Lists</h1>` alongside the img for accessibility
- [ ] Style the img width to roughly 180–220px (the stacked logo is wider/taller than the icon alone)
- [ ] Remove now-unused `.logo`, `.logoIcon`, `.tagline` CSS rules from `Login.module.css` if no longer referenced
- [ ] Visually verify on both light and dark themes

**Files:** `src/components/Login.jsx`, `src/components/Login.module.css`

---

### US-008: Update Welcome Message

**As a** user  
**I want** the empty-state welcome message to say "Gather Lists"  
**So that** the branding is consistent

**Acceptance Criteria:**
- [ ] `src/App.jsx` "Welcome to Gather" → "Welcome to Gather Lists"

**File:** `src/App.jsx`

---

### US-009: Update PWA Install Banner

**As a** user  
**I want** the PWA install banner to reference "Gather Lists"  
**So that** the install prompt uses the correct name

**Acceptance Criteria:**
- [ ] `src/components/PWAInstallBanner.jsx` — all "Gather" references updated to "Gather Lists"
- [ ] "Add Gather to your home screen" → "Add Gather Lists to your home screen"
- [ ] "Install Gather" → "Install Gather Lists"
- [ ] Tagline "Gather your lists, meals, and more." remains unchanged

**File:** `src/components/PWAInstallBanner.jsx`

---

### US-010: Update Privacy Policy

**As a** user  
**I want** the privacy policy to reference "Gather Lists"  
**So that** the legal document uses the correct app name

**Acceptance Criteria:**
- [ ] `public/privacy.html` `<title>` → `Privacy Policy — Gather Lists`
- [ ] "Back to Gather" → "Back to Gather Lists"
- [ ] `Gather ("we", "our", "the app")` → `Gather Lists ("we", "our", "the app")`
- [ ] "Gather does not knowingly collect data..." → "Gather Lists does not knowingly collect data..."

**File:** `public/privacy.html`

---

### US-011: Update App Store Metadata

**As a** developer  
**I want** the App Store metadata to use "Gather Lists"  
**So that** the App Store listing has the correct name

**Acceptance Criteria:**
- [ ] `docs/app-store/metadata.md` → App Name: `Gather Lists`
- [ ] Description opening: "Gather Lists is your intelligent grocery shopping companion..."
- [ ] CTA: "Download Gather Lists today..."
- [ ] Copyright: `© 2026 Gather Lists`
- [ ] Subtitle stays: "Gather your lists, meals, and more." (unchanged)
- [ ] What's New: "Gather Lists brings AI-powered grocery shopping..."

**File:** `docs/app-store/metadata.md`

---

### US-012: Update generate-icons.js Comment

**As a** developer  
**I want** the icon generation script's JSDoc comment to reference "Gather Lists"  
**So that** the code documentation is accurate

**Acceptance Criteria:**
- [ ] `scripts/generate-icons.js` line 3 comment: "Gather Lists logo SVG" (or similar)

**File:** `scripts/generate-icons.js`

---

### US-013: Update Splash Screen Generation for Two-Tone Text

**As a** developer  
**I want** the splash screen dark-mode text color override to handle the new two-tone treatment  
**So that** dark splash screens render correctly with the "Lists" tspan

**Acceptance Criteria:**
- [ ] Review `scripts/generate-icons.js` `createStackedSplashSvg` dark mode logic
- [ ] The current dark mode replaces `fill="#3D7A63"` → white and `fill="#85BFA8"` → `#E0E0E0`
- [ ] Verify this still works correctly with the new SVG structure (tspan elements with `fill="#85BFA8"`)
- [ ] If the new stacked SVG has `fill="#85BFA8"` on the "Lists" tspan AND on the tagline, the existing regex replacement should handle both — verify and adjust if needed

**File:** `scripts/generate-icons.js`

---

### US-014: Regenerate PWA and iOS Assets

**As a** developer  
**I want** all generated assets rebuilt from the updated SVGs  
**So that** PWA icons, Capacitor icons, and splash screens reflect the "Gather Lists" branding

**Acceptance Criteria:**
- [ ] Run `node scripts/generate-icons.js` — regenerates:
  - PWA icons: `public/icon-64x64.png`, `public/icon-192x192.png`, `public/icon-512x512.png`
  - Capacitor source: `assets/icon-only.png`, `assets/icon-foreground.png`
  - Splash screens: `assets/splash.png`, `assets/splash-dark.png`
- [ ] Run `npx cap sync ios` — syncs web assets to iOS project
- [ ] Run `npx capacitor-assets generate --ios` — rebuilds Xcode asset catalog from source PNGs
- [ ] Visually verify splash.png shows "Gather Lists" with two-tone treatment
- [ ] Visually verify splash-dark.png shows "Gather Lists" with white/"Lists" in light gray

**Commands:**
```bash
node scripts/generate-icons.js
npm run build && npx cap sync ios
npx capacitor-assets generate --ios
```

---

### US-015: Update Style Guide (Optional)

**As a** designer  
**I want** the brand style guide to reflect "Gather Lists"  
**So that** the reference document is accurate

**Acceptance Criteria:**
- [ ] `public/logo/gather-style-guide.html` — update all "Gather" name references to "Gather Lists" where it refers to the app name
- [ ] Note: This file is untracked. May not need to be committed.

**File:** `public/logo/gather-style-guide.html`

---

## Definition of Done

Implementation is complete when ALL of the following are true:

1. **Logo files updated:** All 4 individual SVG files in `public/logo/` contain the new two-tone "Gather Lists" text treatment, extracted directly from the designer's all-variants SVG
2. **All-variants reference saved:** `gather-logo-all-variants.svg` replaced with the new version
3. **Text references updated:** Every user-visible instance of "Gather" (as the app name) across the codebase now reads "Gather Lists" — verified by grep showing zero standalone "Gather" app-name references (excluding tagline, URL scheme, bundle ID, package name, and code comments)
4. **iOS config updated:** `capacitor.config.ts` appName and `Info.plist` CFBundleDisplayName both say "Gather Lists"
5. **HTML meta updated:** Page title, description, and apple-mobile-web-app-title all say "Gather Lists"
6. **Assets regenerated:** PWA icons, Capacitor icons, and splash screens all rebuilt from updated SVGs — splash visually shows "Gather Lists" two-tone
7. **Xcode catalog rebuilt:** `npx capacitor-assets generate --ios` run successfully
8. **Dark splash verified:** Dark mode splash correctly renders white "Gather" + light gray "Lists"
9. **App builds:** `npm run build` succeeds with no errors
10. **iOS syncs:** `npx cap sync ios` completes without errors

## Story Dependency Order

```
US-001 ✅ (already done by Planner)
  └─> US-002 (extract individual SVGs — start here)
        └─> US-013 (verify splash generation handles new SVG)
              └─> US-014 (regenerate all assets)

US-003 through US-012 are independent of each other and can be done in parallel.
US-015 is optional and independent.
```
