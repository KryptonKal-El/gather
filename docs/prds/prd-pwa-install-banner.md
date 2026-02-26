# PRD: PWA Install Banner

## Introduction

When a user visits ShoppingListAI in a mobile browser (not already installed as a PWA), show a smart install banner at the top of the screen prompting them to add the app to their home screen. This gives the app a more native feel and increases PWA adoption by making the install path discoverable — most users don't know they can install web apps.

The banner must handle two fundamentally different platform paths:
- **Android Chrome** (and other Chromium browsers) fire the `beforeinstallprompt` event, allowing us to trigger the native install dialog directly.
- **iOS Safari** has no install API — we must show manual instructions ("Tap Share → Add to Home Screen").

The banner should be dismissible, with dismissal persisted in `localStorage` for 7 days. It should never show when the app is already running in standalone (installed) mode.

## Goals

- Increase PWA installs by making the "Add to Home Screen" action visible and easy
- Support both Android (native prompt) and iOS (manual instructions)
- Respect user intent — dismissible with 7-day cooldown before showing again
- Never show the banner when the app is already installed (standalone mode)
- Fit seamlessly into the existing iOS-style mobile UI

## User Stories

### US-001: Install Banner for Android / Chromium Browsers

**Description:** As a mobile user on Android Chrome, I want to see a banner prompting me to install the app so I can add it to my home screen with one tap.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] On Android Chrome (or any browser that fires `beforeinstallprompt`), a banner appears at the top of the screen — including on the login screen (before auth)
- [ ] The banner shows the app icon, a short message (e.g., "Add ShoppingListAI to your home screen for quick access"), and an "Install" button
- [ ] Tapping "Install" triggers the native browser install dialog via the captured `beforeinstallprompt` event
- [ ] After successful install, the banner disappears and does not show again (detect via `appinstalled` event or `display-mode: standalone`)
- [ ] The banner has a dismiss/close button (X)
- [ ] After dismissal, the banner does not show again for 7 days (persisted in `localStorage`)
- [ ] The banner does not show if the app is already running in standalone mode (`display-mode: standalone`)
- [ ] The banner does not show on desktop viewports (≥701px) — desktop users can use the browser's built-in install button
- [ ] The banner renders above the main content without overlapping or pushing the bottom tab bar
- [ ] Works in both light and dark mode
- [ ] Lint passes
- [ ] Verify in browser

### US-002: Install Banner for iOS Safari

**Description:** As a mobile user on iOS Safari, I want to see a banner with instructions on how to add the app to my home screen, since Safari doesn't support automatic install prompts.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] On iOS Safari (detected via user agent — no `beforeinstallprompt` available), a banner appears at the top of the screen — including on the login screen (before auth)
- [ ] The banner shows the app icon, a short instructional message (e.g., "Install this app: tap {share icon} then 'Add to Home Screen'")
- [ ] The share icon shown matches the iOS share icon (the square with an up-arrow) — use an inline SVG or unicode character
- [ ] Tapping the banner itself does nothing (no action available on iOS) — it is purely instructional
- [ ] The banner has a dismiss/close button (X)
- [ ] After dismissal, the banner does not show again for 7 days (persisted in `localStorage`)
- [ ] The banner does not show if the app is already running in standalone mode (`display-mode: standalone` or `navigator.standalone === true`)
- [ ] The banner does not show on desktop viewports (≥701px)
- [ ] The banner renders above the main content without overlapping or pushing the bottom tab bar
- [ ] Works in both light and dark mode
- [ ] Lint passes
- [ ] Verify in browser

### US-003: Dismissal Persistence and Standalone Detection Hook

**Description:** As a developer, I want a custom hook that manages install banner visibility logic so the banner component stays clean and the logic is reusable.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] A custom hook (e.g., `usePWAInstall`) encapsulates all install banner logic
- [ ] The hook captures and stores the `beforeinstallprompt` event (for Android)
- [ ] The hook detects iOS Safari via user agent (no `beforeinstallprompt` support)
- [ ] The hook checks `display-mode: standalone` (and `navigator.standalone` for iOS) to detect already-installed state
- [ ] The hook reads/writes a `localStorage` key to track dismissal with a 7-day TTL
- [ ] The hook exposes: `{ showBanner, platform, promptInstall, dismissBanner }` where:
  - `showBanner`: boolean — whether the banner should be visible
  - `platform`: `'android'` | `'ios'` | `null` — which platform-specific banner to show
  - `promptInstall`: function — triggers the native install prompt (Android only, no-op on iOS)
  - `dismissBanner`: function — hides the banner and persists dismissal for 7 days
- [ ] The hook listens for the `appinstalled` event and auto-hides the banner + clears the stored prompt
- [ ] The hook only activates on mobile viewports (≤700px) — uses existing `useIsMobile` hook or equivalent check
- [ ] Lint passes

## Functional Requirements

