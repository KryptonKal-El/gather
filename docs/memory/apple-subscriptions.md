# Gather Pro subscriptions (Apple side)

## Non-obvious bits

- **Entitlement lives in `subscriptions`, not on `profiles`.** `profiles_update_own`
  lets a user update their whole profile row, so a `pro_until` column there would
  be self-grantable. `subscriptions` is select-own only; edge functions write it
  with the service role. "Is Pro" is defined once, in SQL `is_pro(uuid)`
  (service role only for now).
- **Apple's notification signature is deliberately not verified.**
  `apple-notifications` only reads which transaction changed, then fetches the
  real state from the App Store Server API with our own key
  (`_shared/appStore.ts`). A forged notification can only trigger a re-sync. Do
  not start trusting fields from the notification body without adding x5c chain
  verification.
- **Ownership:** `appAccountToken` (set by the app to the Supabase user id at
  purchase) wins. Purchases with no token (bought from the App Store page via
  Streamlined Purchasing, or Family Sharing members) are claimed by the first
  signed-in device that calls `sync-apple-subscription`; later claims by other
  accounts are ignored.
- **Sandbox counts as Pro.** TestFlight purchases are Sandbox and are stored like
  any other (see `environment`), so testers get Pro for free. Filter on
  `environment` if that ever matters.
- Secrets needed: `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_PRIVATE_KEY`
  (the In-App Purchase .p8, base64-encoded like `APNS_PRIVATE_KEY`).
- Type-check and test without installing Deno:
  `cd supabase/functions && npx -y deno check <files>` /
  `npx -y deno test _shared/appStore.test.ts` (delete the `deno.lock` it leaves
  at the repo root).

## Production answers 401 before the app is live

With a key that Sandbox accepts, `api.storekit.itunes.apple.com` returned 401
(empty body) while the app was TestFlight-only (seen 2026-11-18). `fetchLastTransactions`
therefore skips a 401 from one environment and only fails when no environment
accepts the key. Re-check Production once the app is released.

## Products (App Store Connect)

Subscription group "Gather Lists Pro" (the product's name since 2026-11-18;
older notes say "Gather Pro"). Product IDs are permanent:
`com.gatherlists.pro.monthly` and `com.gatherlists.pro.annual`, same level,
Family Sharing on, 1-week free trial.

There is no "test notification" button in App Store Connect; a test can only be
requested through `POST /inApps/v1/notifications/test` with the IAP key.
