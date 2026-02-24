/**
 * SerpAPI Google Images search service.
 * Uses SerpAPI to retrieve Google Image results by keyword.
 * Requires VITE_SERPAPI_KEY environment variable.
 */

const API_KEY = import.meta.env.VITE_SERPAPI_KEY ?? '';
const BASE_URL = 'https://serpapi.com/search.json';

/**
 * Searches Google Images via SerpAPI for photos matching the query.
 * @param {string} query - The search term
 * @param {number} [count=8] - Number of results to return
 * @returns {Promise<Array<{ url: string, thumbnail: string, title: string }>>}
 */
export const searchImages = async (query, count = 8) => {
  if (!API_KEY) {
    console.warn('Image search unavailable: missing VITE_SERPAPI_KEY');
    return [];
  }

  const params = new URLSearchParams({
    engine: 'google_images',
    q: query,
    api_key: API_KEY,
    num: String(count),
    safe: 'active',
  });

  const res = await fetch(`${BASE_URL}?${params}`);

  if (!res.ok) {
    console.error(`Image search failed: ${res.status} ${res.statusText}`);
    return [];
  }

  const data = await res.json();
  const results = data.images_results ?? [];

  return results.slice(0, count).map((img) => ({
    url: img.original,
    thumbnail: img.thumbnail,
    title: img.title ?? '',
  }));
};
