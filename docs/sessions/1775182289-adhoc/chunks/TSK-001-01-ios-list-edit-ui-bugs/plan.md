# Plan: Fix iOS list edit toolbar, category text, and add-category title bugs (TSK-001)

## Acceptance Criteria
- Edit List toolbar `Cancel` and `Save` controls use readable branded styling.
- Category section labels in the list edit flow are readable and no longer washed out.
- Tapping `Add Category` opens the category screen with an add/new title, not `Edit Category`.
- The add-category screen back/cancel control uses readable branded styling.
- Existing category edit flow still shows the edit title.

## Approach
- Update the list edit sheet toolbar styling.
- Update the shared category editor to distinguish add vs edit mode.
- Replace low-contrast label styling in the category editor path.
