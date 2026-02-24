/**
 * Image search service.
 * Calls the Cloud Function proxy which forwards requests to SerpAPI.
 * In development, falls back to calling SerpAPI directly via the Vite dev proxy.
 */

/**
 * Searches Google Images for photos matching the query.
 * Uses the `/api/searchImages` endpoint which routes to a Firebase Cloud Function
 * in production, avoiding CORS issues with third-party APIs.
 * @param {string} query - The search term
 * @param {number} [count=8] - Number of results to return
 * @returns {Promise<Array<{ url: string, thumbnail: string, title: string }>>}
 */
export const searchImages = async (query, count = 8) => {
  const params = new URLSearchParams({
    q: query,
    num: String(count),
  });

  try {
    const res = await fetch(`/api/searchImages?${params}`);

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
