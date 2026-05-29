# PRD: Image Search Source Toggles

**Status:** ready
**Slug:** image-search-source-toggles
**Created:** 2026-05-29
**Project:** Gather

---

## Summary

Users currently have no control over which image search services are used when picking an item image. This PRD adds per-service toggles to the Settings screen (React web + Swift iOS) so users can enable or disable Walmart, Spoonacular, Open Food Facts, and SerpAPI individually. Preferences are stored per-user in the `profiles` table as a JSONB column. The edge function respects a `sources` param, skips disabled services, and returns results grouped by source. The ImagePicker renders results in per-service sections. If all sources are disabled, the "Search online" tab remains visible but shows an empty-state message with a link to Settings to enable sources.

---

## Background

- Image search currently calls a `search-products` Supabase Edge Function that runs Walmart, Spoonacular, and Open Food Facts in parallel, falling back to SerpAPI if all three return empty. The client has no say in which sources are used.
- Walmart is the highest-quality source (real product photos) but users may want to opt out of specific providers for personal reasons.
- Preferences must sync across devices → stored in Supabase `profiles`.
- Both React web and Swift iOS use image search → both platforms must respect the toggles.

---

## Locked Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Where are preferences stored? | Per-user in Supabase `profiles` table |
| 2 | Which services are toggle-able? | All four: Walmart, Spoonacular, Open Food Facts, SerpAPI |
| 3 | What happens when all are off? | Keep "Search online" tab visible; show empty-state message + link to Settings to enable sources |
| 7 | How are search results rendered? | Per-service sections with a label heading per source; edge function returns grouped response |
| 4 | Default states? | Walmart on; Spoonacular, Open Food Facts, SerpAPI off |
| 5 | Storage format? | JSONB column `image_search_settings` on `profiles` |
| 6 | Platforms? | React web + Swift iOS |

---

## User Stories

---

### S-1 — Add `image_search_settings` column to `profiles`

**Priority:** high

**Description:**
As a developer, I need a migration that adds `image_search_settings` to the `profiles` table so user preferences can be persisted and synced across devices.

**Acceptance Criteria:**

1. New migration file created at `supabase/migrations/{timestamp}_add_image_search_settings_to_profiles.sql`.
2. Column definition: `image_search_settings jsonb NOT NULL DEFAULT '{"walmart":true,"spoonacular":false,"openfoodfacts":false,"serpapi":false}'::jsonb`.
3. `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS` pattern used for safety.
4. Existing rows receive the default value via the column default (no explicit backfill needed).
5. RLS policies on `profiles` are unchanged — users can already read and update their own row.
6. Migration runs cleanly against the local Supabase instance (`supabase db reset` succeeds).
7. `npm run lint` passes with no new errors.
8. `npm run build` succeeds.

**Flow Chart:**

```
1. supabase/migrations/{timestamp}_add_image_search_settings_to_profiles.sql
   └─ ALTER TABLE profiles ADD COLUMN IF NOT EXISTS image_search_settings jsonb
        NOT NULL DEFAULT '{"walmart":true,"spoonacular":false,"openfoodfacts":false,"serpapi":false}'::jsonb

2. VERIFY QUALITY
   ├─ Run lint: npm run lint
   └─ Run build: npm run build
```

---

### S-2 — React: load and save `image_search_settings` in profile service

**Priority:** high

**Description:**
As a developer, I need the React app to read `image_search_settings` from the user's profile and expose a function to update it, so Settings and ImagePicker components can consume and persist preferences.

**Acceptance Criteria:**

1. `AuthContext.jsx`: the `profiles` SELECT query adds `image_search_settings` to the selected columns — `select('id, display_name, email, avatar_url, created_at, timezone, image_search_settings')`.
2. The `profile` object in context includes `imageSearchSettings` (camelCased, mapping from the snake_case column name `image_search_settings` returned by Supabase — this mapping must be applied explicitly when constructing the profile object from the query response).
3. A new exported function `updateImageSearchSettings(userId, settings)` is added to `src/services/database.js` (or the appropriate service file following existing patterns).
   - `settings` is an object with keys `walmart`, `spoonacular`, `openfoodfacts`, `serpapi` (all booleans).
   - Performs a Supabase `update` on `profiles` where `id = userId`.
   - Returns `{ error }` — callers handle errors.
