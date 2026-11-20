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

Not done: revoking Sign in with Apple tokens (Apple asks for this when deleting
an account created with Sign in with Apple). It needs a Sign in with Apple key
on the server and a fresh authorization code from the client.

Test with a throwaway account only (see `rls-testing-via-db-query.md` for the
rolled-back pattern). Never run it against a real account.
