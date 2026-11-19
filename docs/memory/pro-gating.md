# Gather Lists Pro gating

## The switch
Limits apply to an account when `pro_enforced_for(user)` is true: either
`app_settings.pro_enforcement` is `true` (global, the launch switch) or the user
id is in the `pro_enforcement_testers` JSON array. Both start off/empty.

```sql
-- launch
UPDATE app_settings SET value = 'true' WHERE key = 'pro_enforcement';
-- try it on one account
UPDATE app_settings SET value = '["<user uuid>"]' WHERE key = 'pro_enforcement_testers';
```

`app_settings` has no client policies (it holds user ids). Clients call
`pro_enforced()`; edge functions call `pro_enforced_for` with the service role.
The e2e test account is a tester, so it always sees the locked experience.

## Rules
- Free monthly caps live in `supabase/functions/_shared/entitlement.ts`
  (`FREE_MONTHLY_LIMITS`): 25 paid image lookups (SerpAPI + Spoonacular only;
  Walmart and Open Food Facts are never limited), 5 recipe URL imports. Online
  recipe search is Pro only. Counts come from successful rows in
  `api_usage_events` for the calendar month (UTC), so a failed call never costs
  the user anything, and a call that isn't logged can't be capped.
- A refusal is HTTP 402 with `{ error: 'limit_reached' | 'pro_required' |
  'sign_in_required', limit, used, resetsAt }`. `search-products` instead lists
  skipped paid sources in `limited` when free sources were also requested,
  because old app builds ask for every source in one request.
- The access check fails open: if it errors, the request is allowed.
- Meal plans follow the plan OWNER: `can_write_meal_plan` requires the owner to
  be Pro when limits apply to the owner, for every writer. Reads are never
  blocked. Every meal plan write policy goes through that function, so new
  meal plan tables must use it too. Clients ask `meal_plan_has_pro(plan)`.

## Clients
- iOS: `ProSubscriptionManager.isEnforced` / `hasProAccess`; `ProUpgradePrompt`
  is the shared inline notice and owns its paywall sheet.
- Web has no gating UI and no way to subscribe yet (Stripe not built). The
  server still enforces, so a capped or locked web user currently just sees a
  failed action.
- Cook mode and recipe tagging are marked Pro in the plan but are not locked.