4. If `image_search_settings` is `null` on the profile (pre-migration rows), the app falls back to `{ walmart: true, spoonacular: false, openfoodfacts: false, serpapi: false }` rather than crashing.
5. `npm run lint` passes with no new errors.
6. `npm run build` succeeds.

**Flow Chart:**

```
1. src/context/AuthContext.jsx
   └─ Update SELECT to include image_search_settings

2. src/services/database.js (or equivalent)
   └─ Add updateImageSearchSettings(userId, settings)
        └─ supabase.from('profiles').update({ image_search_settings: settings }).eq('id', userId)

3. src/context/AuthContext.jsx — profile construction
   └─ Map image_search_settings → imageSearchSettings when building the profile object from the Supabase response

4. VERIFY QUALITY
   ├─ Run lint: npm run lint
   └─ Run build: npm run build
```

---

### S-3 — React: Image Search Settings UI in MobileSettings

**Priority:** high

**Description:**
As a user, I want to see an "Image Search" section in Settings where I can toggle each search service on or off, so I have control over which sources are used when I pick an item image.

**Acceptance Criteria:**

1. A new "Image Search" section is added to `MobileSettings.jsx` below the "Appearance" section.
2. The section contains four toggle rows using the existing `.toggleRow` / `.toggle` / `.toggleTrack` CSS pattern:
   - **Walmart** (label: "Walmart")
   - **Spoonacular** (label: "Spoonacular")
   - **Open Food Facts** (label: "Open Food Facts")
   - **SerpAPI** (label: "SerpAPI")
3. Each toggle's checked state is driven by `profile.imageSearchSettings[key]` from `AuthContext`.
4. Toggling a switch immediately calls `updateImageSearchSettings(userId, updatedSettings)` and optimistically updates local state.
5. On save error, the toggle reverts to its previous state and a brief error message is shown (matching existing error handling patterns in the component).
6. The section header reads "Image Search" (matching existing `.sectionHeader` style).
7. No toggle prevents disabling the last active source — all four can be turned off simultaneously.
8. `npm run lint` passes with no new errors.
9. `npm run build` succeeds.

**Flow Chart:**

```
1. src/components/MobileSettings.jsx
   ├─ Read profile.imageSearchSettings from AuthContext
   ├─ Add local state: imageSearchSettings (initialised from profile)
   ├─ Add handleImageSearchToggle(key) handler
   │    ├─ Optimistically update local state
   │    ├─ Call updateImageSearchSettings(userId, newSettings)
   │    └─ On error: revert state + show error message
   └─ Add "Image Search" <section> with four .toggleRow rows
        └─ Keys: walmart, spoonacular, openfoodfacts, serpapi

2. src/components/MobileSettings.module.css
   └─ No new classes needed — reuse existing .section, .sectionHeader, .toggleRow, .toggle, .toggleTrack

3. VERIFY QUALITY
   ├─ Run lint: npm run lint
   └─ Run build: npm run build
```

---

### S-4 — Edge function: respect `sources` param and return grouped results

**Priority:** high

**Description:**
As a developer, I need the `search-products` edge function to accept a `sources` query param, skip disabled services, and return results grouped by source so the client can render per-service sections.

**Acceptance Criteria:**

1. The edge function at `supabase/functions/search-products/index.ts` accepts an optional `sources` query param — a comma-separated list of enabled service keys: e.g., `sources=walmart,serpapi`.
2. When `sources` is provided, only the listed services are called. Unlisted services are skipped entirely (not called, not waited on).
3. When `sources` is absent or empty, all services run as today (backward-compatible default — all four enabled).
4. The parallel `Promise.all` for the three primary sources (Walmart, Spoonacular, Open Food Facts) is filtered to only include enabled sources before the call.
5. SerpAPI: only called sequentially when it is in the enabled list AND all enabled primary sources returned empty.
6. If `sources` contains only `serpapi`, SerpAPI is called directly without running any primary source.
7. **Response shape changes** from a flat `{ results, source }` to a grouped format:
   ```json
   {
     "groups": [
       { "source": "walmart", "label": "Walmart", "results": [ ...ProductResult ] },
       { "source": "spoonacular", "label": "Spoonacular", "results": [ ...ProductResult ] },
       { "source": "openfoodfacts", "label": "Open Food Facts", "results": [ ...ProductResult ] },
       { "source": "serpapi", "label": "SerpAPI", "results": [ ...ProductResult ] }
     ]
   }
   ```
