# Image search: one request per source, failures reported explicitly

## Problem
Google Images (SerpAPI) results were intermittently missing. SerpAPI takes over 5s on a
query it hasn't seen before; the edge function's 5s timeout turned that into an empty
list, the empty section was dropped, and the incomplete response was cached
(`Cache-Control: max-age=3600` plus the 5-minute client caches), so retries replayed the gap.

## How it works now
- Web (`searchImageSource`) and iOS (`ProductSearchService.search`) call `search-products`
  once per enabled source (`sources=<one key>`). Each section has its own loading, empty,
  error and retry state.
- The edge function returns `{ groups, failed }`. `failed` lists sources that errored or
  timed out. A source missing from both `groups` and `failed` means "no results".
- Responses with any failed source are sent `no-store`; clients cache per source and only
  on success.
- SerpAPI's timeout is 12s; the others stay at 5s.

## Keep in mind
- `groups` keeps its old shape because shipped iOS builds still send all sources in one
  request and decode only `groups`. Don't remove or rename it.
- A new source needs: the edge function `SourceKey`/`searchFns`, `IMAGE_SOURCES` in
  `src/services/imageSearch.js`, `ImageSearchSource` in `ProductSearchService.swift`, and
  the settings toggles.
- Edge function changes need a manual deploy (see supabase-edge-functions-manual-deploy.md).
