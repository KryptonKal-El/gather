# Plan: Use highest-resolution grocery item images after selection (TSK-006)

## Acceptance Criteria
- After selecting a grocery item image, the saved item thumbnail uses the highest-resolution available image.
- The expanded image view also uses the highest-resolution available image.
- Search-result browsing can continue to use lightweight thumbnails if desired.
- Web and iOS both benefit from improved full-image selection quality.

## Approach
- Update the shared product search edge function so `url` is the highest-resolution source available from each provider.
- Update iOS item image selection to save the full `url` instead of the low-res `thumbnail`.
- Preserve `thumbnail` only for search-result browsing grids.
