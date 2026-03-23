# PRD: Spoonacular Grocery Product Image Search

## Introduction

Expand the item image search pipeline by adding Spoonacular's grocery product search, merging results from all three primary sources (Walmart, Spoonacular, Open Food Facts) into a single combined response, and removing the artificial cap that limited users to 8 images. Currently the edge function picks the first source that returns results and asks each source for only 8 items; this change runs all three in parallel, requests up to 25 items per source, and returns every deduplicated result — giving users a much richer set of product images to choose from. SerpAPI remains as a sequential last-resort fallback only when all three primary sources return empty. Spoonacular's grocery product database contains 600K+ branded products with images and is already integrated into the app for recipe search — the API key and edge function infrastructure exist.

## Goals

- Improve image search variety by merging results from Walmart, Spoonacular, and Open Food Facts into one response
- Reuse the existing `SPOONACULAR_API_KEY` already deployed for recipe search — zero new credentials
- Keep latency low by running all three sources in parallel
- No client-side changes required — the edge function response shape stays identical (`results` array + `source` string)

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

### US-002: Merge Results from All Three Sources

**Description:** As a user, I want to see product images from Walmart, Spoonacular, and Open Food Facts combined into one set of results, so I have more options to choose from when picking an image for my item.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Walmart, Spoonacular, and Open Food Facts run in parallel via 3-way `Promise.all`
- [ ] Results from all three sources are concatenated into a single `results` array (Walmart first, then Spoonacular, then Open Food Facts)
- [ ] Duplicate images are removed (deduplicate by `thumbnail` URL)
- [ ] The combined array is capped at `numItems` total results (requested count, default 8)
- [ ] Response `source` is `'merged'` when results came from multiple sources, or the single source name if only one returned results
- [ ] SerpAPI is called sequentially only if all three parallel sources returned empty — its results are NOT merged
- [ ] If SerpAPI is used, `source` is `'serpapi'`
- [ ] No increase in latency compared to current behavior (all three already ran, just Walmart + OFF — now adding Spoonacular to the same parallel batch)
- [ ] Edge function deploys successfully

### US-003: Spoonacular Product Image Attribution

**Description:** As a developer, I need to ensure we comply with Spoonacular's API terms by passing proper attribution when their images are used.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Spoonacular product image URLs use their CDN format (`https://img.spoonacular.com/products/...`) — no proxying/rehosting
- [ ] Response `source` field correctly identifies Spoonacular's contribution — returns `'spoonacular'` when it's the sole source, or `'merged'` when combined with other sources
- [ ] Review Spoonacular ToS for product search API image usage requirements (note any attribution needs in a code comment)

## Functional Requirements

- FR-1: Add `searchSpoonacularProducts` function to `supabase/functions/search-products/index.ts`
- FR-2: Call Spoonacular's `GET /food/products/search` with query string, number of results, and API key
- FR-3: Map Spoonacular product response to existing `ProductResult` interface (`url`, `thumbnail`, `title`)
- FR-4: Run Walmart, Spoonacular, and Open Food Facts in parallel via `Promise.all`
- FR-5: Concatenate results from all three sources (Walmart first, Spoonacular second, OFF third), deduplicate by thumbnail URL, and cap at `numItems`
- FR-6: Return `source: 'merged'` when results came from multiple sources, or the single source name when only one contributed
- FR-7: Call SerpAPI sequentially only if all three parallel sources returned empty (not merged with the others)

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

None — this is a backend-only change. The edge function response shape (`{ results: ProductResult[], source: string }`) is unchanged. The `source` field now returns `'merged'` when multiple sources contributed, but clients don't depend on this value for rendering — they only use the `results` array. Both React and Swift clients work without modification.

## Success Metrics

- Image search returns more results per query (merged from up to 3 sources instead of picking one winner)
- Users see a wider variety of product images, improving the chances of finding a good match
- No increase in p95 latency (all three sources already run in parallel)
- SerpAPI usage decreases (fewer cases where all primary sources return empty)

## Credential & Service Access Plan

No external credentials required for this PRD.

The existing `SPOONACULAR_API_KEY` deployed for recipe search will be reused. No new secrets, no new accounts, no provisioning needed.

## Definition of Done

- `search-products` edge function deploys with the new `searchSpoonacularProducts` function
- Walmart, Spoonacular, and Open Food Facts all run in parallel via `Promise.all` and their results are merged (concatenated, deduplicated by thumbnail URL, capped at `numItems`)
- `source` field returns `'merged'` when multiple sources contributed, or the single source name when only one returned results
- SerpAPI is called sequentially only when all three primary sources returned empty — its results are NOT merged
- A search for a common product (e.g., "milk") returns images from multiple sources in a single response
- No regressions: existing Walmart-hit and Open Food Facts-hit paths still work correctly
- Both React web and Swift iOS image search work without any client-side changes
- Edge function response shape remains `{ results: ProductResult[], source: string }`

## Open Questions

None — all resolved.

- ~~**Image sizes:**~~ Resolved: 312x231 for `url`, 100x100 for `thumbnail`.
- ~~**Quota sharing:**~~ Resolved: No monitoring mechanism needed now. The free tier (150 pts/day) is shared with recipe search. If usage grows and hits the limit, upgrade the Spoonacular plan ($29/mo = 1,500 pts/day).
