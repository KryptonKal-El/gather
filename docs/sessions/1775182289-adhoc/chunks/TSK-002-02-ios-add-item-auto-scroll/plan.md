# Plan: Auto-scroll newly added iOS list items into view (TSK-002)

## Acceptance Criteria
- Adding an item to an iOS list scrolls the newly added item into view.
- The scroll targets the actual new item rather than a generic bottom anchor.
- The behavior works for both normal add and suggestion-based add flows.
- Existing list rendering and add behavior remain intact.

## Approach
- Expose the inserted item identifier from the add-item flow in the list detail view model.
- Update the list detail view's scroll trigger to target the newly inserted item.
- Ensure rendered rows have stable scroll targets for reliable scrolling.
