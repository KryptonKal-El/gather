# Supabase Edge Functions must be manually redeployed

## Problem

After updating CORS origins in edge function source files, the changes don't take effect until the functions are redeployed to Supabase. Git commits and `cap sync` do NOT deploy edge functions.

## Symptom

Browser shows: "Origin https://example.com is not allowed by Access-Control-Allow-Origin" even though the source code clearly includes the origin.

## Fix

After any edge function code change, run:

```bash
npx supabase functions deploy search-products
npx supabase functions deploy search-images
```

Or deploy all at once:

```bash
npx supabase functions deploy
```

## When to remember this

Any time edge function code is changed — CORS, logic, environment variables — it needs a manual deploy. This is separate from the Vercel frontend deploy (which is automatic via git push) and the Capacitor native build.