8. Only sources that returned at least one result are included in `groups` (empty-result sources are omitted).
9. Group order matches the source priority order: Walmart → Spoonacular → Open Food Facts → SerpAPI.
10. Each `ProductResult` retains its existing shape: `{ url, thumbnail, title }`.
11. Clients that pass no `sources` param receive all non-empty groups (backward-compatible in behavior, new in shape — all callers will be updated in S-5 and S-7).
12. **Deployment order:** This story must not be deployed to production until S-5 (React client) and S-7 (iOS client) are also ready to deploy. All three should be released atomically, or S-5 and S-7 must ship first.
13. `deno lint supabase/functions/search-products/index.ts` passes.

**Flow Chart:**

```
1. supabase/functions/search-products/index.ts
   ├─ Parse: enabledSources = new Set(url.searchParams.get('sources')?.split(',') ?? ['walmart','spoonacular','openfoodfacts','serpapi'])
   ├─ Build parallel batch: filter primary runners [walmart, spoonacular, openfoodfacts] by enabledSources
   ├─ Run filtered batch via Promise.all → { source, results }[] per runner
   ├─ If all primary results empty AND enabledSources.has('serpapi') → call searchSerpApi sequentially
   ├─ Collect all { source, label, results } entries
   ├─ Filter to entries where results.length > 0
   └─ Return { groups: [...] }

2. VERIFY QUALITY
   └─ deno lint supabase/functions/search-products/index.ts
```

---

### S-5 — React: pass `sources`, render per-service sections, empty-state when all off

**Priority:** high

**Description:**
As a user, I want image search results grouped by service so I can see which source each image comes from. When all sources are off, I want a clear message in the search tab with a link to Settings to enable them.

**Acceptance Criteria:**

1. `src/services/imageSearch.js`: `searchImages(query, count, enabledSources)` gains a third parameter.
   - `enabledSources` defaults to `{ walmart: true, spoonacular: true, openfoodfacts: true, serpapi: true }` for backward compatibility.
   - Builds a comma-separated `sources` param from keys where value is `true` and appends it to the edge function URL.
   - If all values are `false`, returns `[]` immediately without calling the edge function.
   - Returns `response.groups` (the array) from the edge function response (see S-4). The function always returns an array — never a wrapped object.
   - The cache key is derived from both `query` and the sorted `sources` string — e.g., `${query}:${sourcesString}` — so changing enabled sources invalidates prior cached results for the same query.
2. `ImagePicker.jsx` — all-sources-off empty state:
   - The "Search online" tab is always rendered (never hidden).
   - When `allSourcesOff` is true and the user is on the search tab, display an empty-state message in the content area: e.g., *"No image sources are enabled. Go to Settings to turn on image search."*
   - The message includes a button or tappable link that navigates the user to the Settings screen. Navigation must use the existing in-app routing/navigation pattern (do not use `window.location` or reload).
   - No search input or results grid is rendered in this state.
3. `ImagePicker.jsx` — per-service sections when sources are active:
   - Results are rendered as a list of sections, one per group returned by the edge function.
   - Each section has a heading showing the service label (e.g., "Walmart", "Spoonacular", "Open Food Facts", "SerpAPI").
   - Images within each section render in the existing grid/thumbnail style.
   - Sections with zero results are not rendered (edge function already omits them — client respects this).
   - If the edge function returns `[]` (all enabled sources returned nothing), display the existing "No images found" empty state.
4. `ImagePicker.jsx` receives an `imageSearchSettings` prop (object with four boolean keys) and an `onNavigateToSettings` callback prop.
5. `ImagePicker.propTypes` updated: `imageSearchSettings: PropTypes.object`, `onNavigateToSettings: PropTypes.func`.
6. All callers of `<ImagePicker>` pass `imageSearchSettings={profile?.imageSearchSettings}` and an appropriate `onNavigateToSettings` handler.
7. `npm run lint` passes with no new errors.
8. `npm run build` succeeds.

