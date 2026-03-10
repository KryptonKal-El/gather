/**
 * Recipe search service.
 * Calls the Supabase Edge Function proxy which searches Spoonacular for recipes.
 */

/**
 * Searches for recipes matching the query.
 * Uses the Supabase Edge Function endpoint.
 * @param {string} query - The search term
 * @param {number} [number=10] - Number of results to return
 * @returns {Promise<{ results: Array, source: string }>}
 */
export const searchRecipes = async (query, number = 10) => {
  const baseUrl = import.meta.env.VITE_SUPABASE_EDGE_FUNCTION_URL;
  if (!baseUrl) {
    console.error('Recipe search failed: VITE_SUPABASE_EDGE_FUNCTION_URL not configured');
    return { results: [], source: 'error' };
  }

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.error('Recipe search failed: VITE_SUPABASE_ANON_KEY not configured');
    return { results: [], source: 'error' };
  }

  const params = new URLSearchParams({
    q: query,
    number: String(number),
  });

  try {
    const res = await fetch(`${baseUrl}/search-recipes?${params}`, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
      },
    });

    if (!res.ok) {
      console.error(`Recipe search failed: ${res.status} ${res.statusText}`);
      return { results: [], source: 'error' };
    }

    const data = await res.json();
    return {
      results: data.results ?? [],
      source: data.source ?? 'unknown',
    };
  } catch (err) {
    console.error('Recipe search error:', err);
    return { results: [], source: 'error' };
  }
};

/**
 * Fetches detailed recipe information by ID.
 * Uses the Supabase Edge Function endpoint.
 * @param {string|number} recipeId - The recipe ID to fetch
 * @returns {Promise<Object|null>} The recipe detail object or null on failure
 */
export const getRecipeDetail = async (recipeId) => {
  const baseUrl = import.meta.env.VITE_SUPABASE_EDGE_FUNCTION_URL;
  if (!baseUrl) {
    console.error('Recipe detail fetch failed: VITE_SUPABASE_EDGE_FUNCTION_URL not configured');
    return null;
  }

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.error('Recipe detail fetch failed: VITE_SUPABASE_ANON_KEY not configured');
    return null;
  }

  const params = new URLSearchParams({
    id: String(recipeId),
  });

  try {
    const res = await fetch(`${baseUrl}/search-recipes?${params}`, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
      },
    });

    if (!res.ok) {
      console.error(`Recipe detail fetch failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    return data ?? null;
  } catch (err) {
    console.error('Recipe detail fetch error:', err);
    return null;
  }
};
