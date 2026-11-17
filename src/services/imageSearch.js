/**
 * Image search service.
 * Calls the Supabase Edge Function proxy once per source so each source's
 * results can load, fail, and be retried independently.
 */

const CACHE_TTL = 5 * 60 * 1000;
const searchCache = new Map();

/** Image search sources in display order. */
export const IMAGE_SOURCES = [
  { key: 'walmart', label: 'Walmart' },
  { key: 'spoonacular', label: 'Spoonacular' },
  { key: 'openfoodfacts', label: 'Open Food Facts' },
  { key: 'serpapi', label: 'Google Images' },
];

/**
 * Lists the sources a user has enabled, in display order.
 * @param {Object|null} [enabledSources] - Map of source key to enabled flag; null/undefined enables all
 * @returns {Array<{ key: string, label: string }>}
 */
export const getEnabledImageSources = (enabledSources) => (
  enabledSources ? IMAGE_SOURCES.filter(({ key }) => enabledSources[key]) : IMAGE_SOURCES
);

/**
 * Searches a single source for product images matching the query.
 * Successful results (including empty ones) are cached client-side for 5 minutes;
 * failures are never cached.
 * @param {string} query - The search term
 * @param {string} source - Source key from IMAGE_SOURCES
 * @param {number} [count=25] - Number of results to return
 * @returns {Promise<Array<{ url: string, thumbnail: string, title: string }>>}
 * @throws {Error} When the request fails or the source errored or timed out
 */
export const searchImageSource = async (query, source, count = 25) => {
  const cacheKey = `${source}:${query.trim().toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.results;
  }

  const baseUrl = import.meta.env.VITE_SUPABASE_EDGE_FUNCTION_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    throw new Error('Image search is not configured: missing Supabase edge function URL or anon key');
  }

  const params = new URLSearchParams({ q: query, num: String(count), sources: source });

  let res;
  try {
    res = await fetch(`${baseUrl}/search-products?${params}`, {
      headers: { 'Authorization': `Bearer ${anonKey}` },
    });
  } catch (err) {
    throw new Error(`Image search request for ${source} failed`, { cause: err });
  }

  if (!res.ok) {
    throw new Error(`Image search for ${source} failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (Array.isArray(data.failed) && data.failed.includes(source)) {
    throw new Error(`Image search source ${source} errored or timed out`);
  }

  const groups = Array.isArray(data.groups) ? data.groups : [];
  const results = groups.find((group) => group.source === source)?.results ?? [];
  searchCache.set(cacheKey, { results, timestamp: Date.now() });
  return results;
};
