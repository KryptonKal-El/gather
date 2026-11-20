# Account deletion

Apple requires in-app account deletion (guideline 5.1.1(v)). It lives in
Settings on iOS and web and calls the `delete-account` edge function, which:

1. Removes the user's files from `recipe-images`, `item-images` and
   `profile-images` (paths start with the user id). If this fails nothing else
   is deleted, so the user can retry.
2. Deletes rows in other people's content that reference the user:
   `list_audit_events.actor_id` (NOT NULL, NO ACTION, so it blocks the delete),
   shares the user created, and shares addressed to the user's email.
3. Deletes the auth user. Everything the user owns goes by ON DELETE CASCADE,
   including content shared with others. `subscriptions.user_id` is SET NULL so
   App Store notifications still resolve.

When adding a table that references `auth.users` or `profiles`, give the foreign
key CASCADE or SET NULL, or add a cleanup step to the function. Otherwise
account deletion starts failing for anyone with a row in it.

Sign in with Apple: when the account has an `apple` identity, the iOS app shows
Apple's confirmation sheet to get a fresh authorization code and sends it as
`appleAuthorizationCode`. The function exchanges it and revokes the refresh
token (`_shared/appleSignIn.ts`). It is best effort: a failed revocation is
logged and returned as `appleRevoked: false`, and the account is still deleted.
Cancelling Apple's sheet cancels the deletion. The client secret is signed with
`APPLE_SIGNIN_KEY_ID` / `APPLE_SIGNIN_PRIVATE_KEY` (base64 of the .p8) when set,
otherwise the APNs key, which only works if Sign in with Apple is enabled on
that key in the developer portal. An `invalid_client` error in the function log
means the key is not enabled for Sign in with Apple. The web app cannot obtain
an authorization code (Supabase consumes it), so web deletions skip revocation.

Test with a throwaway account only (see `rls-testing-via-db-query.md` for the
rolled-back pattern). Never run it against a real account.
