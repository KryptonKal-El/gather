/**
 * Supabase Edge Function proxy for product image search.
 * Queries the sources named in `sources` (Walmart, Spoonacular, Open Food Facts,
 * SerpAPI Google Images) in parallel. Clients normally send one source per request
 * so each section loads on its own.
 * Response: `groups` holds sources with results; `failed` lists sources that errored
 * or timed out, so clients can tell a failure from an empty result.
 */

import { logUsage } from '../_shared/usageLog.ts';

interface ProductResult {
  url: string;
  thumbnail: string;
  title: string;
}

type SourceKey = 'walmart' | 'spoonacular' | 'openfoodfacts' | 'serpapi';

const SOURCE_ORDER: SourceKey[] = ['walmart', 'spoonacular', 'openfoodfacts', 'serpapi'];

const SOURCE_LABELS: Record<SourceKey, string> = {
  walmart: 'Walmart',
  spoonacular: 'Spoonacular',
  openfoodfacts: 'Open Food Facts',
  serpapi: 'Google Images',
};

const SERPAPI_TIMEOUT_MS = 12000;

interface ResultGroup {
  source: SourceKey;
  label: string;
  results: ProductResult[];
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

let cachedWalmartKey: CryptoKey | null = null;

async function getWalmartKey(privateKeyPem: string): Promise<CryptoKey> {
  if (cachedWalmartKey) return cachedWalmartKey;
  const derBytes = pemToDer(privateKeyPem);
  cachedWalmartKey = await crypto.subtle.importKey(
    'pkcs8',
    derBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return cachedWalmartKey;
}

async function generateWalmartSignature(
  consumerId: string,
  privateKeyPem: string,
  keyVersion: string,
  timestamp: string
): Promise<string> {
  const stringToSign = `${consumerId}\n${timestamp}\n${keyVersion}\n`;
  
  const key = await getWalmartKey(privateKeyPem);
  
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

async function searchWalmart(query: string, numItems: string): Promise<ProductResult[] | null> {
  const consumerId = Deno.env.get('WALMART_CONSUMER_ID') ?? '';
  const privateKey = Deno.env.get('WALMART_PRIVATE_KEY') ?? '';
  const keyVersion = Deno.env.get('WALMART_KEY_VERSION') ?? '';

  if (!consumerId || !privateKey || !keyVersion) {
    console.error('Missing Walmart API credentials');
    return null;
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
      return null;
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
    return null;
  }
}

async function searchOpenFoodFacts(query: string, numItems: string): Promise<ProductResult[] | null> {
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
      return null;
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
    return null;
  }
}

/**
 * Spoonacular Grocery Product Search.
 * Images are served directly from Spoonacular's CDN (img.spoonacular.com) — no proxying/rehosting.
 * ToS (https://spoonacular.com/food-api/terms) key points:
 * - Client-side caching allowed up to 1 hour (we cache 5 min — compliant)
 * - Must credit original source for recipes; no specific product image attribution required
 * - Cannot scrape/store data beyond caching; images referenced by URL only
 * - Source field in response identifies Spoonacular's contribution ('spoonacular' or 'merged')
 */
async function searchSpoonacularProducts(query: string, numItems: string): Promise<ProductResult[] | null> {
  const apiKey = Deno.env.get('SPOONACULAR_API_KEY') ?? '';

  if (!apiKey) {
    console.error('Missing SPOONACULAR_API_KEY');
    return null;
  }

  try {
    const spoonacularUrl = new URL('https://api.spoonacular.com/food/products/search');
    spoonacularUrl.searchParams.set('query', query);
    spoonacularUrl.searchParams.set('number', numItems);
    spoonacularUrl.searchParams.set('apiKey', apiKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(spoonacularUrl.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Spoonacular API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const products = data.products ?? [];

    return products
      .filter((product: { imageType?: string }) => product.imageType)
      .map((product: { id: number; title?: string; imageType?: string }) => ({
        url: `https://img.spoonacular.com/products/${product.id}-636x393.${product.imageType}`,
        thumbnail: `https://img.spoonacular.com/products/${product.id}-312x231.${product.imageType}`,
        title: product.title ?? '',
      }));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error('Spoonacular API request timed out');
    } else {
      console.error('Spoonacular search error:', err);
    }
    return null;
  }
}

async function searchSerpApi(query: string, numItems: string): Promise<ProductResult[] | null> {
  const apiKey = Deno.env.get('SERPAPI_KEY') ?? '';

  if (!apiKey) {
    console.error('Missing SERPAPI_KEY');
    return null;
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
    const timeoutId = setTimeout(() => controller.abort(), SERPAPI_TIMEOUT_MS);

    const response = await fetch(`https://serpapi.com/search.json?${params}`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`SerpAPI error: ${response.status}`);
      return null;
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
    return null;
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
  const numItems = url.searchParams.get('num') ?? '25';

  if (!query) {
    return new Response(
      JSON.stringify({ error: 'Missing required parameter: q' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Parse sources param (comma-separated, filter to valid SourceKey values)
  const sourcesParam = url.searchParams.get('sources');
  const enabledSources: Set<SourceKey> = sourcesParam
    ? new Set(sourcesParam.split(',').map(s => s.trim()).filter((s): s is SourceKey => SOURCE_ORDER.includes(s as SourceKey)))
    : new Set(SOURCE_ORDER);

  const searchFns: Record<SourceKey, () => Promise<ProductResult[] | null>> = {
    walmart: () => searchWalmart(query, numItems),
    spoonacular: () => searchSpoonacularProducts(query, numItems),
    openfoodfacts: () => searchOpenFoodFacts(query, numItems),
    serpapi: () => searchSerpApi(query, numItems),
  };

  const requestedSources = SOURCE_ORDER.filter(key => enabledSources.has(key));
  const settled = await Promise.all(
    requestedSources.map(async key => ({ source: key, results: await searchFns[key]() }))
  );

  logUsage(req, 'search-products', settled.map(({ source, results }) => ({
    source,
    operation: 'product_search',
    ok: results !== null,
  })));

  const groups: ResultGroup[] = settled
    .filter(({ results }) => results !== null && results.length > 0)
    .map(({ source, results }) => ({ source, label: SOURCE_LABELS[source], results: results ?? [] }));
  const failed: SourceKey[] = settled
    .filter(({ results }) => results === null)
    .map(({ source }) => source);

  // A response with a failed source must not be cached, or retries keep replaying the gap.
  const cacheControl = failed.length > 0 ? 'no-store' : 'public, max-age=3600';

  return new Response(JSON.stringify({ groups, failed }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': cacheControl },
  });
});
