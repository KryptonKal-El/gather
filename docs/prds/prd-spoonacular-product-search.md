# PRD: Spoonacular Grocery Product Image Search

## Introduction

Expand the item image search pipeline by adding Spoonacular's grocery product search, merging results from all three primary sources (Walmart, Spoonacular, Open Food Facts) into a single combined response, and removing the artificial cap that limited users to 8 images. Currently the edge function picks the first source that returns results and asks each source for only 8 items; this change runs all three in parallel, requests up to 25 items per source, and returns every deduplicated result — giving users a much richer set of product images to choose from. SerpAPI remains as a sequential last-resort fallback only when all three primary sources return empty. Spoonacular's grocery product database contains 600K+ branded products with images and is already integrated into the app for recipe search — the API key and edge function infrastructure exist.

## Goals

- Show users significantly more product images to choose from (up to ~75 merged results vs the current 8)
- Improve image search variety by merging results from Walmart, Spoonacular, and Open Food Facts into one response
- Reuse the existing `SPOONACULAR_API_KEY` already deployed for recipe search — zero new credentials
- Keep latency low by running all three sources in parallel
- Edge function response shape stays identical (`results` array + `source` string) — clients only need to update the default count parameter

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

- [ ] Edge function `num` query param default changes from `'8'` to `'25'` (each source is asked for up to `num` items)
- [ ] Walmart, Spoonacular, and Open Food Facts run in parallel via 3-way `Promise.all`, each requesting `num` items
- [ ] Results from all three sources are concatenated into a single `results` array (Walmart first, then Spoonacular, then Open Food Facts)
- [ ] Duplicate images are removed (deduplicate by `thumbnail` URL)
- [ ] No cap on the merged results — all deduplicated results are returned to the client
- [ ] Response `source` is `'merged'` when results came from multiple sources, or the single source name if only one returned results
- [ ] SerpAPI is called sequentially only if all three parallel sources returned empty — its results are NOT merged
- [ ] If SerpAPI is used, `source` is `'serpapi'`
- [ ] React web client default count updated from `8` to `25` in `searchImages()` (`src/services/imageSearch.js`)
- [ ] Swift iOS client default count updated from `8` to `25` in `ProductSearchService.searchProducts()` (`ProductSearchService.swift`)
- [ ] No increase in latency compared to current behavior (all three sources already ran in parallel — now adding Spoonacular to the same batch)
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
- FR-4: Run Walmart, Spoonacular, and Open Food Facts in parallel via `Promise.all`, each requesting up to `num` items (default 25)
- FR-5: Concatenate results from all three sources (Walmart first, Spoonacular second, OFF third), deduplicate by thumbnail URL, and return all results (no cap)
- FR-6: Return `source: 'merged'` when results came from multiple sources, or the single source name when only one contributed
- FR-7: Call SerpAPI sequentially only if all three parallel sources returned empty (not merged with the others)
- FR-8: Update React web client (`src/services/imageSearch.js`) default `count` from `8` to `25`
- FR-9: Update Swift iOS client (`ProductSearchService.swift`) default `count` from `8` to `25`

## Non-Goals

- No new UI layout or design changes — both platforms already use scrollable grids that handle variable result counts
- No new UI for source attribution (can be added later if Spoonacular requires it)
- No Spoonacular UPC/barcode search (future enhancement)
- No caching layer on the edge function (client-side caching already exists on both platforms)
- No changes to the recipe search edge function (`search-recipes`)

## Technical Considerations

- **Per-source request count:** Each source is asked for `num` items (default 25). Walmart's API maxes out at 25 per request, which is the natural ceiling. Spoonacular and Open Food Facts can handle up to 100 but 25 is sufficient.
- **No cap on merged results:** After deduplication, all results are returned. With 3 sources × 25 items, the theoretical max is ~75 results pre-dedup. In practice most queries return fewer due to source overlap and empty results from some sources.
- **Spoonacular API endpoint:** `GET https://api.spoonacular.com/food/products/search?query={q}&number={n}&apiKey={key}`
- **Response shape:** `{ products: [{ id, title, image, imageType, ... }], totalProducts, ... }`
- **Image URL format:** Use `https://img.spoonacular.com/products/{id}-312x231.{imageType}` for `url` and `https://img.spoonacular.com/products/{id}-100x100.{imageType}` for `thumbnail`
- **Rate limits:** Free tier = 150 requests/day (shared with recipe search). Paid tiers: $29/mo = 1,500/day, $79/mo = 3,000/day
- **Existing API key:** `SPOONACULAR_API_KEY` already set in Supabase Edge Function secrets for `search-recipes`
- **Points cost:** Product search costs 1 point per request on Spoonacular's quota system (same cost regardless of `number` param)
- **Shared quota consideration:** Product search and recipe search share the same API key and daily quota. Under heavy usage this could exhaust the free tier faster. Monitor usage and upgrade plan if needed.

## Design Considerations

Primarily a backend change. The edge function response shape (`{ results: ProductResult[], source: string }`) is unchanged — only the number of results in the array increases. The `source` field now returns `'merged'` when multiple sources contributed, but clients don't depend on this value for rendering — they only use the `results` array.

**Client changes (minimal):** Both React web (`searchImages()`) and Swift iOS (`ProductSearchService.searchProducts()`) need their default `count` parameter updated from `8` to `25`. No UI layout changes are needed — React already renders results in a flexible container and iOS uses a `LazyVGrid` that handles variable item counts natively.

## Success Metrics

- Image search returns significantly more results per query (up to ~75 merged from 3 sources × 25 each, vs the current max of 8 from a single source)
- Users see a wider variety of product images, improving the chances of finding a good match
- No increase in p95 latency (all three sources run in parallel; Spoonacular is added to the existing parallel batch)
- SerpAPI usage decreases (fewer cases where all primary sources return empty)

## Credential & Service Access Plan

No external credentials required for this PRD.

The existing `SPOONACULAR_API_KEY` deployed for recipe search will be reused. No new secrets, no new accounts, no provisioning needed.

## Definition of Done

- `search-products` edge function deploys with the new `searchSpoonacularProducts` function
- Edge function `num` param defaults to `25` (was `8`)
- Walmart, Spoonacular, and Open Food Facts all run in parallel via `Promise.all` and their results are merged (concatenated, deduplicated by thumbnail URL, no cap on total results)
- `source` field returns `'merged'` when multiple sources contributed, or the single source name when only one returned results
- SerpAPI is called sequentially only when all three primary sources returned empty — its results are NOT merged
- A search for a common product (e.g., "milk") returns significantly more images than before (well above the old 8 limit)
- React web client default count is `25`
- Swift iOS client default count is `25`
- No regressions: existing Walmart-hit and Open Food Facts-hit paths still work correctly
- Both React web and Swift iOS image picker grids display all returned results without truncation
- Edge function response shape remains `{ results: ProductResult[], source: string }`

## Open Questions

None — all resolved.

- ~~**Image sizes:**~~ Resolved: 312x231 for `url`, 100x100 for `thumbnail`.
- ~~**Quota sharing:**~~ Resolved: No monitoring mechanism needed now. The free tier (150 pts/day) is shared with recipe search. If usage grows and hits the limit, upgrade the Spoonacular plan ($29/mo = 1,500 pts/day).
