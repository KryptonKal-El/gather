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
Family Sharing on, 1-week free trial. Subscription group ID 22593138. The first
subscription group must be submitted for review together with a new app version.

There is no "test notification" button in App Store Connect; a test can only be
requested through `POST /inApps/v1/notifications/test` with the IAP key.

## iOS client

`ProSubscriptionManager` reports StoreKit transactions to `sync-apple-subscription`
and reads Pro status back from the `subscriptions` table; it never trusts the
local entitlement, so another Gather account on the same Apple ID stays free.
Status is cached per user in UserDefaults for offline launches.

A simulator launched with `simctl` (the simulator tool) cannot load the
products: `SubscriptionStoreView` shows "Subscription Unavailable". The paywall
only renders when run from Xcode with a StoreKit configuration file on the
scheme, or on a device with products that are Ready to Submit. Purchases made
against a local StoreKit file never reach Apple, so they do not flip `isPro`.

`SubscriptionStoreView` clips marketing content taller than the space left above
the plan picker (it does not scroll), so the paywall header is a title and four
lines only; the stacked logo did not fit. `GatherLists.storekit` is synced from
App Store Connect: re-sync it after changing products there.

## "Subscription Unavailable" on a TestFlight build

Build 137 showed this on a real device on 2026-11-18 because the Paid Apps
Agreement (App Store Connect → Business) was still "Processing". No product
loads in sandbox until it is "Active". Check that first before suspecting code.
