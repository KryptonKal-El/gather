# Plan: Fix shared collaborator avatars across web and iOS (TSK-004)

## Acceptance Criteria
- Shared collaborator avatars appear correctly in both React/web and native iOS when the collaborator has an avatar set.
- The avatar source is resolved consistently across collaborator views and self-avatar views.
- Existing initials fallback remains correct when no avatar exists.
- The fix does not regress collaborator loading on either platform.

## Approach
- Fix the shared collaborator data source path so avatar URLs are returned consistently for both platforms.
- Update any platform-specific mapping only if required by the backend/data fix.
- Verify web and iOS collaborator views render the avatar from the shared data path.
