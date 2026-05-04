# Issues: Fix shared collaborator avatars across web and iOS (TSK-004)

## Issue 1: Initial avatar_url migration did not resolve the symptom
- **Problem:** After applying the first migration, users still only saw their own avatar in shared lists.
- **Root cause:** The collaborator RPC still returned an asymmetric set: owner-view omitted the owner row entirely.
- **Fix:** Added a follow-up migration to make the collaborator RPC return owner + recipients for all authorized viewers.
- **Time spent:** ~20 min