**Flow Chart:**

```
1. src/services/imageSearch.js
   ├─ Add enabledSources param (default: all true)
   ├─ Derive sources string: Object.entries(enabledSources).filter(([,v])=>v).map(([k])=>k).join(',')
   ├─ If sources string is empty → return []
   └─ Append &sources={sourcesString} to edge function URL; return response.groups (always an array)

2. src/components/ImagePicker.jsx
   ├─ Accept imageSearchSettings and onNavigateToSettings props
   ├─ Derive allSourcesOff: every value in imageSearchSettings is false (or imageSearchSettings is empty)
   ├─ Search tab content:
   │    ├─ If allSourcesOff → render empty-state message + Settings button (calls onNavigateToSettings)
   │    └─ If not allSourcesOff → render search input + per-section results grid
   │         ├─ On search: call searchImages(query, count, imageSearchSettings)
   │         └─ Map response.groups → <section> per group with label heading + image grid
   └─ "Search online" tab always rendered

3. Callers of <ImagePicker>
   └─ Pass imageSearchSettings={profile?.imageSearchSettings} and onNavigateToSettings

4. VERIFY QUALITY
   ├─ Run lint: npm run lint
   └─ Run build: npm run build
```

---

### S-6 — Swift iOS: profile model + settings persistence

**Priority:** high

**Description:**
As a developer, I need the iOS app to read and write `image_search_settings` from the user's Supabase profile so the Swift app respects the same preferences as the web app.

**Acceptance Criteria:**

1. The Swift `Profile` (or equivalent) model gains an `imageSearchSettings: ImageSearchSettings` property, where `ImageSearchSettings` is a `Codable` struct with four `Bool` fields: `walmart`, `spoonacular`, `openfoodfacts`, `serpapi`.
2. Default value when the column is null or the key is missing: `ImageSearchSettings(walmart: true, spoonacular: false, openfoodfacts: false, serpapi: false)`.
3. The Supabase profile fetch query includes `image_search_settings` in the selected columns.
4. A `updateImageSearchSettings(_ settings: ImageSearchSettings) async throws` function is added to the profile/auth service layer, updating the `profiles` row via Supabase Swift client.
5. No `CodingKeys` are needed — the JSONB keys (`walmart`, `spoonacular`, `openfoodfacts`, `serpapi`) are already lowercase and match the Swift property names directly. Swift's default decoding handles them without explicit key mapping.
6. Project builds successfully (`xcodebuild` or equivalent succeeds).

---

### S-7 — Swift iOS: settings UI toggles + ProductSearchService + image picker sections

**Priority:** high

**Description:**
As a user on iOS, I want the same image search toggles available in the native settings screen, results grouped by service in the image picker, and a Settings link when all sources are off.

**Acceptance Criteria:**

1. An "Image Search" section is added to the iOS settings screen with four `Toggle` rows: Walmart, Spoonacular, Open Food Facts, SerpAPI.
2. Each toggle is bound to the corresponding field in the user's `imageSearchSettings`.
3. Toggling calls `updateImageSearchSettings` and optimistically updates local state; on error, reverts and shows an alert matching existing iOS error handling patterns.
4. `ProductSearchService.searchProducts(query:count:)` gains a `sources: ImageSearchSettings` parameter.
   - Builds the `sources` query param string from enabled keys and appends it to the edge function URL.
   - If all sources are disabled, returns `[]` immediately without a network call.
   - Parses the new `groups` response shape (S-4) into `[ProductResultGroup]` where each group has `source: String`, `label: String`, and `results: [ProductResult]`.
5. The iOS image picker renders results as a list of sections, one per group, with the group `label` as the section header. Images within each section render in the existing grid style.
6. When all sources are off, the search UI shows an empty-state message with a button that navigates to the Settings screen (using the existing in-app navigation pattern).
7. Project builds successfully.

---

## Out of Scope

- Adding new image search providers beyond the current four.
- Per-list or per-item image search settings (this is global user preference only).
- Admin-level disabling of sources for all users.
- Caching invalidation when settings change mid-session (cache is short-lived; acceptable to let it expire naturally).
