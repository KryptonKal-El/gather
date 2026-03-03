/**
 * Image search service.
 * Calls the Supabase Edge Function proxy which forwards requests to SerpAPI.
 */

/**
 * Searches Google Images for photos matching the query.
 * Uses the Supabase Edge Function endpoint to avoid CORS issues.
 * @param {string} query - The search term
 * @param {number} [count=8] - Number of results to return
 * @returns {Promise<Array<{ url: string, thumbnail: string, title: string }>>}
 */
export const searchImages = async (query, count = 8) => {
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
    const res = await fetch(`${baseUrl}/search-images?${params}`, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
      },
    });

    if (!res.ok) {
      console.error(`Image search failed: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    return data.results ?? [];
  } catch (err) {
    console.error('Image search error:', err);
    return [];
  }
};
