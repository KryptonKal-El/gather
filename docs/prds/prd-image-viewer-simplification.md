# PRD: Image Viewer Simplification

## Introduction

Currently, tapping/clicking an item's image thumbnail opens the same combined modal/sheet on both platforms — showing the current image preview, a remove button, **and** the full search/upload UI with tabs. Worse, an API search fires automatically every time the modal opens (even when the user just wants to look at or remove their existing image). This wastes API calls and clutters the experience.

This PRD simplifies the flow into two distinct paths:

- **Has image:** Open a view-only modal/sheet showing a large image preview and a "Remove image" button. No search tabs, no upload, no auto-search.
- **No image:** Open the existing search/upload picker (with auto-search on open, as today).
- **After removing:** The modal/sheet transitions in-place to the search/upload view so the user can immediately pick a new image.

## Goals

- Eliminate unnecessary API calls when users just want to view or remove their existing image
- Simplify the UI for the most common interaction (viewing an item's image)
- Maintain the full search/upload flow for items without images and after removal
- Apply consistently to both React web and Swift iOS platforms

## User Stories

### US-001: React Web — View-Only Modal When Image Exists

**Description:** As a web user, I want clicking an item's image thumbnail to show only a large preview and remove button, so I can view or remove my image without triggering a search.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] When `currentImageUrl` is non-null, the ImagePicker modal renders the header ("Item Image" + close button), a large image preview, and a "Remove image" button — nothing else
- [ ] The search/upload tabs, search input, search results grid, and upload pane are all hidden
- [ ] No API search is fired on open (the `useEffect` auto-search does not execute)
- [ ] The existing header style (title + close button + bottom border) is preserved
- [ ] The image preview fills the available width (existing `.preview` style: `max-width: 400px`, square aspect ratio, `object-fit: contain`)
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-002: React Web — Transition to Search/Upload After Remove

**Description:** As a web user, after removing an image I want the modal to switch to the search/upload view so I can immediately pick a new image without re-opening the picker.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] After clicking "Remove image" and the removal succeeds, the modal stays open
- [ ] The view-only section (large preview + remove button) is replaced by the search/upload tabs UI
- [ ] An auto-search fires using the item name as the query (same behavior as today's initial open for items without images)
- [ ] The search tab is active by default after transition
- [ ] If the user selects a new image or closes the modal, it behaves the same as today
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-003: React Web — No-Image Path Unchanged

**Description:** As a web user, I want the existing search/upload picker to open as-is when an item has no image, so nothing breaks for the common add-image flow.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] When `currentImageUrl` is null, the full picker opens with header, search/upload tabs, and auto-search on mount — identical to current behavior
- [ ] No regressions in search, upload, or image selection flows
- [ ] Lint passes

### US-004: iOS — View-Only Sheet When Image Exists

**Description:** As an iOS user, I want tapping an item's image to show a large image preview filling most of the sheet, with only a remove button, so I can view my image clearly without a search firing.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] When `item.imageUrl` is non-nil and non-empty, the sheet renders the navigation bar ("Item Image" + Close), a large `AsyncImage` filling most of the sheet height, and a "Remove image" button
- [ ] The image uses `scaledToFit` to fill available width while maintaining aspect ratio, significantly larger than the current 120×120 preview
- [ ] The segmented tab picker, search field, search results grid, and upload buttons are all hidden
- [ ] The `.task { performSearch() }` auto-search does not execute
- [ ] The sheet remains scrollable if the image is taller than the visible area
- [ ] Works in both light and dark mode (if applicable to the sheet)

### US-005: iOS — Transition to Search/Upload After Remove

**Description:** As an iOS user, after removing an image I want the sheet to switch to the full search/upload view so I can immediately pick a new image.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] After tapping "Remove image" and the removal succeeds, the sheet stays open
- [ ] The view-only section (large image + remove button) is replaced by the segmented tabs, search field, search results grid, and upload options
- [ ] An auto-search fires using the item name as the query (same as today's `.task` behavior)
- [ ] The "Search online" tab is selected by default after transition
- [ ] If the user selects a new image or taps Close, it behaves the same as today

### US-006: iOS — No-Image Path Unchanged

**Description:** As an iOS user, I want the existing search/upload sheet to open as-is when an item has no image, so nothing breaks for the add-image flow.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] When `item.imageUrl` is nil or empty, the full picker sheet opens with segmented tabs, search field, auto-search on appear, and upload options — identical to current behavior
- [ ] No regressions in search, upload, camera, or photo library flows

