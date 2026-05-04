# Changes: Fix shared collaborator avatars across web and iOS (TSK-004)

## Files Modified
- `supabase/migrations/20260406120000_sync_avatar_url_from_oauth.sql` — synced OAuth avatar URLs into profiles, backfilled existing rows, and updated collaborator RPC avatar fallback.
- `supabase/migrations/20260406130000_fix_collaborators_include_owner.sql` — made collaborator RPC return owner + recipients symmetrically for all authorized viewers.

## Verification
- `npm run build` passed.
- `security-critic` found no meaningful issues.
- `supabase db push` succeeded for both avatar migrations.
- Manual follow-up required: verify collaborator avatars in both web and iOS shared list views.
