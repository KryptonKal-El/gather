/**
 * Supabase Edge Function proxy for Spoonacular recipe search.
 * Keeps API key server-side and provides search + detail endpoints.
 */

interface RecipeSearchResult {
  id: number;
  title: string;
  image: string;
  readyInMinutes: number;
  servings: number;
}

interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  original: string;
}

interface InstructionStep {
  number: number;
  step: string;
}

interface RecipeDetail {
  id: number;
  title: string;
  image: string;
  readyInMinutes: number;
  servings: number;
  sourceUrl: string;
  extendedIngredients: Ingredient[];
  analyzedInstructions: { steps: InstructionStep[] }[];
}

const ALLOWED_ORIGINS = [
  'https://gatherlists.com',
  'https://gatherapp.vercel.app',
  'http://localhost:5173',
  'http://localhost:4000',
  'capacitor://localhost',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

async function searchRecipes(query: string, number: string): Promise<RecipeSearchResult[]> {
  const apiKey = Deno.env.get('SPOONACULAR_API_KEY');
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  const url = new URL('https://api.spoonacular.com/recipes/complexSearch');
  url.searchParams.set('query', query);
  url.searchParams.set('number', number);
  url.searchParams.set('addRecipeInformation', 'true');
  url.searchParams.set('fillIngredients', 'true');
  url.searchParams.set('apiKey', apiKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    console.error(`Spoonacular API error: ${response.status} ${text}`);
    throw new Error('UPSTREAM_ERROR');
  }

  const data = await response.json();
  const results = data.results ?? [];

  return results.map((recipe: {
    id?: number;
    title?: string;
    image?: string;
    readyInMinutes?: number;
    servings?: number;
  }) => ({
    id: recipe.id ?? 0,
    title: recipe.title ?? '',
    image: recipe.image ?? '',
    readyInMinutes: recipe.readyInMinutes ?? 0,
    servings: recipe.servings ?? 0,
  }));
}

async function getRecipeDetail(recipeId: string): Promise<RecipeDetail> {
  const apiKey = Deno.env.get('SPOONACULAR_API_KEY');
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  const url = new URL(`https://api.spoonacular.com/recipes/${recipeId}/information`);
  url.searchParams.set('apiKey', apiKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    console.error(`Spoonacular API error: ${response.status} ${text}`);
    throw new Error('UPSTREAM_ERROR');
  }

  const recipe = await response.json();

  const extendedIngredients = (recipe.extendedIngredients ?? []).map((ing: {
    name?: string;
    amount?: number;
    unit?: string;
    original?: string;
  }) => ({
    name: ing.name ?? '',
    amount: ing.amount ?? 0,
    unit: ing.unit ?? '',
    original: ing.original ?? '',
  }));

  const analyzedInstructions = (recipe.analyzedInstructions ?? []).map((instruction: {
    steps?: { number?: number; step?: string }[];
  }) => ({
    steps: (instruction.steps ?? []).map((s) => ({
      number: s.number ?? 0,
      step: s.step ?? '',
    })),
  }));

  return {
    id: recipe.id ?? 0,
    title: recipe.title ?? '',
    image: recipe.image ?? '',
    readyInMinutes: recipe.readyInMinutes ?? 0,
    servings: recipe.servings ?? 0,
    sourceUrl: recipe.sourceUrl ?? '',
    extendedIngredients,
    analyzedInstructions,
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(req.url);
  const query = url.searchParams.get('q');
  const recipeId = url.searchParams.get('id');
  const number = url.searchParams.get('number') ?? '10';

  if (!query && !recipeId) {
    return new Response(
      JSON.stringify({ error: 'Missing required parameter: q or id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    if (recipeId) {
      const detail = await getRecipeDetail(recipeId);
      return new Response(JSON.stringify(detail), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = await searchRecipes(query!, number);
    return new Response(JSON.stringify({ results, source: 'spoonacular' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error('Spoonacular API request timed out');
      return new Response(
        JSON.stringify({ error: 'Request timed out' }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (err instanceof Error) {
      if (err.message === 'API_KEY_MISSING') {
        return new Response(
          JSON.stringify({ error: 'Recipe search not configured' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (err.message === 'UPSTREAM_ERROR') {
        return new Response(
          JSON.stringify({ error: 'Upstream API error' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.error('Recipe search error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
