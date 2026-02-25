# PRD: iOS-Style Mobile Navigation

## Introduction

Redesign the mobile experience of ShoppingListAI to feel like a native iOS app. Currently, on mobile the app renders as a single scrollable page — the sidebar list selector stacks above the list content, and the header crams sign out, theme toggle, and username into a small bar. This PRD introduces a tab-based navigation shell with full-screen views, slide transitions, and a persistent bottom tab bar — mirroring the navigation patterns users expect from iOS apps like Reminders and Notes.

Desktop receives a visual refresh to match the new design language but retains its sidebar layout.

## Goals

- Deliver a native iOS-like navigation experience on mobile (bottom tab bar, full-screen views, slide transitions)
- Introduce three top-level tabs: **Lists**, **Stores**, **Settings**
- Make the "My Lists" screen the default landing view after login
- Tapping a list pushes a full-screen detail view with a back button (UINavigationController-style slide animation)
- Move dark mode toggle, sign out, and account info into a dedicated Settings tab
- Move Store Manager out of the list detail view into its own Stores tab
- Reorganize the list detail view: suggestions inline, recipe panel behind a button
- Refresh the desktop layout to match the new design language without changing its sidebar structure
- Use iOS-style grouped table view (rounded sections, chevrons) for list items on the My Lists screen

## User Stories

### US-001: Bottom Tab Bar Shell (Mobile)

**Description:** As a mobile user, I want a persistent bottom tab bar so I can quickly switch between Lists, Stores, and Settings.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Bottom tab bar is fixed at the bottom of the viewport on mobile (≤700px)
- [ ] Three tabs: Lists (list icon), Stores (store/shop icon), Settings (gear icon)
- [ ] Active tab is visually highlighted with the primary color
- [ ] Tab bar has a subtle top border and solid background (not transparent/translucent)
- [ ] Tab bar is hidden on desktop (≥701px)
- [ ] Tab bar is not visible on the Login screen
- [ ] Content area accounts for tab bar height (no overlap/clipping)
- [ ] Lint passes
- [ ] Verify in browser
- [ ] Works in both light and dark mode

### US-002: Mobile Navigation State Manager

**Description:** As a developer, I need a navigation state system that tracks which tab is active and which list (if any) is being viewed, so the app can render the correct full-screen view and support back navigation.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Navigation state tracks: `activeTab` ("lists" | "stores" | "settings") and `openListId` (string | null)
- [ ] When `openListId` is set, the list detail view renders full-screen (replaces the Lists tab content)
- [ ] Setting `openListId` to null returns to the My Lists screen
- [ ] Tab switches clear `openListId` (going to Stores or Settings always goes back to top-level)
- [ ] Browser back button works: pressing back from list detail returns to My Lists screen
- [ ] Navigation state is managed via React state (no router library needed — this is a single-page app)
- [ ] Navigation is only active on mobile; desktop continues to use the sidebar layout
- [ ] Lint passes

### US-003: My Lists Screen (iOS-Style Grouped Table View)

**Description:** As a mobile user, I want the My Lists screen to look like an iOS grouped table view so that lists are easy to scan and tap.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Lists render in rounded-corner sections with a card-like background
- [ ] "My Lists" section header at the top; "Shared with me" section header if shared lists exist
- [ ] Each list row shows: emoji (left), list name + item count (center), chevron `>` (right)
- [ ] Shared lists show a subtle "Shared" badge next to the name
- [ ] Rows have generous touch targets (minimum 44px height per Apple HIG)
- [ ] Tapping a row opens that list's detail view (via US-002 navigation)
- [ ] The "+" button to create a new list is prominently placed (top-right or floating)
- [ ] Three-dot menu still accessible per list (long-press or inline button) for Name & Icon, Share Settings, Delete
- [ ] "Create list" inline form appears within the section when tapped
- [ ] Empty state: friendly message encouraging creation of first list
- [ ] Lint passes
- [ ] Verify in browser
- [ ] Works in both light and dark mode

### US-004: List Detail Full-Screen View with Back Button

