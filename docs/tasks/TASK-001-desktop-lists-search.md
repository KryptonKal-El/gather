# TASK-001: Add Search Bar to Desktop Lists View

## Status: in_progress
## Priority: high
## Created: 2026-03-04

## Problem

The desktop `ListSelector` component is missing a search/filter bar that already exists in:
- Mobile `ListSelector` layout (lines 298-330)
- Desktop `RecipeSelector` layout (lines 436-468)
- Mobile `RecipeSelector` layout

Users on desktop cannot search or filter their lists, which is inconsistent with the mobile experience and the recipe selector behavior.

## Solution

Add the search bar JSX from `renderMobileLayout()` into `renderDesktopLayout()` in `ListSelector.jsx`. The search bar should be placed between the header div and the create form, matching the same position used by `RecipeSelector`'s desktop layout.

## Files to Modify

- `src/components/ListSelector.jsx` — Add search bar JSX to `renderDesktopLayout()` (insert between line 396 header close and line 398 create form)

## Files NOT to Modify

- `src/components/ListSelector.module.css` — All required styles (`.searchBar`, `.searchInput`, `.searchIcon`, `.clearBtn`) already exist

## Implementation Details

1. Copy the search bar JSX block from `renderMobileLayout()` (lines 298-330)
2. Insert it into `renderDesktopLayout()` after the `</div>` closing the header (line 396) and before the `{isCreating && (` block (line 398)
3. The existing `searchQuery` state (line 32) and filter logic (lines 89-96) already work for both layouts
4. The existing `filteredLists` → `ownedLists`/`sharedLists` split (lines 98-99) is already used in the desktop layout

## Acceptance Criteria

- Desktop layout shows a search bar between the header and the list content
- Typing in the search bar filters the displayed lists (both owned and shared)
- Clear button appears when text is entered and clears the search
- Search bar styling matches the mobile layout (uses existing CSS classes)
- No new CSS changes needed
- Empty state message updates appropriately when search filters all results

## Verification

- `npm run lint` — no new lint errors in `ListSelector.jsx`
