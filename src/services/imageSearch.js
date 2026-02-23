/**
 * Google Custom Search image search service.
 * Uses the Google Custom Search JSON API to find images by query.
 * Requires VITE_GOOGLE_CSE_API_KEY and VITE_GOOGLE_CSE_ID environment variables.
 */

const API_KEY = import.meta.env.VITE_GOOGLE_CSE_API_KEY ?? '';
const CSE_ID = import.meta.env.VITE_GOOGLE_CSE_ID ?? '';
const BASE_URL = 'https://www.googleapis.com/customsearch/v1';

/**
 * Searches Google Custom Search for images matching the query.
 * @param {string} query - The search term
 * @param {number} [count=8] - Number of results to return (max 10)
 * @returns {Promise<Array<{ url: string, thumbnail: string, title: string }>>}
 */
export const searchImages = async (query, count = 8) => {
  if (!API_KEY || !CSE_ID) {
    console.warn('Image search unavailable: missing VITE_GOOGLE_CSE_API_KEY or VITE_GOOGLE_CSE_ID');
    return [];
  }

  const params = new URLSearchParams({
    key: API_KEY,
    cx: CSE_ID,
    q: query,
    searchType: 'image',
    num: String(Math.min(count, 10)),
    safe: 'active',
    imgSize: 'medium',
  });

  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) {
    console.error(`Image search failed: ${res.status} ${res.statusText}`);
    return [];
  }

  const data = await res.json();
  const items = data.items ?? [];

  return items.map((item) => ({
    url: item.link,
    thumbnail: item.image?.thumbnailLink ?? item.link,
    title: item.title ?? '',
  }));
};