**Description:** As a mobile user, I want tapping a list to take over the entire screen with a back button, so I can focus on my shopping without distraction.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] List detail view fills the entire screen (tab bar still visible at bottom)
- [ ] Top navigation bar shows: back arrow (left), list name with emoji (center)
- [ ] Tapping back arrow returns to My Lists screen
- [ ] Detail view contains: AddItemForm, ShoppingList, inline Suggestions section, and a "Recipe to List" button that opens RecipePanel
- [ ] Suggestions render inline below the shopping list (collapsed by default if more than 4, with "Show more" toggle)
- [ ] RecipePanel opens as a bottom sheet or full overlay when its button is tapped
- [ ] Share button accessible from the detail view header (for owned lists, non-guest users)
- [ ] Lint passes
- [ ] Verify in browser
- [ ] Works in both light and dark mode

### US-005: Slide Transitions (iOS Push/Pop)

**Description:** As a mobile user, I want navigation to feel native with slide animations when opening and closing lists.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Opening a list slides the detail view in from the right (push)
- [ ] Going back slides the detail view out to the right, revealing My Lists underneath (pop)
- [ ] Animation duration is ~300ms with an ease-out curve (matching iOS timing)
- [ ] Animations are CSS-only (no JavaScript animation libraries)
- [ ] `prefers-reduced-motion` media query disables animations for accessibility
- [ ] Tab switches (Lists ↔ Stores ↔ Settings) have no slide animation (instant switch)
- [ ] No animation jank or layout shift during transitions
- [ ] Lint passes
- [ ] Verify in browser
- [ ] Works in both light and dark mode

### US-006: Stores Tab (Mobile)

**Description:** As a mobile user, I want a dedicated Stores tab so I can manage my stores without being inside a specific list.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Stores tab shows the full StoreManager interface (add, edit, delete, reorder stores and categories)
- [ ] StoreManager is rendered in a full-screen layout suited to mobile (not the collapsible toggle it uses now)
- [ ] On mobile, StoreManager is removed from the list detail view (it lives in the Stores tab only)
- [ ] On desktop, StoreManager remains in the list detail view as it is now (no change)
- [ ] Lint passes
- [ ] Verify in browser
- [ ] Works in both light and dark mode

### US-007: Settings Tab (Mobile)

**Description:** As a mobile user, I want a Settings screen with my account info, dark mode toggle, and sign out so these controls have a proper home instead of being crammed in the header.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Settings tab renders as an iOS-style grouped table view
- [ ] **Account section:** displays user avatar (first letter or profile image), display name, and email; shows "Guest" for anonymous users
- [ ] **Appearance section:** dark mode toggle row (label + toggle switch)
- [ ] **Account section (bottom):** Sign Out button styled as a red destructive action row
- [ ] Guest users see a prompt to "Sign in to sync across devices" above sign out
- [ ] On desktop, the header retains the existing theme toggle, username, and sign out button (no change)
- [ ] Lint passes
- [ ] Verify in browser
- [ ] Works in both light and dark mode

### US-008: Desktop Visual Refresh

**Description:** As a desktop user, I want the app to feel cohesive with the new mobile design, with a refreshed visual treatment while keeping the sidebar layout.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Desktop (≥701px) retains the sidebar + content layout
- [ ] List items in the sidebar use the same rounded-section, chevron style as mobile (iOS grouped table aesthetic)
- [ ] Typography, spacing, and color usage are consistent with the mobile redesign
- [ ] Header keeps existing controls (theme toggle, username, sign out)
- [ ] No functional changes to desktop — this is visual-only
- [ ] Lint passes
- [ ] Verify in browser
- [ ] Works in both light and dark mode

### US-009: Safe Area & PWA Adjustments

**Description:** As a PWA user on iOS, I want the app to respect safe areas and feel right when installed to the home screen.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Bottom tab bar respects `env(safe-area-inset-bottom)` for devices with home indicator (iPhone X+)
- [ ] Top navigation bar respects `env(safe-area-inset-top)` for notch/Dynamic Island
- [ ] `viewport-fit=cover` is set in the HTML meta viewport tag
- [ ] PWA standalone mode (installed to home screen) looks correct — no double status bars or clipped content
- [ ] Content does not render behind the tab bar or top bar
- [ ] Lint passes
- [ ] Verify in browser (Safari iOS and PWA mode)
- [ ] Works in both light and dark mode

## Functional Requirements

