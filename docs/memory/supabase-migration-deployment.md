# Supabase migrations must be deployed separately from code commits

## Problem

Adding a migration file to `supabase/migrations/` does NOT deploy it to the remote database.
Code that depends on a new RPC, table, or policy will fail in production with cryptic errors
like `PGRST202` ("Could not find the function in the schema cache") even though local code,
tests, and types all look correct.

This bit us hard on PRD `prd-reset-list-items`:
- Commit `49ee9b6` added `20260421120000_reset_guest_list_rsvp_rpc.sql` and the JS caller
- Commit message noted "migration must be deployed via `supabase db push` separately"
- Deployment never happened
- US-003, US-005, US-006, US-007 all shipped as functional no-ops — every "Reset items"
  attempt threw an error and showed the red "Couldn't reset — try again" toast
- Bug surfaced 4 stories later during US-007 Playwright verification

## Cause

`supabase/migrations/*.sql` files are version-controlled but the actual `db push` is a
separate manual step against the remote project. CI does not run migrations automatically.

## Fix

After adding any migration:

```
npx supabase db push --linked
```

Then verify:

```
supabase migration list --linked | tail -5
```

The new timestamp must appear in BOTH the Local and Remote columns. If the Remote
column is empty, the migration has not been applied.

## Rule for AI agents

When ANY commit adds or modifies a file under `supabase/migrations/`:
1. Run `npx supabase db push --linked` BEFORE marking the story complete
2. Verify with `supabase migration list --linked`
3. Re-run the manual repro path against the live app to confirm the new
   function/table/policy actually works against the deployed schema
4. If the migration cannot be deployed in this session (e.g., requires
   credentials the agent lacks), STOP and surface this to the user as a
   blocking deployment step — do NOT mark the story complete with a
   deferred-deployment note. That deferral will be forgotten.

## Related

- The failing story chain (`prd-reset-list-items` US-003 → US-007) showed how a
  missing deployment can cascade through many "completed" stories before being
  noticed. Each subsequent story built on top of a broken foundation, marking
  itself complete based on local builds and unit tests that didn't exercise the RPC.
- Playwright verification caught it. Manual user verification confirmed it. Neither
  unit tests nor build steps would have surfaced this.
