# Verifying Authed App Flows in Browser Preview

## Problem
The web app at `/app` sits behind Supabase auth, so browser-based verification of in-app UI (category editor, store manager, etc.) gets stuck at the sign-in screen.

## Fix
Sign in with the dedicated e2e test account from `e2e/.env.test` (`E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`). It has seeded lists and works against the dev server on port 5173.

## Gotchas
- The account is littered with orphaned "E2E Test" / "Swipe Test" lists from old runs — scope selectors carefully.
- There are multiple "+ New" buttons on screen at once (new list vs. new store). Match by context, not text alone.
- The list options menu (⋮) is the entry point for "Edit Categories" and "Manage Stores".
