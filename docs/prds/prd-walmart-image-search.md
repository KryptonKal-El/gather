# PRD: Walmart Affiliate API Image Search

## Introduction

Replace the current SerpAPI-powered image search with the Walmart Affiliate API to return real product images instead of stock/editorial photos. SerpAPI's Google Images engine returns generic web images that don't represent actual purchasable products. The Walmart Affiliate API provides high-quality product photos from Walmart's catalog, which is a much better fit for a shopping list app.

The existing SerpAPI integration will be retained as a fallback when Walmart returns no results, and Open Food Facts will serve as a secondary fallback for grocery-specific items.

## Goals

- Replace SerpAPI as the primary image search provider with Walmart Affiliate API
- Return real product photos (with name, thumbnail, price) instead of stock images
- Add Open Food Facts as a secondary fallback for grocery items when Walmart returns no results
- Keep SerpAPI as a tertiary fallback so image search never returns empty if avoidable
- Maintain the same client-side API contract (`searchImages()` returns `Array<{ url, thumbnail, title }>`) so ImagePicker requires no changes
- No user-facing workflow changes — the ImagePicker modal works identically

## User Stories

### US-001: Walmart Affiliate API Edge Function

**Description:** As a developer, I need a Supabase Edge Function that proxies search requests to the Walmart Affiliate API so the client can fetch product images without exposing credentials.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** required (`Walmart Affiliate API`, `RSA private key + Consumer ID`, `timing: upfront`)

**Acceptance Criteria:**

- [ ] New Edge Function `search-products` created at `supabase/functions/search-products/index.ts`
- [ ] Accepts GET requests with query params: `q` (search term), `num` (max results, default 8)
- [ ] Authenticates to Walmart Affiliate API using RSA key-pair signature (WM_CONSUMER.ID, WM_SEC.KEY_VERSION, WM_CONSUMER.INTIMESTAMP headers)
- [ ] Calls the Walmart Affiliate Search API endpoint: `https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search?query={q}&numItems={num}`
- [ ] Parses response and maps each product to: `{ url: item.largeImage, thumbnail: item.thumbnailImage, title: item.name }`
- [ ] Returns JSON: `{ results: [...], source: "walmart" }`
- [ ] Handles errors gracefully — returns `{ results: [], source: "walmart", error: "..." }` on failure
- [ ] CORS headers match existing `search-images` function (allow production + localhost origins)
- [ ] Supabase secrets configured: `WALMART_CONSUMER_ID`, `WALMART_PRIVATE_KEY` (PEM content), `WALMART_KEY_VERSION`
- [ ] Lint passes

### US-002: Open Food Facts Fallback in Edge Function

**Description:** As a developer, I need the search Edge Function to fall back to Open Food Facts when Walmart returns no results, so grocery items still get product images.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none (Open Food Facts is free, no API key required)

**Acceptance Criteria:**

- [ ] When Walmart returns zero results, the Edge Function calls Open Food Facts search: `https://world.openfoodfacts.org/cgi/search.pl?search_terms={q}&search_simple=1&action=process&json=1&page_size={num}`
- [ ] Maps OFF response to same shape: `{ url: product.image_url, thumbnail: product.image_small_url || product.image_url, title: product.product_name }`
- [ ] Filters out products that have no `image_url`
- [ ] Returns `{ results: [...], source: "openfoodfacts" }` when OFF results are used
- [ ] If both Walmart and OFF return no results, falls through to SerpAPI (US-003)
- [ ] Lint passes

### US-003: SerpAPI Tertiary Fallback

**Description:** As a developer, I need SerpAPI retained as a last-resort fallback so that image search still works for non-grocery, non-Walmart items.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none (existing `SERPAPI_KEY` secret already configured)

**Acceptance Criteria:**

- [ ] When both Walmart and Open Food Facts return zero results, the Edge Function calls SerpAPI Google Images (same logic as current `search-images/index.ts`)
- [ ] Returns `{ results: [...], source: "serpapi" }` when SerpAPI results are used
- [ ] If all three sources return nothing, returns `{ results: [], source: "none" }`
- [ ] The existing `SERPAPI_KEY` Supabase secret is reused — no new secrets needed
- [ ] Lint passes

### US-004: Update Client-Side Service to Call New Edge Function

**Description:** As a developer, I need `imageSearch.js` to call the new `search-products` endpoint instead of `search-images`, maintaining the same return type so ImagePicker works without changes.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `src/services/imageSearch.js` updated: endpoint changes from `/search-images` to `/search-products`
- [ ] Return type unchanged: `Array<{ url: string, thumbnail: string, title: string }>`
- [ ] `searchImages()` function signature and behavior unchanged — callers (ImagePicker) require no modification
- [ ] Error handling unchanged — returns `[]` on failure
- [ ] Old `search-images` Edge Function is NOT deleted yet (kept for rollback safety)
- [ ] Lint passes

### US-005: Update CORS and Environment Configuration

