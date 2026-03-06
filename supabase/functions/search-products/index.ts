/**
 * Supabase Edge Function proxy for product search with fallback chain.
 * Primary: Walmart Affiliate API (RSA-SHA256 signed)
 * Secondary: Open Food Facts API
 * Tertiary: SerpAPI Google Images
 */

interface ProductResult {
  url: string;
  thumbnail: string;
  title: string;
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

function pemToDer(pem: string): Uint8Array {
  const lines = pem.split('\n');
  const base64 = lines
    .filter(line => !line.startsWith('-----'))
    .join('');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function generateWalmartSignature(
  consumerId: string,
  privateKeyPem: string,
  keyVersion: string,
  timestamp: string
): Promise<string> {
  const stringToSign = `${consumerId}\n${timestamp}\n${keyVersion}\n`;
  
  const derBytes = pemToDer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    derBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(stringToSign)
  );
  
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function searchWalmart(query: string, numItems: string): Promise<ProductResult[]> {
  const consumerId = Deno.env.get('WALMART_CONSUMER_ID') ?? '';
  const privateKey = Deno.env.get('WALMART_PRIVATE_KEY') ?? '';
  const keyVersion = Deno.env.get('WALMART_KEY_VERSION') ?? '';

  if (!consumerId || !privateKey || !keyVersion) {
    console.error('Missing Walmart API credentials');
    return [];
  }

  const timestamp = Date.now().toString();

  try {
    const signature = await generateWalmartSignature(consumerId, privateKey, keyVersion, timestamp);

    const walmartUrl = new URL('https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search');
    walmartUrl.searchParams.set('query', query);
    walmartUrl.searchParams.set('numItems', numItems);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(walmartUrl.toString(), {
      method: 'GET',
      headers: {
        'WM_CONSUMER.ID': consumerId,
        'WM_SEC.KEY_VERSION': keyVersion,
        'WM_SEC.AUTH_SIGNATURE': signature,
        'WM_CONSUMER.INTIMESTAMP': timestamp,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      console.error(`Walmart API error: ${response.status} ${text}`);
      return [];
    }

    const data = await response.json();
    const items = data.items ?? [];
    return items.map((item: { largeImage?: string; thumbnailImage?: string; name?: string }) => ({
      url: item.largeImage ?? '',
      thumbnail: item.thumbnailImage ?? '',
      title: item.name ?? '',
    }));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error('Walmart API request timed out');
    } else {
      console.error('Walmart search error:', err);
    }
    return [];
  }
}

async function searchOpenFoodFacts(query: string, numItems: string): Promise<ProductResult[]> {
  try {
    const offUrl = new URL('https://world.openfoodfacts.org/cgi/search.pl');
    offUrl.searchParams.set('search_terms', query);
    offUrl.searchParams.set('search_simple', '1');
    offUrl.searchParams.set('action', 'process');
    offUrl.searchParams.set('json', '1');
    offUrl.searchParams.set('page_size', numItems);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(offUrl.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Open Food Facts API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const products = data.products ?? [];

    return products
      .filter((product: { image_url?: string }) => product.image_url)
      .map((product: { image_url?: string; image_small_url?: string; product_name?: string }) => ({
        url: product.image_url ?? '',
        thumbnail: product.image_small_url ?? product.image_url ?? '',
        title: product.product_name ?? '',
      }));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error('Open Food Facts API request timed out');
    } else {
      console.error('Open Food Facts search error:', err);
    }
    return [];
  }
}

async function searchSerpApi(query: string, numItems: string): Promise<ProductResult[]> {
  const apiKey = Deno.env.get('SERPAPI_KEY') ?? '';

  if (!apiKey) {
    console.error('Missing SERPAPI_KEY');
    return [];
  }

  try {
    const params = new URLSearchParams({
      engine: 'google_images',
      q: query,
      api_key: apiKey,
      num: numItems,
      safe: 'active',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`https://serpapi.com/search.json?${params}`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`SerpAPI error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const images = data.images_results ?? [];

    return images.slice(0, parseInt(numItems, 10)).map((img: { original?: string; thumbnail?: string; title?: string }) => ({
      url: img.original ?? '',
      thumbnail: img.thumbnail ?? '',
      title: img.title ?? '',
    }));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error('SerpAPI request timed out');
    } else {
      console.error('SerpAPI search error:', err);
    }
    return [];
  }
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
  const numItems = url.searchParams.get('num') ?? '8';

  if (!query) {
    return new Response(
      JSON.stringify({ error: 'Missing required parameter: q' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const respond = (body: { results: ProductResult[]; source: string }) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const walmartResults = await searchWalmart(query, numItems);
  if (walmartResults.length > 0) {
    return respond({ results: walmartResults, source: 'walmart' });
  }

  const offResults = await searchOpenFoodFacts(query, numItems);
  if (offResults.length > 0) {
    return respond({ results: offResults, source: 'openfoodfacts' });
  }

  const serpResults = await searchSerpApi(query, numItems);
  if (serpResults.length > 0) {
    return respond({ results: serpResults, source: 'serpapi' });
  }

  return respond({ results: [], source: 'none' });
});
