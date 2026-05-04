# Plan: Fix collaborator avatar regression and missing shared collaborator lookup (TSK-005)

## Acceptance Criteria
- Private/non-shared owned lists do not show the owner's avatar in collaborator rows.
- Shared lists show the other collaborator's avatar correctly on both web and iOS.
- Existing initials fallback still works when no avatar truly exists.
- The fix does not break collaborator authorization or list-row rendering.

## Approach
- Filter owner-only collaborator rows out of list-row avatar rendering where appropriate.
- Refine collaborator lookup so shared recipients resolve reliably.
- Verify both web and iOS shared list rows after the backend/data fix.
