# Plan: Improve iOS Share Settings styling and email suggestions (TSK-003)

## Acceptance Criteria
- Share Settings `Done` button uses readable branded styling.
- Share Settings sheet uses a grayish grouped/sheet background rather than a flat white page.
- The `Add` button is clearly visible after entering an email, using stronger branded styling.
- Focusing the email field offers previously used share email suggestions from local device history.
- Selecting a suggestion fills the field and the share flow still works.

## Approach
- Update `ShareListSheet` toolbar, background, and add button styling.
- Store successful share email addresses locally on device.
- Surface filtered suggestion rows when the email field is focused or contains text.