**Description:** As a developer, I need the new Edge Function deployed and CORS configured so it works in both local dev and production.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `ALLOWED_ORIGINS` in new Edge Function includes `https://shoppinglistai.vercel.app` and `http://localhost:4000`
- [ ] Also include `http://localhost:5173` for backward compatibility (Vite default port)
- [ ] Edge Function deployed to Supabase
- [ ] Supabase secrets set: `WALMART_CONSUMER_ID`, `WALMART_PRIVATE_KEY`, `WALMART_KEY_VERSION`
- [ ] Verify search works in production (shoppinglistai.vercel.app)
- [ ] Verify search works in local dev (localhost:4000)
- [ ] Lint passes

### US-006: Update project.json Integration Entry

**Description:** As a developer, I need `docs/project.json` updated to reflect the new primary image search provider.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] `integrations` array in `docs/project.json`: change SerpAPI entry purpose to "Fallback image search (tertiary, via Edge Function)"
- [ ] Add new integration entry for Walmart Affiliate API: `{ "name": "walmart-affiliate", "purpose": "Primary product image search (via Supabase Edge Function)" }`
- [ ] Add new integration entry for Open Food Facts: `{ "name": "openfoodfacts", "purpose": "Secondary fallback image search for grocery items (free, no API key)" }`
- [ ] Lint passes

## Functional Requirements

- FR-1: The `search-products` Edge Function must try Walmart Affiliate API first, Open Food Facts second, SerpAPI third
- FR-2: Each source must return the same response shape: `{ url, thumbnail, title }`
- FR-3: The response must include a `source` field indicating which provider returned the results
- FR-4: The client-side `searchImages()` contract must not change — ImagePicker must work without modification
- FR-5: Walmart API authentication must use RSA SHA-256 signed headers (Consumer ID, timestamp, key version, signature)
- FR-6: All three API calls must have timeouts (5 seconds each) to prevent cascading slowness
- FR-7: If Walmart returns results, do not call OFF or SerpAPI (short-circuit)
- FR-8: CORS must allow the production domain and localhost dev ports

## Non-Goals

- No changes to the ImagePicker UI — it works as-is
- No changes to the image upload flow — only search is affected
- No affiliate link tracking or commission integration (just images)
- No product price display in the image picker (future enhancement)
- No caching layer for search results (future enhancement)
- No removal of the old `search-images` Edge Function in this PRD (separate cleanup task)

## Technical Considerations

- **Framework:** React/Vite (client), Supabase Edge Functions / Deno (server)
- **Walmart Auth:** RSA-SHA256 signature. The private key (PEM format) must be stored as a Supabase secret. The signature is computed per-request using the Consumer ID, timestamp, and key version.
- **Walmart API base URL:** `https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search`
- **Open Food Facts API:** `https://world.openfoodfacts.org/cgi/search.pl` — free, no auth, rate-limited to ~100 req/min
- **Deno crypto:** Use `crypto.subtle.importKey` and `crypto.subtle.sign` for RSA signing in the Edge Function (Deno supports Web Crypto API natively)
- **Timeouts:** Each provider call should have a 5-second `AbortController` timeout to avoid blocking the user
- **Response mapping:** All three providers use different response schemas but must be normalized to `{ url, thumbnail, title }`

## Credential & Service Access Plan

| Service | Credential Type | Needed For | Request Timing | Fallback if Not Available |
|---------|----------------|------------|----------------|---------------------------|
| Walmart Affiliate API | RSA private key (PEM) + Consumer ID + Key Version | US-001, US-005 | upfront | Build Edge Function structure and test with mocked responses; Walmart search won't work until keys are configured |
| Open Food Facts | None (free, no key) | US-002 | N/A | Always available |
| SerpAPI | API key (existing) | US-003 | N/A | Already configured in Supabase secrets |

## Definition of Done

Implementation is complete when:

1. Searching for a grocery item (e.g., "milk", "bananas") in the ImagePicker returns real Walmart product photos as the primary results
2. Searching for a niche grocery item not on Walmart (e.g., a regional brand) falls back to Open Food Facts product images
3. Searching for a non-food item not on either (edge case) falls back to SerpAPI Google Images
4. The ImagePicker modal works identically to before — no UI changes, no workflow changes
5. All three fallback tiers work in production at `shoppinglistai.vercel.app`
6. The old `search-images` Edge Function is still deployed (rollback safety) but no longer called by the client
7. `docs/project.json` reflects the new integration stack

## Success Metrics

- Product image search returns recognizable product photos (not stock photos) for common grocery items
- Image search responds within 3 seconds for the primary Walmart path
- Fallback chain completes within 10 seconds worst-case (all three providers tried)
- Zero increase in image search errors compared to SerpAPI-only baseline

## Open Questions

- Should we add result caching (e.g., Supabase table or KV) to reduce API calls for repeated searches? (Deferred to future PRD)
- Should we display the product price alongside the image in a future iteration?
- Should we eventually remove the `search-images` Edge Function and `SERPAPI_KEY` once Walmart is proven stable?
