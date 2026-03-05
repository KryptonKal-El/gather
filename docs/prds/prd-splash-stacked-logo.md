# PRD: Splash Screen Stacked Logo

**Status:** Ready
**Created:** 2026-03-05
**Author:** Planner

## Introduction

The iOS splash screen currently shows only the app icon (`icon-only.svg`). It should instead show the stacked logo (`stacked.svg`) which includes the icon, "Gather" name, and tagline "Gather your lists, meals, and more." — giving a more polished, branded launch experience.

The stacked SVG uses the Nunito font via Google Fonts `@import`. Since `sharp` rasterizes SVGs server-side without a browser, the font import won't work. The script must either embed the font or use a fallback approach to ensure the text renders correctly.

## Goals

- Replace the splash screen logo source from `icon-only.svg` to `stacked.svg`
- Ensure the "Gather" name and tagline text render correctly in the generated PNGs
- Regenerate both light and dark splash screens
- Rebuild the Xcode asset catalog with updated splashes

## User Stories

### US-001: Update Splash Generation to Use Stacked Logo

**Description:** As a developer, I need the splash screen generation in `scripts/generate-icons.js` updated to use `public/logo/stacked.svg` instead of `icon-only.svg`, so the splash shows the icon, app name, and tagline.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Splash screen generation reads `public/logo/stacked.svg` instead of extracting the icon-only inner content
- [ ] The stacked logo (icon + "Gather" + tagline) is centered on the splash canvas at an appropriate size (~600-800px tall to accommodate the full stacked layout)
- [ ] Text renders correctly — since `stacked.svg` uses `@import url(...)` for Nunito which won't work in sharp's SVG rasterizer, either: (a) download and embed the Nunito font as a base64 `@font-face` in the SVG before rasterizing, (b) use `@resvg/resvg-js` which has better font handling, or (c) replace the `@import` with a local font reference. Pick the simplest approach that produces correct output.
- [ ] `assets/splash.png` (2732x2732) — light version: white or near-white background (`#FFFFFF` or `#F8FAF9`) with stacked logo centered, text in `#3D7A63`. Do NOT use the brand gradient (`#B5E8C8` → `#A8D8EA`) as the background — it blends into the icon's own gradient and the logo doesn't stand out.
- [ ] `assets/splash-dark.png` (2732x2732) — dark version: dark background with stacked logo centered, text should be light/white for contrast (not `#3D7A63` which won't be readable on dark)
- [ ] Icon-only generation (PWA icons, Capacitor app icons) is NOT changed — only splash screens are affected
- [ ] Run `npx capacitor-assets generate --ios` to rebuild Xcode splash assets
- [ ] Run `npm run build && npx cap sync ios` successfully
- [ ] `node scripts/generate-icons.js` runs successfully
- [ ] Lint passes

## Functional Requirements

- FR-1: Splash screens must show the full stacked Gather logo (icon + name + tagline), not just the icon
- FR-2: Light splash must use a white or near-white background so the icon's gradient stands out clearly — not the brand gradient
- FR-3: Text must render as actual text, not be missing or replaced by fallback font boxes
- FR-4: Dark splash must have legible text (light text on dark background)
- FR-5: App icons are not affected by this change
- FR-6: `capacitor.config.ts` `SplashScreen.backgroundColor` should be updated to match the new light splash background (white/near-white)

## Non-Goals

- No changes to the app icon (icon-only stays for that)
- No changes to PWA icons
- No new splash sizes beyond the existing 2732x2732

## Technical Considerations

- **Font challenge:** The `stacked.svg` imports Nunito via Google Fonts `@import`. Sharp uses librsvg which won't fetch remote fonts. Options: embed font as base64 data URI, use a local `.woff2` file, or switch to `@resvg/resvg-js` for splash rasterization.
- **Stacked SVG viewBox:** `310 410 280 210` — taller aspect ratio than icon-only. The `createSplashSvg` transform logic needs to account for a non-square viewBox.
- **Dark mode text:** The stacked SVG has text fill `#3D7A63` (dark green) which won't be readable on a dark background. The dark splash generation needs to override the text fill to white or a light color.
- **Existing structure:** The `createSplashSvg` function extracts SVG inner content and re-wraps it. This approach can still work but the transform calculation needs updating for the stacked viewBox dimensions.

## Credential & Service Access Plan

No external credentials required for this PRD.

## Definition of Done

Implementation is complete when:

1. `node scripts/generate-icons.js` produces splash PNGs showing the full stacked Gather logo (icon + name + tagline)
2. Text renders correctly in both light and dark splash versions
3. Dark splash has legible light-colored text
4. Xcode asset catalog is rebuilt with updated splash images
5. App icons remain unchanged
6. `npm run build && npx cap sync ios` succeeds
