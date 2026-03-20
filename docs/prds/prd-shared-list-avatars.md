# PRD: Shared List Avatars

## Introduction

Replace the plain "Shared" text badge on list rows with avatar indicators showing the people each list is shared with. Each collaborator is represented by their profile image, or their first initial over a circle filled with the list's color when no image exists. Avatars stack/overlap when multiple collaborators exist, are vertically centered, and right-aligned within the list row. This applies to both the React web app and the native Swift iOS app.

## Goals

- Replace the generic "Shared" label with meaningful visual indicators of who a list is shared with
- Show profile images for collaborators who have one, and a colored initial fallback for those who don't
- Support multiple collaborators with a stacked/overlapping avatar layout and a "+N" overflow indicator
- Maintain visual consistency across React web and Swift iOS platforms
- Keep the design compact so it fits cleanly in existing list rows

## User Stories

### US-001: Supabase RPC to fetch collaborator profiles

**Description:** As a developer, I need a secure way to fetch display names and avatar URLs for people a list is shared with, so the UI can render their avatars.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create a Supabase RPC function (e.g. `get_list_collaborators`) that accepts a list ID and returns `{ user_id, display_name, avatar_url }` for each person the list is shared with
- [ ] For lists you own: returns all collaborators you've shared with
- [ ] For lists shared with you: returns the owner plus any other collaborators
- [ ] Joins `list_shares` to `profiles` via email to resolve profile data
- [ ] Respects RLS — only callable by users who own or are shared on the list
- [ ] Migration runs successfully
- [ ] Returns empty array for unshared lists

### US-002: React — Reusable Avatar component

**Description:** As a developer, I want a reusable Avatar component so it can be used on list rows and potentially elsewhere.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `Avatar` component accepts `imageUrl`, `displayName`, `color`, and `size` props
- [ ] Renders a circular profile image when `imageUrl` is provided
- [ ] Renders a circle filled with `color` containing the uppercase first initial of `displayName` when no image exists
- [ ] Initial text is white and centered within the circle
- [ ] Supports configurable size (default appropriate for list row usage, ~24px)
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-003: React — AvatarGroup component for stacked display

**Description:** As a developer, I want an AvatarGroup component that overlaps multiple avatars and shows a "+N" indicator when there are too many to display.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `AvatarGroup` component accepts an array of collaborator objects and a `maxDisplay` prop (default 3)
- [ ] Renders avatars overlapping left-to-right with a consistent negative margin
- [ ] When collaborators exceed `maxDisplay`, shows a "+N" circle at the end using the same size as avatars
- [ ] "+N" circle uses a neutral background (gray) with white text
- [ ] Group is right-aligned and vertically centered within its container
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-004: React — Fetch and display collaborator avatars on list rows

**Description:** As a user, I want to see the profile images (or initials) of people I share a list with, so I know at a glance who has access.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `ListSelector` calls the RPC function to fetch collaborator profiles for shared lists
- [ ] The "Shared" text badge is removed and replaced with the `AvatarGroup` component
- [ ] Avatar circle fallback color uses the list's color
- [ ] Avatars are vertically centered and right-aligned in the list row
- [ ] Non-shared lists show no avatar group (no visual change)
- [ ] Collaborator data is fetched efficiently (batch or alongside list fetch, not N+1)
- [ ] Verify in browser
- [ ] Works in both light and dark mode
- [ ] Lint passes

### US-005: Swift — Reusable AvatarView component

**Description:** As a developer, I want a reusable SwiftUI AvatarView so it can be used on list rows and potentially elsewhere in the iOS app.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `AvatarView` accepts `imageURL`, `displayName`, `color`, and `size` parameters
- [ ] Renders a circular `AsyncImage` when `imageURL` is provided
- [ ] Renders a circle filled with `color` containing the uppercase first initial of `displayName` when no image exists
- [ ] Initial text is white, bold, and centered
- [ ] Supports configurable size (default ~24pt for list row usage)
- [ ] Works in both light and dark mode
- [ ] Build succeeds

### US-006: Swift — AvatarGroupView for stacked display

**Description:** As a developer, I want a SwiftUI AvatarGroupView that overlaps multiple avatars with a "+N" overflow indicator.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `AvatarGroupView` accepts an array of collaborator objects and a `maxDisplay` parameter (default 3)
- [ ] Renders avatars overlapping using `ZStack` with increasing horizontal offset
- [ ] When collaborators exceed `maxDisplay`, shows a "+N" circle at the end
- [ ] "+N" circle uses a neutral gray background with white text
- [ ] Group is right-aligned and vertically centered
- [ ] Works in both light and dark mode
- [ ] Build succeeds

