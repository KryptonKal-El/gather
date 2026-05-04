# Changes: Fix collaborator avatar regression and missing shared collaborator lookup (TSK-005)

## Files Modified
- `supabase/migrations/20260406140000_fix_collaborator_email_matching.sql` — fixed collaborator lookup case-insensitively and prevented owner-only rows for private lists.

## Verification
- `npm run build` passed.
- iOS simulator build passed.
- `supabase db push` succeeded.
- Security review found only a non-blocking privacy consideration about OAuth avatar metadata exposure.
- Manual follow-up still required on web and iOS shared/private list rows.
