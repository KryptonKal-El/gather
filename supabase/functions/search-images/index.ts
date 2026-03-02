/**
 * Supabase Edge Function proxy for SerpAPI Google Images search.
 * Migrated from Firebase Cloud Function.
 */

const ALLOWED_ORIGINS = [
  'https://shoppinglistai.vercel.app',
  'http://localhost:4000',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight requests
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
  const count = parseInt(url.searchParams.get('num') ?? '8', 10);

  if (!query) {
    return new Response(
      JSON.stringify({ error: 'Missing required parameter: q' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const apiKey = Deno.env.get('SERPAPI_KEY') ?? '';
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'SerpAPI key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const params = new URLSearchParams({
    engine: 'google_images',
    q: query,
    api_key: apiKey,
    num: String(count),
    safe: 'active',
  });

  try {
    const response = await fetch(`https://serpapi.com/search.json?${params}`);

    if (!response.ok) {
      const text = await response.text();
      console.error(`SerpAPI error: ${response.status} ${text}`);
      return new Response(
        JSON.stringify({ error: 'SerpAPI request failed' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const results = (data.images_results ?? []).slice(0, count).map((img: { original: string; thumbnail: string; title?: string }) => ({
      url: img.original,
      thumbnail: img.thumbnail,
      title: img.title ?? '',
    }));

    return new Response(
      JSON.stringify({ results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Image search proxy error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
