/**
 * Image search service.
 * Calls the Supabase Edge Function proxy which searches Walmart, Open Food Facts, and SerpAPI.
 */

const CACHE_TTL = 5 * 60 * 1000;
const searchCache = new Map();

/**
 * Searches for product images matching the query.
 * Uses the Supabase Edge Function endpoint with a Walmart → Open Food Facts → SerpAPI fallback chain.
 * Results are cached client-side for 5 minutes.
 * @param {string} query - The search term
 * @param {number} [count=8] - Number of results to return
 * @returns {Promise<Array<{ url: string, thumbnail: string, title: string }>>}
 */
export const searchImages = async (query, count = 8) => {
  const cacheKey = query.trim().toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.results;
  }
  const baseUrl = import.meta.env.VITE_SUPABASE_EDGE_FUNCTION_URL;
  if (!baseUrl) {
    console.error('Image search failed: VITE_SUPABASE_EDGE_FUNCTION_URL not configured');
    return [];
  }

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.error('Image search failed: VITE_SUPABASE_ANON_KEY not configured');
    return [];
  }

  const params = new URLSearchParams({
    q: query,
    num: String(count),
  });

  try {
    const res = await fetch(`${baseUrl}/search-products?${params}`, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
      },
    });

    if (!res.ok) {
      console.error(`Image search failed: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    searchCache.set(cacheKey, { results: data.results ?? [], timestamp: Date.now() });
    return data.results ?? [];
  } catch (err) {
    console.error('Image search error:', err);
    return [];
  }
};
