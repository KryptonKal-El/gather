# PRD: iOS Asset Rebrand

**Status:** Ready
**Created:** 2026-03-05
**Author:** Planner

## Introduction

The iOS app icon and splash screen assets still use the old ShoppingListAI branding (green `#4caf50` background with a white shopping cart + "AI" text). These need to be regenerated using the new Gather logo and brand colors. The `generate-icons.js` script that procedurally draws the old logo must be updated, and the Capacitor splash screen background color in `capacitor.config.ts` must be changed from the old green to the new Gather palette.

The designer-provided Gather logo SVG is at `public/logo/icon-only.svg` — a rounded rectangle with the Gather gradient (`#B5E8C8` → `#A8D8EA`), white list-item dots/bars, and a pink heart accent.

**Key rule:** Use the original designer SVG file directly. Do NOT hand-draw or recreate logo geometry in code. Convert the SVG to PNG at the required sizes.

## Goals

- Replace old ShoppingListAI app icon with the Gather logo across all iOS asset sizes
- Replace old splash screen with Gather-branded splash (new logo + brand colors)
- Update `capacitor.config.ts` splash background color
- Regenerate all Xcode asset catalog images so the iOS build uses the new branding

## User Stories

### US-001: Update Icon Generation Script for Gather Logo

**Description:** As a developer, I need the `scripts/generate-icons.js` script updated to produce icons using the new Gather logo instead of the old procedurally-drawn ShoppingListAI cart icon.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `scripts/generate-icons.js` converts `public/logo/icon-only.svg` to PNG at required sizes instead of procedurally drawing the old ShoppingListAI logo
- [ ] SVG → PNG conversion uses a proper rasterizer (e.g., `sharp`, `@resvg/resvg-js`, or Puppeteer/Playwright screenshot — pick whatever is simplest to add as a dev dependency)
- [ ] PWA icons generated: `public/icon-64x64.png`, `public/icon-192x192.png`, `public/icon-512x512.png`
- [ ] Capacitor source assets generated: `assets/icon-only.png` (1024x1024, opaque/square, no rounded corners — Apple applies its own mask), `assets/icon-foreground.png` (same)
- [ ] The 1024x1024 icon fills the full square canvas — the SVG's rounded rect should be scaled/padded appropriately so Apple's corner mask looks correct (do NOT bake in rounded corners)
- [ ] Generated icons visually match the Gather logo (gradient background, white list items, pink heart)
- [ ] Old procedural drawing code (cart, "AI" text, `#4caf50` green) is removed from the script
- [ ] `node scripts/generate-icons.js` runs successfully
- [ ] Lint passes

### US-002: Update Splash Screen Assets for Gather Branding

**Description:** As a developer, I need the splash screen assets regenerated with the new Gather branding so the app launch screen reflects the rebrand.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `assets/splash.png` (2732x2732) regenerated: Gather gradient background (`#B5E8C8` → `#A8D8EA` diagonal) with the Gather logo centered at an appropriate size (~400-600px)
- [ ] `assets/splash-dark.png` (2732x2732) regenerated: dark background (e.g., `#1a1a2e` or similar dark tone) with the Gather logo centered — keeps the logo's own gradient colors
- [ ] Splash generation added to `scripts/generate-icons.js` (or a separate script) — should be reproducible, not a manual export
- [ ] Old splash generation code (solid `#4caf50` green with cart icon) is removed
- [ ] Update `capacitor.config.ts` → `SplashScreen.backgroundColor` from `"#4caf50"` to a color that matches the new splash (e.g., `"#B5E8C8"` or `"#AEDFD9"` — the midpoint of the gradient)
- [ ] Lint passes

### US-003: Regenerate Xcode Asset Catalog and Verify

**Description:** As a developer, I need all iOS asset catalog images regenerated from the new source assets so Xcode uses the updated Gather branding.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Run `node scripts/generate-icons.js` to produce updated source PNGs in `assets/` and `public/`
- [ ] Run `npx capacitor-assets generate --ios` to regenerate the Xcode asset catalog from updated source PNGs
- [ ] `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` shows the new Gather logo
- [ ] `ios/App/App/Assets.xcassets/Splash.imageset/` — all 6 images (3 light + 3 dark) show the new Gather branding
- [ ] Run `npm run build && npx cap sync ios` successfully
- [ ] No yellow warning triangles in Xcode asset catalog
- [ ] Lint passes

## Functional Requirements

- FR-1: All iOS app icon assets must display the Gather logo (gradient rounded rect with list items and heart), not the old ShoppingListAI cart icon
- FR-2: Splash screen must use Gather brand colors (`#B5E8C8` → `#A8D8EA` gradient) with the logo centered, not the old solid `#4caf50` green
- FR-3: Dark mode splash must use a dark background with the Gather logo
- FR-4: PWA icons in `public/` must also be updated to the Gather logo
- FR-5: The icon generation process must be scripted and reproducible (not manual exports)
- FR-6: The SVG source file (`public/logo/icon-only.svg`) must not be modified — use it as-is

## Non-Goals

- No changes to the SVG logo files themselves
- No App Store screenshot updates (separate concern)
- No changes to the web app UI — this is purely native asset generation
- No new icon sizes beyond what already exists

## Technical Considerations

- **Source SVG:** `public/logo/icon-only.svg` — viewBox `76 60 148 148`, contains gradient, shadows, and paths
- **SVG rasterization:** The current script uses raw pixel manipulation (no SVG support). A library like `sharp` (with built-in SVG via librsvg) or `@resvg/resvg-js` (pure Rust, no system deps) can rasterize SVGs to PNG. Pick the one with fewer install issues.
- **App icon canvas:** Apple requires a 1024x1024 opaque square with no transparency and no baked-in rounded corners (iOS applies its own corner mask). The SVG's rounded rect should be rendered onto a filled background that matches the gradient edge color so the mask looks seamless.
- **Capacitor assets tool:** `npx capacitor-assets generate --ios` reads from `assets/icon-only.png`, `assets/icon-foreground.png`, `assets/splash.png`, and `assets/splash-dark.png`
- **Existing splash files in Xcode:** There are also 3 old `splash-2732x2732*.png` files in the Splash.imageset that may be orphaned — verify after regeneration

## Credential & Service Access Plan

No external credentials required for this PRD.

## Definition of Done

Implementation is complete when:

1. Running `node scripts/generate-icons.js` produces all PWA and Capacitor source PNGs using the Gather logo
2. Running `npx capacitor-assets generate --ios` produces updated Xcode asset catalog images
3. The iOS app icon in Xcode shows the Gather logo (gradient + list items + heart), not the old green cart
4. The iOS splash screen shows Gather branding in both light and dark mode
5. `capacitor.config.ts` splash background color is updated from `#4caf50`
6. `npm run build && npx cap sync ios` succeeds
7. All generated images are committed to git

## Success Metrics

- App icon in Xcode matches the Gather brand identity
- Splash screen provides a smooth branded launch experience
- Zero manual steps — fully scripted and reproducible

## Open Questions

- None — scope is clear and contained.
