# PRD: iOS Home Screen & Lock Screen Widgets

## Introduction

Add WidgetKit-based home screen and lock screen widgets to the Gather Lists native iOS app. Users can place widgets that show a quick-view of a shopping/any list, upcoming due items, and an interactive quick-add field — all without opening the app. Lock screen widgets provide at-a-glance item counts and next-due-item info.

This requires establishing an App Group shared container so the widget extension can access the same Supabase session and cached data as the main app. The widget extension is a separate target in the Xcode project that shares models and a lightweight data provider with the main app.

## Goals

- Let users see their list items at a glance from the home screen without opening the app
- Show upcoming and overdue due-date items in a dedicated widget
- Enable adding items to a list directly from the home screen via an interactive widget (iOS 17+)
- Provide lock screen widgets for item counts and next-due-item previews
- Share data between the main app and widget extension via App Groups
- Keep widget data fresh with timeline-based refresh and app-triggered reloads

## User Stories

### US-001: App Groups entitlement and shared container setup

**Description:** As a developer, I need an App Group shared container so the widget extension and main app can share Supabase credentials, auth session, and cached data.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Add App Groups entitlement to `GatherLists.entitlements` with group identifier `group.com.gatherlists`
- [ ] Create a `SharedDefaults` utility that reads/writes to `UserDefaults(suiteName: "group.com.gatherlists")`
- [ ] Migrate Supabase credentials access: `SupabaseManager` writes auth session (access token, refresh token) to the shared container on login and session refresh
- [ ] On sign-out, `SupabaseManager` clears auth session from the shared container
- [ ] Create `SharedDataStore` actor that reads/writes cached list and item data to the App Group shared container (file-based JSON or UserDefaults, not the main app's `.cachesDirectory`)
- [ ] Main app writes latest lists and items to `SharedDataStore` whenever data changes (after realtime updates, pull-to-refresh, or initial load)
- [ ] Build succeeds

### US-002: Widget extension target and shared model framework

**Description:** As a developer, I need a WidgetKit extension target in the Xcode project with access to shared data models so widgets can decode list and item data.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create a new Widget Extension target named `GatherListsWidgets` in the Xcode project
- [ ] Add the same App Group entitlement (`group.com.gatherlists`) to the widget extension target
- [ ] Share `GatherList.swift` and `Item.swift` models with the widget extension (add to both targets, or create a shared framework)
- [ ] Share `SharedDefaults` and `SharedDataStore` with the widget extension
- [ ] Create a `WidgetDataProvider` that reads from `SharedDataStore` to supply data to widget timelines
- [ ] `WidgetDataProvider` provides: `fetchLists() -> [GatherList]`, `fetchItems(listId:) -> [Item]`, `fetchDueItems(listId: UUID?) -> [Item]` (nil = all lists)
- [ ] Widget extension builds and runs in the simulator
- [ ] Build succeeds (both main app and widget extension)

### US-003: Shopping List Quick-View widget — Small size

**Description:** As a user, I want a small home screen widget that shows the name and unchecked item count for a list I choose, so I can see at a glance how many items remain.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `ListQuickViewWidget` with `TimelineProvider`
- [ ] Small size displays: list emoji, list name (truncated if needed), unchecked item count (e.g. "5 items")
- [ ] Use the list's color as an accent (background tint or border)
- [ ] Widget configuration intent (`AppIntentConfiguration`) lets the user pick which list to display
- [ ] Tapping the widget deep-links to that list in the app via URL scheme (`gatherlists://list/{listId}`)
- [ ] Show placeholder/skeleton content while loading
- [ ] Works in both light and dark mode
- [ ] Build succeeds

### US-004: Shopping List Quick-View widget — Medium size

**Description:** As a user, I want a medium home screen widget that shows unchecked items from a selected list, so I can preview what I need without opening the app.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Medium size displays: list emoji + name header, list of unchecked items (up to 5-6 items depending on text length), unchecked count if more items exist (e.g. "+3 more")
- [ ] Each item row shows: item name, quantity if > 1 (e.g. "Milk x2")
- [ ] Uses the same `ListQuickViewWidget` and configuration intent as US-003
- [ ] Tapping the widget deep-links to the list
- [ ] Show placeholder content while loading
- [ ] Works in both light and dark mode
- [ ] Build succeeds

### US-005: Shopping List Quick-View widget — Large size

**Description:** As a user, I want a large home screen widget that shows more items from a selected list, giving me a fuller preview.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Large size displays: list emoji + name header, list of unchecked items (up to 10-12 items), unchecked count if more items exist
- [ ] Each item row shows: item name, quantity if > 1, unit if not "each"
- [ ] Items are sorted using the list's configured sort pipeline (read `sort_config` from cached list data)
- [ ] Uses the same `ListQuickViewWidget` and configuration intent
- [ ] Tapping the widget deep-links to the list
- [ ] Show placeholder content while loading
- [ ] Works in both light and dark mode
- [ ] Build succeeds

### US-006: Due Items widget — Small size

**Description:** As a user, I want a small home screen widget showing how many items are due soon, so I can tell at a glance if anything needs attention.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `DueItemsWidget` with `TimelineProvider`
- [ ] Small size displays: count of items due within the next 7 days (including overdue), a label like "3 due" or "All clear"
- [ ] If any items are overdue, show the count in red/orange
- [ ] Widget configuration intent lets the user choose "All Lists" or a specific list
- [ ] Tapping the widget deep-links to the app (to the selected list if specific, or the first list with due items if "All Lists")
- [ ] Show placeholder content while loading
- [ ] Works in both light and dark mode
- [ ] Build succeeds

### US-007: Due Items widget — Medium size

**Description:** As a user, I want a medium home screen widget listing my upcoming due items so I can see what's coming up this week.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Medium size displays: "Due Items" header, list of up to 4-5 items sorted by due date (soonest first)
- [ ] Each item row shows: item name, due date (abbreviated, e.g. "Mar 25"), list emoji
- [ ] Overdue items show the date in red/orange text
- [ ] Items due today show "Today" instead of the date
- [ ] Items due tomorrow show "Tomorrow"
- [ ] Uses the same `DueItemsWidget` and configuration intent (All Lists / specific list)
- [ ] Tapping an item row deep-links to that item's list
- [ ] Show placeholder content while loading
- [ ] Works in both light and dark mode
- [ ] Build succeeds

### US-008: Due Items widget — Large size

**Description:** As a user, I want a large home screen widget showing more due items with additional detail.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Large size displays: "Due Items" header with scope label (e.g. "All Lists" or list name), list of up to 8-10 items sorted by due date
- [ ] Each item row shows: item name, due date (abbreviated), list name + emoji, recurrence icon (↻) if recurring
- [ ] Overdue items show the date in red/orange text
- [ ] "Today" / "Tomorrow" date labels for items due today/tomorrow
- [ ] Section headers or visual separation between "Overdue", "Today", "This Week"
- [ ] Uses the same `DueItemsWidget` and configuration intent
- [ ] Tapping an item row deep-links to that item's list
- [ ] Show placeholder content while loading
- [ ] Works in both light and dark mode
- [ ] Build succeeds

### US-009: Quick-Add interactive widget — Small size

**Description:** As a user, I want a small home screen widget with a quick-add button that lets me add an item to a list without opening the app.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `QuickAddWidget` using `AppIntentConfiguration` (iOS 17+)
- [ ] Small size displays: list emoji + name, a "+" button
- [ ] Tapping the "+" button triggers an `AppIntent` that presents a system text input prompt
- [ ] After entering the item name, the `AppIntent` writes the new item to Supabase via the shared Supabase client (using the auth session from the App Group)
- [ ] Widget configuration intent lets the user pick which list to add items to
- [ ] After adding, the widget refreshes to show updated state
- [ ] The interaction stays in-widget — does NOT open the main app
- [ ] Show placeholder content while loading
- [ ] Works in both light and dark mode
- [ ] Build succeeds

### US-010: Quick-Add interactive widget — Medium size

**Description:** As a user, I want a medium quick-add widget that shows recent items from the target list alongside the add button.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Medium size displays: list emoji + name header, 2-3 most recently added unchecked items, a text field + "Add" button
- [ ] The text field uses `AppIntent` with a text parameter for item name input
- [ ] Submitting the text field creates a new item in the configured list via Supabase
- [ ] After adding, the widget timeline refreshes to show the new item
- [ ] Uses the same `QuickAddWidget` and configuration intent as US-009
- [ ] The interaction stays in-widget — does NOT open the main app
- [ ] Show placeholder content while loading
- [ ] Works in both light and dark mode
- [ ] Build succeeds

### US-011: Quick-Add interactive widget — Large size

**Description:** As a user, I want a large quick-add widget that shows more items from the target list and the add field, giving me a more complete view.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Large size displays: list emoji + name header, up to 6-8 unchecked items, text field + "Add" button
- [ ] Each item row shows: item name, quantity if > 1
- [ ] Submitting the text field creates a new item via Supabase and refreshes the timeline
- [ ] Uses the same `QuickAddWidget` and configuration intent
- [ ] The interaction stays in-widget — does NOT open the main app
- [ ] Show placeholder content while loading
- [ ] Works in both light and dark mode
- [ ] Build succeeds

### US-012: Lock Screen widget — Item Count

**Description:** As a user, I want a lock screen widget showing the unchecked item count for a list, so I can check at a glance without unlocking my phone.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `ItemCountLockScreenWidget` supporting `WidgetFamily.accessoryCircular` and `WidgetFamily.accessoryRectangular`
- [ ] Circular: list emoji centered with unchecked item count below (e.g. "5")
- [ ] Rectangular: list emoji + list name + unchecked item count (e.g. "🛒 Groceries — 5 items")
- [ ] Widget configuration intent lets the user pick which list
- [ ] Uses `AccessoryWidgetBackground()` for proper lock screen rendering
- [ ] Tapping the widget opens the app to that list
- [ ] Build succeeds

### US-013: Lock Screen widget — Next Due Item

**Description:** As a user, I want a lock screen widget showing my next due item, so I can see what's coming up without unlocking.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `NextDueLockScreenWidget` supporting `WidgetFamily.accessoryRectangular`
- [ ] Displays: item name (truncated if long) + due date (e.g. "Buy paint — Tomorrow")
- [ ] If no items are due, show "All clear" or "No due items"
- [ ] If the next due item is overdue, show "Overdue" label
- [ ] Widget configuration: "All Lists" or specific list
- [ ] Uses `AccessoryWidgetBackground()` for proper lock screen rendering
- [ ] Tapping the widget opens the app to the item's list
- [ ] Build succeeds

### US-014: Widget configuration intents

**Description:** As a developer, I need AppIntent-based configuration so users can pick which list a widget displays and (for due items) whether to show all lists or a specific one.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `SelectListIntent` AppIntent that provides a list picker (fetches available lists from `SharedDataStore`)
- [ ] Create `SelectListOrAllIntent` AppIntent that provides "All Lists" option plus individual list picker (for due items widgets)
- [ ] Both intents use `@Parameter` with `DynamicOptionsProvider` to load lists dynamically
- [ ] List options show emoji + name for easy identification
- [ ] Intents are shared across all widget types that need list selection
- [ ] Configuration works in the widget editing UI (long-press → Edit Widget)
- [ ] Build succeeds

### US-015: Deep-link URL scheme for widget navigation

**Description:** As a developer, I need a URL scheme so widgets can deep-link into specific lists in the main app.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Register `gatherlists://` URL scheme in `Info.plist`
- [ ] Support routes: `gatherlists://list/{listId}` (opens a specific list)
- [ ] Update existing `onOpenURL` handler in `GatherListsApp.swift` to handle the `gatherlists://` scheme in addition to existing deep links
- [ ] Navigate to the correct list when the app opens from a widget tap
- [ ] If the list no longer exists or isn't accessible, navigate to the list browser gracefully
- [ ] Build succeeds

### US-016: Timeline refresh strategy and app-triggered reloads

**Description:** As a developer, I need widgets to refresh at sensible intervals and when the main app's data changes, so widgets stay reasonably up to date.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Each widget's `TimelineProvider` returns a timeline with `policy: .after(Date().addingTimeInterval(900))` (refresh every 15 minutes)
- [ ] Main app calls `WidgetCenter.shared.reloadAllTimelines()` after any data change: item added/deleted/checked, list created/deleted, pull-to-refresh, realtime update received
- [ ] Main app writes updated data to `SharedDataStore` before calling `reloadAllTimelines()`
- [ ] Widget `getTimeline()` reads fresh data from `SharedDataStore` each time
- [ ] Widget `getSnapshot()` returns reasonable placeholder data for the widget gallery preview
- [ ] `placeholder()` returns static mock data for the widget gallery
- [ ] Build succeeds

### US-017: Supabase client for widget extension

**Description:** As a developer, I need a lightweight Supabase client in the widget extension so the Quick-Add widget can write items directly to the database.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `WidgetSupabaseClient` that initializes a Supabase client using credentials from `Secrets.plist` (shared with widget extension target) and auth session from `SharedDefaults`
- [ ] `WidgetSupabaseClient` provides `addItem(name:listId:)` function that inserts a new item row into the `items` table
- [ ] Auth session is read from the App Group shared container (written by main app's `SupabaseManager`)
- [ ] If auth session is expired or missing, the `AppIntent` fails gracefully with a message like "Please open Gather Lists to sign in"
- [ ] `Secrets.plist` is added to the widget extension target's build phase (Copy Bundle Resources)
- [ ] Build succeeds

### US-018: Widget bundle registration

**Description:** As a developer, I need all widgets registered in a single `WidgetBundle` so iOS discovers them all.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `GatherListsWidgetBundle` conforming to `WidgetBundle`
- [ ] Register all widgets: `ListQuickViewWidget`, `DueItemsWidget`, `QuickAddWidget`, `ItemCountLockScreenWidget`, `NextDueLockScreenWidget`
- [ ] Each widget has a distinct `kind` string identifier
- [ ] Each widget has a user-facing display name and description for the widget gallery
- [ ] Widget gallery preview shows meaningful snapshot data
- [ ] All widgets appear in the widget picker when adding widgets on the home screen
- [ ] Build succeeds (both main app and widget extension)

## Functional Requirements

- FR-1: The main app and widget extension share data via an App Group container (`group.com.gatherlists`)
- FR-2: Auth session is synced from the main app to the shared container on login, refresh, and sign-out
- FR-3: List and item data is written to the shared container whenever the main app's data changes
- FR-4: The List Quick-View widget shows unchecked items from a user-selected list in small, medium, and large sizes
- FR-5: The Due Items widget shows upcoming and overdue items across all lists or a specific list in small, medium, and large sizes
- FR-6: The Quick-Add widget provides an interactive text field to add items without opening the app (iOS 17+, AppIntent-based)
- FR-7: Lock screen widgets show item count (circular + rectangular) and next due item (rectangular)
- FR-8: All home screen widgets support tapping to deep-link into the app via `gatherlists://list/{listId}`
- FR-9: Quick-Add stays in-widget and does not open the app
- FR-10: Widget configuration intents let users pick which list to display
- FR-11: Due Items widgets support "All Lists" or single-list configuration
- FR-12: Widgets refresh on a 15-minute timeline and immediately when the main app triggers `WidgetCenter.shared.reloadAllTimelines()`
- FR-13: Overdue items display due dates in red/orange in all widget types that show due dates
- FR-14: All widgets show placeholder content while loading and meaningful snapshots in the widget gallery

## Non-Goals

- No Android widgets (iOS only)
- No web dashboard widgets
- No widget for recipes or collections
- No real-time push-based widget updates (WidgetKit uses timeline-based refresh)
- No checking off items from widgets (only Quick-Add supports writes)
- No store/category display in widgets (keep items compact)
- No widget-to-widget communication
- No Siri Shortcuts integration (separate future feature)
- No StandBy mode optimization beyond standard WidgetKit behavior
- No watchOS complications

## Design Considerations

- **Widget visual style:** Follow Apple's Human Interface Guidelines for widgets. Clean backgrounds, SF Symbols where appropriate, system font sizes. Use the list's color as a subtle accent (header tint or small color dot)
- **Dark mode:** All widgets must render correctly in both light and dark mode. Use SwiftUI's adaptive colors (`Color.primary`, `Color.secondary`, `.widgetBackground`)
- **List Quick-View layout:** Small = emoji + name + count. Medium = header + item list. Large = header + longer item list. Keep item rows single-line with truncation
- **Due Items layout:** Small = count badge. Medium = item list with dates. Large = sectioned list (Overdue / Today / This Week). Use the recurring icon (↻) inline with date for recurring items
- **Quick-Add layout:** Small = emoji + name + "+" button. Medium = recent items + text field. Large = more items + text field. The text field should feel native and minimal
- **Lock screen widgets:** Use `AccessoryWidgetBackground()` and keep content minimal. Circular = emoji + number. Rectangular = emoji + name + count or next due item + date
- **Empty states:** "No items" for empty lists, "All clear" for no due items, "Open app to get started" when no data available
- **Placeholder/skeleton:** Use redacted placeholders (SwiftUI `.redacted(reason: .placeholder)`) for loading states

## Technical Considerations

- **WidgetKit framework:** Widgets are SwiftUI-only views rendered by the system on a timeline. No imperative UIKit, no background networking during render — all data must be pre-fetched and stored in the shared container
- **App Groups:** The main app and widget extension share data via `UserDefaults(suiteName: "group.com.gatherlists")` and/or files in the App Group shared container directory (`FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.gatherlists")`)
- **Shared data flow:** Main app → writes to `SharedDataStore` (App Group) → Widget timeline provider reads from `SharedDataStore`. The widget never makes network requests for reading — it reads cached data only
- **Quick-Add networking:** The Quick-Add widget is the exception — its `AppIntent` must make a Supabase insert call. This uses `WidgetSupabaseClient` which reads the auth session from the shared container and Supabase credentials from `Secrets.plist`
- **AppIntent (iOS 17+):** Interactive widgets require `AppIntentConfiguration` and `AppIntent` conformance. The minimum deployment target must be iOS 17 for the Quick-Add widget. The List Quick-View and Due Items widgets can support iOS 16+ if desired (using `IntentConfiguration` fallback), but recommend iOS 17+ for all to keep the codebase simpler
- **Model sharing:** `GatherList.swift` and `Item.swift` need to be compiled into both the main app and widget extension targets. The simplest approach is adding the files to both targets in Xcode. A shared framework is cleaner but adds build complexity — use the simpler approach unless the team prefers frameworks
- **OfflineCache vs SharedDataStore:** The existing `OfflineCache` actor writes to `.cachesDirectory`, which is NOT accessible from the widget extension. `SharedDataStore` is a new parallel store that writes to the App Group container. The main app should update both stores when data changes
- **Timeline refresh budget:** iOS limits widget refreshes. The 15-minute `after` policy is a request, not a guarantee. `WidgetCenter.shared.reloadAllTimelines()` from the foreground app is more reliable. Do not call it excessively — batch data updates and reload once
- **Deep-link URL scheme:** Register `gatherlists` as a URL scheme in `Info.plist`. The existing `onOpenURL` handler in `GatherListsApp.swift` needs to parse `gatherlists://list/{listId}` and navigate accordingly. The app already handles deep links for auth — extend the same handler
- **Widget extension bundle ID:** `com.gatherlists.widgets` (child of the main app's `com.gatherlists`)
- **Secrets.plist access:** Add `Secrets.plist` to the widget extension's "Copy Bundle Resources" build phase so `WidgetSupabaseClient` can read Supabase URL and anon key

## Success Metrics

- Users can add a widget to their home screen and see list data within 5 seconds of configuration
- Quick-Add widget successfully creates items without opening the app
- Widget data is no more than 15 minutes stale during normal use
- Widget data refreshes immediately after using the main app
- All widget types render correctly in light and dark mode, and in all supported sizes
- Lock screen widgets display correctly on the lock screen and in StandBy mode

## Open Questions

- Should the minimum deployment target be iOS 17 for all widgets (simplifies codebase by using AppIntent everywhere) or iOS 16 for read-only widgets? (Recommend iOS 17 for all — the Quick-Add widget requires it anyway, and iOS 17 adoption is very high in 2026)
- Should widget data include images/thumbnails for items, or keep it text-only for performance? (Recommend text-only for v1 — images increase widget memory usage and timeline size)
- How should the widget handle the case where the user is signed out? (Recommend showing a "Sign in to Gather Lists" message with a tap-to-open-app action)

## Credential & Service Access Plan

No new external credentials required for this PRD. The widget extension reuses the existing Supabase URL and anon key from `Secrets.plist`, and the user's auth session from the App Group shared container. No server-side changes or new API keys are needed.

## Definition of Done

Implementation is complete when:

- App Groups entitlement is configured on both the main app and widget extension targets
- Main app syncs auth session and list/item data to the App Group shared container
- Widget extension target builds and runs alongside the main app
- List Quick-View widget displays unchecked items in small, medium, and large sizes with list selection
- Due Items widget displays upcoming/overdue items in small, medium, and large sizes with all-lists or single-list configuration
- Quick-Add interactive widget creates items via Supabase without opening the app in small, medium, and large sizes
- Lock Screen item count widget works in circular and rectangular accessory families
- Lock Screen next-due widget works in rectangular accessory family
- All widgets support configuration via AppIntent list picker
- Deep-link URL scheme navigates to the correct list when tapping widgets
- Widget timelines refresh every 15 minutes and on-demand when the main app's data changes
- All widgets render correctly in light and dark mode
- All widgets show meaningful placeholder and snapshot content in the widget gallery
- Both the main app and widget extension build successfully
