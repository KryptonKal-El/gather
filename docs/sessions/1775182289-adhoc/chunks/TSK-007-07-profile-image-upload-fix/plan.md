# Plan: Fix profile image upload refresh across web and iOS (TSK-007)

## Acceptance Criteria
- Uploading a new profile image from Settings updates immediately on web.
- Uploading a new profile image from Settings updates immediately on iOS.
- The latest profile image persists after reload/app restart.
- Existing avatar display paths continue to work without manual cache clearing.

## Approach
- Fix the shared avatar upload/display contract so uploaded profile images get a fresh URL after upload.
- Update web and iOS upload flows only as needed to consume the refreshed URL.
- Preserve existing image compression/upload behavior.
