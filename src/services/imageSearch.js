/**
 * Unsplash image search service.
 * Uses the Unsplash API to find photos by keyword.
 * Requires VITE_UNSPLASH_ACCESS_KEY environment variable.
 *
 * Per Unsplash guidelines, returned image URLs must be hotlinked directly
 * (not downloaded and re-hosted), and photographer attribution should be shown.
 */

const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY ?? '';
const BASE_URL = 'https://api.unsplash.com/search/photos';

/**
 * Searches Unsplash for photos matching the query.
 * @param {string} query - The search term
 * @param {number} [count=8] - Number of results to return (max 30)
 * @returns {Promise<Array<{ url: string, thumbnail: string, title: string, photographer: string, profileUrl: string }>>}
 */
export const searchImages = async (query, count = 8) => {
  if (!ACCESS_KEY) {
    console.warn('Image search unavailable: missing VITE_UNSPLASH_ACCESS_KEY');
    return [];
  }

  const params = new URLSearchParams({
    query,
    per_page: String(Math.min(count, 30)),
    content_filter: 'high',
  });

  const res = await fetch(`${BASE_URL}?${params}`, {
    headers: {
      Authorization: `Client-ID ${ACCESS_KEY}`,
    },
  });

  if (!res.ok) {
    console.error(`Image search failed: ${res.status} ${res.statusText}`);
    return [];
  }

  const data = await res.json();
  const results = data.results ?? [];

  return results.map((photo) => ({
    url: photo.urls?.small ?? photo.urls?.regular,
    thumbnail: photo.urls?.thumb ?? photo.urls?.small,
    title: photo.alt_description ?? photo.description ?? '',
    photographer: photo.user?.name ?? '',
    profileUrl: photo.user?.links?.html ?? '',
  }));
};
