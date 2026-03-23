# PRD: Spoonacular Grocery Product Image Search

## Introduction

Expand the item image search pipeline by adding Spoonacular's grocery product search as a second-tier source, slotting it between Walmart (primary) and Open Food Facts (tertiary). Spoonacular's grocery product database contains 600K+ branded products with images and is already integrated into the app for recipe search — the API key and edge function infrastructure exist. This PRD adds a new `searchSpoonacularProducts` function to the existing `search-products` edge function and wires it into the parallel/fallback resolution chain.

## Goals

- Improve image search hit rate by adding a 600K+ product database between Walmart and Open Food Facts
- Reuse the existing `SPOONACULAR_API_KEY` already deployed for recipe search — zero new credentials
- Keep latency low by running Spoonacular in parallel with the existing Walmart + Open Food Facts calls
- No client-side changes required — the edge function response shape stays identical

## User Stories

### US-001: Add Spoonacular Grocery Product Search to Edge Function

**Description:** As a developer, I need a `searchSpoonacularProducts` function in `search-products/index.ts` that calls Spoonacular's `/food/products/search` endpoint and returns results in the existing `ProductResult` shape.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none (reuses existing `SPOONACULAR_API_KEY`)

**Acceptance Criteria:**

- [ ] New `searchSpoonacularProducts(query, numItems)` function added to `search-products/index.ts`
- [ ] Calls `https://api.spoonacular.com/food/products/search` with `query` and `number` params
- [ ] Uses `SPOONACULAR_API_KEY` from `Deno.env` (same key as `search-recipes`)
- [ ] Maps response `products[].image` to `ProductResult.url` (312x231 size) and `ProductResult.thumbnail` (100x100 size)
- [ ] Maps response `products[].title` to `ProductResult.title`
- [ ] 5-second timeout with AbortController (matching existing pattern)
- [ ] Returns empty array on error (graceful degradation, matching existing pattern)
- [ ] Filters out products with no image

### US-002: Wire Spoonacular into the Fallback Chain

**Description:** As a user, I want the image search to check Spoonacular's grocery database when Walmart returns no results, so I get more product matches without waiting longer.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Spoonacular product search runs in parallel with Walmart and Open Food Facts (3-way `Promise.all`)
- [ ] Priority order: Walmart → Spoonacular → Open Food Facts → SerpAPI
- [ ] SerpAPI remains the final sequential fallback (only called if all three parallel sources return empty)
- [ ] Response includes `source: 'spoonacular'` when Spoonacular results are used
- [ ] No increase in latency for the Walmart-hit case (parallel execution)
- [ ] Edge function deploys successfully

### US-003: Spoonacular Product Image Attribution

**Description:** As a developer, I need to ensure we comply with Spoonacular's API terms by passing proper attribution when their images are used.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Spoonacular product image URLs use their CDN format (`https://img.spoonacular.com/products/...`) — no proxying/rehosting
- [ ] Response `source` field correctly identifies `'spoonacular'` so clients can attribute if needed
- [ ] Review Spoonacular ToS for product search API image usage requirements (note any attribution needs in a code comment)

## Functional Requirements

- FR-1: Add `searchSpoonacularProducts` function to `supabase/functions/search-products/index.ts`
- FR-2: Call Spoonacular's `GET /food/products/search` with query string, number of results, and API key
- FR-3: Map Spoonacular product response to existing `ProductResult` interface (`url`, `thumbnail`, `title`)
- FR-4: Run Walmart, Spoonacular, and Open Food Facts in parallel via `Promise.all`
- FR-5: Resolve results in priority order: Walmart → Spoonacular → Open Food Facts → SerpAPI
- FR-6: Return `source: 'spoonacular'` when Spoonacular provides the winning results

## Non-Goals

- No changes to the React web client (`src/services/imageSearch.js`) — response shape is unchanged
- No changes to the Swift iOS client (`ProductSearchService.swift`) — response shape is unchanged
- No new UI for source attribution (can be added later if Spoonacular requires it)
- No Spoonacular UPC/barcode search (future enhancement)
- No caching layer on the edge function (client-side caching already exists on both platforms)
- No changes to the recipe search edge function (`search-recipes`)

## Technical Considerations

- **Spoonacular API endpoint:** `GET https://api.spoonacular.com/food/products/search?query={q}&number={n}&apiKey={key}`
- **Response shape:** `{ products: [{ id, title, image, imageType, ... }], totalProducts, ... }`
- **Image URL format:** Use `https://img.spoonacular.com/products/{id}-312x231.{imageType}` for `url` and `https://img.spoonacular.com/products/{id}-100x100.{imageType}` for `thumbnail`
- **Rate limits:** Free tier = 150 requests/day (shared with recipe search). Paid tiers: $29/mo = 1,500/day, $79/mo = 3,000/day
- **Existing API key:** `SPOONACULAR_API_KEY` already set in Supabase Edge Function secrets for `search-recipes`
- **Points cost:** Product search costs 1 point per request on Spoonacular's quota system
- **Shared quota consideration:** Product search and recipe search share the same API key and daily quota. Under heavy usage this could exhaust the free tier faster. Monitor usage and upgrade plan if needed.

## Design Considerations

None — this is a backend-only change. The edge function response shape (`{ results: ProductResult[], source: string }`) is unchanged, so both React and Swift clients work without modification.

## Success Metrics

- Image search returns results for queries where Walmart previously returned empty
- No increase in p95 latency for queries that hit Walmart (parallel execution)
- Spoonacular source appears in edge function logs for product categories not well-covered by Walmart (European brands, niche products)

## Credential & Service Access Plan

No external credentials required for this PRD.

The existing `SPOONACULAR_API_KEY` deployed for recipe search will be reused. No new secrets, no new accounts, no provisioning needed.

## Definition of Done

- `search-products` edge function deploys with the new `searchSpoonacularProducts` function
- The fallback chain runs Walmart + Spoonacular + Open Food Facts in parallel, with SerpAPI as sequential last resort
- A search for a product not in Walmart's catalog (e.g., a European branded item) returns Spoonacular results
- No regressions: existing Walmart-hit and Open Food Facts-hit paths still work correctly
- Both React web and Swift iOS image search work without any client-side changes
- Edge function response shape remains `{ results: ProductResult[], source: string }`

## Open Questions

None — all resolved.

- ~~**Image sizes:**~~ Resolved: 312x231 for `url`, 100x100 for `thumbnail`.
- ~~**Quota sharing:**~~ Resolved: No monitoring mechanism needed now. The free tier (150 pts/day) is shared with recipe search. If usage grows and hits the limit, upgrade the Spoonacular plan ($29/mo = 1,500 pts/day).
