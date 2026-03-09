# Supabase Apple Sign-In: Native iOS requires bundle ID as additional client ID

## Problem

After migrating domains, Apple Sign-In worked in the browser (Safari) but failed on the native iOS app (TestFlight). The native Apple Sign-In sheet appeared, Face ID succeeded, but the Supabase token exchange (`signInWithIdToken`) silently failed.

## Cause

The browser and native iOS use different Apple Sign-In flows:

- **Browser:** `signInWithOAuth` → redirect flow → uses the **Services ID** (e.g., `com.shoppinglistai.*`)
- **Native iOS:** `SignInWithApple.authorize()` → `signInWithIdToken` → the token audience is the **bundle ID** (e.g., `com.gatherlists`)

Supabase validates the token audience against its configured client IDs. If only the Services ID is configured, native tokens with the bundle ID audience are rejected.

## Fix

In **Supabase Dashboard → Authentication → Providers → Apple**, add the bundle ID (`com.gatherlists`) as an additional authorized client ID alongside the Services ID.

Both IDs must be present:
- Services ID (`com.shoppinglistai.*`) — for web OAuth flow
- Bundle ID (`com.gatherlists`) — for native iOS `signInWithIdToken` flow
