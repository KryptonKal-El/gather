# Testing RLS against the live DB without passwords or Docker

There's no local Supabase (Docker isn't running) and only one e2e password, but
RLS can still be tested for real as any user:

1. Write the checks in one SQL file wrapped in `begin; ... rollback;`.
2. Inside a `DO` block, impersonate a user with
   `set_config('request.jwt.claims', json_build_object('sub', <uuid>, 'email', <email>, 'role','authenticated')::text, true)`
   and `set_config('role', 'authenticated', true)`. `auth.uid()` / `auth.jwt()` read these.
3. Wrap each attempted write in `begin ... exception when others then ... end;` and
   record PASS/FAIL into a temp table (grant it to `authenticated`), then
   `select` the table before `rollback`.
4. Run: `npx -y supabase@2 db query --linked -f <file> -o json`.

Example: `supabase/tests/wish_list_claims_rls.sql`. Look up test user ids with
`select id, email from auth.users where email in (...)` via the same command.
Notification triggers fire inside the transaction but their queued pg_net
requests roll back with it.