### US-007: Swift — Fetch and display collaborator avatars on list rows

**Description:** As a user on iOS, I want to see collaborator avatars on shared list rows instead of the plain "Shared" label.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `ListViewModel` (or `ListService`) calls the `get_list_collaborators` RPC to fetch collaborator profiles
- [ ] The `Text("Shared")` capsule in `ListRowView` is removed and replaced with `AvatarGroupView`
- [ ] Avatar circle fallback color uses the list's color
- [ ] Avatars are vertically centered and right-aligned in the list row
- [ ] Non-shared lists show no avatar group
- [ ] Collaborator data is fetched efficiently (batch call for all shared lists, not per-row)
- [ ] Works in both light and dark mode
- [ ] Build succeeds

## Functional Requirements

- FR-1: Create a Supabase RPC function that returns collaborator profile data (display_name, avatar_url) for a given list, joining `list_shares` to `profiles` via email
- FR-2: RPC must enforce that the caller owns or is shared on the list
- FR-3: Avatar displays a circular profile image when available, or a colored circle with the user's first initial when not
- FR-4: Initial fallback circle uses the list's assigned color as its background
- FR-5: Multiple collaborators display as overlapping circles, capped at 3 visible with a "+N" overflow indicator
- FR-6: Avatar group is right-aligned and vertically centered within the list row on both platforms
- FR-7: The existing "Shared" text badge is completely removed on both platforms
- FR-8: No avatars are shown on non-shared lists

## Non-Goals

- No click/tap interaction on the avatars (e.g., no tap-to-see-details)
- No real-time updates when a collaborator changes their profile image (refreshes on next list load)
- No avatar display on the list detail/items view — only on the list browser rows
- No changes to the share modal or sharing flow itself

## Design Considerations

- **Avatar size:** ~24px/24pt — large enough to see the image or initial, small enough to not crowd the row
- **Overlap:** Each subsequent avatar overlaps the previous by ~30-40% of its diameter
- **Border:** Each avatar circle should have a thin (1-2px) white/background-color border so overlapping circles are visually distinct
- **"+N" indicator:** Same size circle as avatars, neutral gray background, white text, slightly smaller font
- **Placement:** Far right of the list row, vertically centered, replacing the current "Shared" badge position
- **Reuse existing patterns:** The settings screens on both platforms already render profile images with initial fallbacks — extract and generalize that logic

## Technical Considerations

- **Database:** The `list_shares` table links by `shared_with_email`, not user ID. The RPC must join to `profiles` via email to get `display_name` and `avatar_url`
- **RLS:** Currently `profiles_select_own` blocks reading other users' profiles. The RPC function should use `SECURITY DEFINER` to bypass this safely, with its own authorization check
- **Performance:** Fetch collaborator data in a single batch call for all shared lists, not per-row. Consider adding collaborator data to the initial list fetch or fetching it in parallel
- **React:** The existing `sharedBadge` CSS class in `ListSelector.module.css` can be removed or repurposed
- **Swift:** The existing `Text("Shared")` capsule in `ListRowView.swift` is replaced entirely
- **Image loading:** Use standard `<img>` with object-fit on web, `AsyncImage` on Swift. Handle load failures gracefully (fall back to initial)

## Success Metrics

- Shared lists immediately communicate who they're shared with at a glance
- No additional taps or clicks needed to understand sharing status
- Avatar rendering does not noticeably slow list loading

## Open Questions

- None at this time — scope is well-defined.

## Credential & Service Access Plan

No external credentials required for this PRD.

## Definition of Done

Implementation is complete when:

- A Supabase RPC function exists and returns collaborator profiles securely
- Both React and Swift have reusable Avatar and AvatarGroup components
- The "Shared" text badge is fully removed from list rows on both platforms
- Collaborator avatars (image or colored initial) appear right-aligned and vertically centered on shared list rows
- Stacked avatars overlap correctly with a "+N" overflow for 4+ collaborators
- Fallback initial circles use the list's color
- No visual change on non-shared lists
- Both light and dark mode render correctly
- Collaborator data is fetched efficiently (no N+1 queries)
- Build succeeds on both platforms