- FR-1: The install banner must appear on mobile browsers (≤700px) when the app is NOT running in standalone/installed mode — including on the login screen (before authentication)
- FR-2: On Android/Chromium browsers, the banner must capture the `beforeinstallprompt` event and use it to trigger the native install dialog when the user taps "Install"
- FR-3: On iOS Safari, the banner must show manual instructions with the iOS share icon since no install API exists
- FR-4: The banner must be dismissible with a close button, and dismissal must be persisted in `localStorage` for 7 days
- FR-5: The banner must auto-dismiss permanently once the app is installed (detected via `appinstalled` event or standalone mode on next visit)
- FR-6: The banner must render at the top of the screen, above main content, without overlapping the bottom tab bar or other fixed elements
- FR-7: The banner must use CSS custom properties from the existing theme system for light/dark mode support
- FR-8: All install logic must be encapsulated in a custom hook (`usePWAInstall`) for clean separation of concerns
- FR-9: The banner component must use CSS modules consistent with the rest of the project

## Non-Goals

- No install banner on desktop — desktop browsers have their own install affordances in the address bar
- No analytics or tracking of install rates (can be added later)
- No "smart" timing (e.g., show after 3 visits) — show immediately on first eligible visit
- No custom install UI for non-Safari iOS browsers (Chrome on iOS, Firefox on iOS) — these don't support PWA install at all, so no banner is shown for them
- No changes to the existing `PWAPrompt` component (that handles service worker updates, not installs)

## Design Considerations

- **Banner position:** Fixed at the top of the viewport, above the main content area. Should push content down (not overlay it) so nothing is hidden.
- **Banner style:** Should feel like a native iOS/Android system banner — subtle, clean, not aggressive. Use the app's existing color palette via CSS custom properties.
- **App icon:** Include the app icon (from `/public/icon-192x192.png` or the SVG) in the banner for recognition.
- **iOS share icon:** Use an inline SVG of the iOS share icon (square with up-arrow). Do not use an image file or emoji for this.
- **Height:** Keep it compact — one line of text with icon and button. Approximately 48-56px tall.
- **Animation:** Slide in from the top on appear, slide out on dismiss. Keep it quick (200-250ms).
- **Z-index:** Above main content but below modals/action sheets. Lower than the existing PWAPrompt toast (z-index: 10000).

## Technical Considerations

- **`beforeinstallprompt` event:** Must be captured on `window` early (in the hook's `useEffect`). The event is only fired once per page load and must be stored. Calling `.prompt()` on it triggers the native dialog.
- **`appinstalled` event:** Fired after successful installation on Android. Use it to clear the stored prompt and hide the banner permanently.
- **iOS detection:** Safari on iOS does not fire `beforeinstallprompt`. Detect via user agent: check for `Safari` in UA but NOT `Chrome` (Chrome on iOS is not installable). Also check `navigator.standalone` for iOS standalone detection.
- **Non-Safari iOS browsers:** Chrome/Firefox/Edge on iOS use WebKit but don't support PWA Add to Home Screen. Do NOT show the banner for these — only show for Safari on iOS.
- **`display-mode: standalone`:** Use `window.matchMedia('(display-mode: standalone)')` to detect installed state. Works on both Android and iOS.
- **`localStorage` key:** Use something like `pwa-install-dismissed` with a timestamp value. On check, compare `Date.now()` against stored timestamp + 7 days.
- **Existing hooks:** `useIsMobile` is already available for mobile detection. The new `usePWAInstall` hook can import and use it.
- **Existing `PWAPrompt`:** The current `PWAPrompt.jsx` handles service worker update notifications (a completely different concern). The install banner is a separate component. No changes needed to `PWAPrompt`.

## Definition of Done

Implementation is complete when:

1. On Android Chrome (mobile), visiting the app in browser shows an install banner with an "Install" button that triggers the native install dialog
2. On iOS Safari (mobile), visiting the app in browser shows an install banner with share icon instructions for "Add to Home Screen"
3. Dismissing the banner hides it for 7 days (verified by checking `localStorage`)
4. The banner never shows when the app is already installed (standalone mode)
5. The banner never shows on desktop viewports
6. After a successful install on Android, the banner auto-dismisses and doesn't return
7. The `usePWAInstall` hook cleanly encapsulates all detection, event handling, and persistence logic
8. Both light and dark mode are supported via CSS custom properties
9. The banner does not interfere with the bottom tab bar, action sheets, or other fixed UI elements
10. Lint passes with no new warnings

## Credential & Service Access Plan

No external credentials required for this PRD.

## Success Metrics

- Install banner is visible on first mobile browser visit (not standalone)
- One-tap install works on Android Chrome
- Clear instructions displayed on iOS Safari
- Banner respects 7-day dismissal cooldown
- Zero visual interference with existing mobile UI (tab bar, slide transitions, action sheets)

## Open Questions

- ~~Should we show the banner on the login screen (before auth) or only after the user logs in?~~ **Decided: Show on login screen (before auth)**
- ~~Should there be a "remind me later" option separate from dismiss, or is dismiss + 7-day cooldown sufficient?~~ **Decided: Dismiss + 7-day cooldown is sufficient**
