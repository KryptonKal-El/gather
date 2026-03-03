# Human Testing Script: Walmart Image Search

## Overview
Verify the new product image search with Walmart → Open Food Facts → SerpAPI fallback chain.

## Prerequisites
- App is deployed and accessible (Vercel auto-deploy from commit 874ce60)
- You are signed in to the app

## Test Cases

### Test 1: Basic Image Search
1. Open the app
2. Create a new shopping list or open an existing one
3. Add an item (e.g., "bananas")
4. Observe that a product image appears for the item
5. **Expected:** An image loads successfully (may come from any of the three sources)

### Test 2: Various Product Types
Try adding these items and confirm images appear:
- "milk" — common grocery item
- "Doritos" — branded snack
- "organic quinoa" — specialty item
- "toilet paper" — non-food item

**Expected:** Images load for most/all items. Some obscure items may not have images.

### Test 3: Verify Fallback Chain (Developer Console)
1. Open browser DevTools → Network tab
2. Add a new item to a shopping list
3. Find the `search-products` network request
4. Check the response JSON for a `source` field
5. **Expected:** Source is one of: `"walmart"`, `"openfoodfacts"`, or `"serpapi"`

### Test 4: Error Resilience
1. With DevTools open, add items quickly in succession
2. Observe that images still load (no cascading failures)
3. **Expected:** Each request completes independently; failures in one don't affect others

## Notes
- The old `search-images` endpoint is still deployed as a rollback option
- If no images load at all, check that `VITE_SUPABASE_EDGE_FUNCTION_URL` is set correctly
- If Walmart never appears as a source, the API credentials may need verification