## Functional Requirements

- FR-1: The image picker/sheet must branch on whether the item currently has an image URL
- FR-2: When an image exists, render only the image preview and a remove button (plus header/nav bar and close)
- FR-3: When no image exists, render the full search/upload UI with auto-search on open (current behavior)
- FR-4: After a successful image removal, transition the modal/sheet in-place from view-only to search/upload mode
- FR-5: The auto-search after removal must use the item name as the query, matching current initial-open behavior
- FR-6: Both platforms must implement the same branching logic and transition behavior

## Non-Goals

- No changes to the image search backend or API
- No changes to the image upload flow
- No changes to the search results grid layout or styling
- No new animations or transitions beyond the in-place view swap
- No changes to how the thumbnail in the item row looks or behaves (the click/tap trigger stays the same)

## Design Considerations

### React Web (US-001, US-002, US-003)

- The existing `ImagePicker` component already conditionally renders `currentImage` when a URL exists. The change is to make this section **exclusive** — when it renders, the tabs and search/upload panes do not.
- After removal, the component needs local state to track that the image was removed during this session (since `currentImageUrl` from props won't update until the parent re-renders via `onRemove`). A simple `wasRemoved` state flag can gate this.
- The auto-search `useEffect` should only fire when the picker is in search/upload mode (either no image on open, or after removal).

### iOS (US-004, US-005, US-006)

- The existing `ItemImagePickerSheet` already has an `existingImageSection` helper. The change is to make the image section **fill most of the sheet** and hide everything else when an image exists.
- Replace the current 120×120 frame with a much larger image — consider using `GeometryReader` or just removing the fixed frame to let the image fill available width with `scaledToFit`.
- After removal, use a local `@State private var imageRemoved = false` flag to swap from the view-only layout to the full picker layout.
- The `.task` modifier should be conditioned on being in search/upload mode.

## Technical Considerations

- **React web:** The `ImagePicker` component (`src/components/ImagePicker.jsx`) is a portal-based modal. The branching logic is purely presentational — no new API calls, services, or state management patterns needed.
- **iOS:** The `ItemImagePickerSheet` (`ios-native/.../Views/Components/ItemImagePickerSheet.swift`) uses `NavigationStack` + `ScrollView`. The layout change is within the existing `body` computed property.
- **No backend changes** are required. The `onRemove` callback already handles the Supabase storage deletion and item update. The only change is that the modal/sheet stays open after removal instead of closing.
- **API call savings:** Every open of the picker for an item with an existing image currently costs one search-products API call. This change eliminates those calls entirely.

## Success Metrics

- Zero API calls when users open the picker to view or remove an existing image
- The view/remove flow requires no more than 2 taps/clicks (open → remove)
- After removal, the search/upload view loads with results in the same time as a fresh open

## Definition of Done

- [ ] React web: opening the image picker for an item WITH an image shows only the preview + remove — no tabs, no search, no auto-search API call
- [ ] React web: opening the image picker for an item WITHOUT an image shows the full picker (unchanged behavior)
- [ ] React web: after removing an image, the modal transitions to the search/upload view with auto-search
- [ ] iOS: opening the image picker sheet for an item WITH an image shows a large preview + remove — no tabs, no search, no auto-search API call
- [ ] iOS: opening the image picker sheet for an item WITHOUT an image shows the full picker (unchanged behavior)
- [ ] iOS: after removing an image, the sheet transitions to the search/upload view with auto-search
- [ ] Both platforms work in light and dark mode
- [ ] Lint passes on all modified files
- [ ] No regressions in search, upload, or image selection flows on either platform

## Open Questions

None — all clarifying questions resolved.

## Credential & Service Access Plan

No external credentials required for this PRD.