- FR-1: The app must detect mobile vs desktop via CSS media query (breakpoint: 700px) and render the appropriate navigation shell
- FR-2: On mobile, a fixed bottom tab bar with three tabs (Lists, Stores, Settings) must be visible on all authenticated screens
- FR-3: Tapping a list on the My Lists screen must push a full-screen detail view with a slide-from-right animation
- FR-4: A back button on the list detail view must pop back to My Lists with a slide-to-right animation
- FR-5: The My Lists screen must render lists in iOS-style grouped table sections (rounded corners, chevrons, section headers)
- FR-6: The Settings tab must contain account info, dark mode toggle, and sign out
- FR-7: The Stores tab must render the StoreManager in a mobile-optimized full-screen layout
- FR-8: On mobile, StoreManager must not appear in the list detail view
- FR-9: Slide animations must be CSS-only and respect `prefers-reduced-motion`
- FR-10: Desktop layout must remain sidebar-based with a visual refresh to match the new design language
- FR-11: All new UI must support both light and dark themes using existing CSS custom properties
- FR-12: Safe area insets must be handled for iOS PWA standalone mode

## Non-Goals

- No React Router or client-side routing library (navigation is managed via React state)
- No swipe-to-go-back gesture (CSS slide animation only, triggered by button tap)
- No Android-specific Material Design adaptations
- No changes to the Login screen
- No changes to business logic, Firestore operations, or data models
- No offline-first changes beyond what PWA already provides
- No new pages or features beyond reorganizing existing ones

## Design Considerations

- **Navigation pattern:** iOS UITabBarController (bottom tabs) + UINavigationController (push/pop within Lists tab)
- **Visual style:** iOS grouped table view for lists and settings — rounded section containers with inset rows on a page-level background
- **Touch targets:** Minimum 44px per Apple Human Interface Guidelines
- **Animations:** ~300ms ease-out for push/pop transitions, CSS `transform: translateX()` for performance (GPU-accelerated, no layout thrashing)
- **Breakpoint:** 700px (matches existing `@media (max-width: 700px)` in App.module.css)
- **Reuse existing components:** ShoppingList, AddItemForm, ShoppingItem, Suggestions, RecipePanel, StoreManager, ThemeToggle, EmojiPicker, ConfirmDialog, ShareListModal — these should be wrapped/reorganized, not rewritten
- **CSS modules:** Continue using CSS modules (`.module.css`) consistent with the rest of the project

## Technical Considerations

- **No new dependencies needed.** Slide transitions can be achieved with CSS transforms and React state. No routing library required.
- **Navigation state** can live in App.jsx or a small `useNavigation` custom hook. It only needs: `activeTab`, `openListId`, and transition direction for animation.
- **Conditional rendering:** Use the existing 700px media query approach. Mobile components can be conditionally rendered in JSX, or mobile/desktop can share components with CSS-only layout differences.
- **Tab bar z-index:** Must layer above content but below modals (ShareListModal, ConfirmDialog).
- **Performance:** Slide animations use `transform` (composite-only property) — no reflows. Keep both the My Lists view and the detail view mounted during transition to avoid flash of empty content.
- **PWA manifest** (`vite.config.js`) already has `display: standalone` — just need the viewport meta tag update for `viewport-fit=cover`.

## Definition of Done

Implementation is complete when:

1. On mobile (≤700px), the app shows a bottom tab bar with Lists, Stores, and Settings tabs after login
2. The My Lists screen renders as an iOS-style grouped table view with rounded sections, chevrons, and section headers
3. Tapping a list pushes a full-screen detail view with a smooth slide-from-right animation (~300ms)
4. The detail view has a back button that pops back with a slide-to-right animation
5. The detail view shows AddItemForm, ShoppingList, inline Suggestions, and a Recipe-to-List button (no StoreManager on mobile)
6. The Stores tab shows the full StoreManager in a mobile-friendly layout
7. The Settings tab shows account info (name, email, avatar), dark mode toggle, and sign out
8. Desktop (≥701px) retains its sidebar layout with a visual refresh matching the new aesthetic
9. All new UI works in both light and dark mode
10. Safe area insets are handled for iOS PWA standalone mode
11. `prefers-reduced-motion` disables animations
12. No new npm dependencies are introduced
13. Lint passes with no new warnings

## Credential & Service Access Plan

No external credentials required for this PRD.

## Success Metrics

- Mobile users can navigate between tabs with no perceptible lag (<100ms to interactive)
- Slide transitions render at 60fps with no dropped frames
- All touch targets meet 44px minimum
- Zero visual regressions on desktop
- PWA installed on iOS home screen looks and feels like a native app

## Open Questions

- Should we add a subtle haptic feedback (vibration) on tab switches for installed PWA? (Can be a follow-up)
- Should the list detail header show the item count alongside the list name?
- Should swipe-to-go-back gesture be a fast follow-up PRD?
