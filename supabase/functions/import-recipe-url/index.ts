/**
 * Supabase Edge Function: import a recipe from a web page URL.
 *
 * Fetches the page server-side and extracts a schema.org/Recipe from its
 * JSON-LD (`<script type="application/ld+json">`), which the large majority of
 * recipe sites publish. Returns a normalized recipe the iOS client can drop
 * straight into the recipe form. Nothing is stored; this is a pure proxy/parser.
 */

interface ParsedRecipe {
  name: string;
  imageUrl: string;
  ingredients: string[];
  steps: string[];
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

/** Coerces schema.org values that may be a string, an object, or an array into a plain string. */
function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(' ').trim();
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text.trim();
    if (typeof obj.name === 'string') return obj.name.trim();
    if (typeof obj.url === 'string') return obj.url.trim();
  }
  return '';
}

/** Extracts the image URL from schema.org's image (string | {url} | array). */
function extractImage(image: unknown): string {
  if (typeof image === 'string') return image.trim();
  if (Array.isArray(image) && image.length > 0) return extractImage(image[0]);
  if (image && typeof image === 'object') {
    const url = (image as Record<string, unknown>).url;
    if (typeof url === 'string') return url.trim();
  }
  return '';
}

/**
 * Flattens schema.org recipeInstructions into ordered step strings. Handles a
 * plain string (split on newlines), an array of strings, HowToStep objects, and
 * HowToSection objects that nest their own itemListElement steps.
 */
function extractSteps(instructions: unknown): string[] {
  if (!instructions) return [];
  if (typeof instructions === 'string') {
    return instructions
      .split(/\r?\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(instructions)) {
    const steps: string[] = [];
    for (const entry of instructions) {
      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        const type = asText(obj['@type']);
        if (type === 'HowToSection' && obj.itemListElement) {
          steps.push(...extractSteps(obj.itemListElement));
          continue;
        }
      }
      const text = asText(entry);
      if (text) steps.push(text);
    }
    return steps;
  }
  return [];
}

/** Depth-first search for the first schema.org Recipe node in parsed JSON-LD. */
function findRecipeNode(node: unknown, depth = 0): Record<string, unknown> | null {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj['@type'];
  const isRecipe = type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
  if (isRecipe) return obj;
  if (obj['@graph']) return findRecipeNode(obj['@graph'], depth + 1);
  return null;
}

/** Pulls every JSON-LD block out of the HTML and returns the first Recipe found. */
function parseRecipeFromHtml(html: string): ParsedRecipe | null {
  // Quotes around the type are optional: Yoast and other common plugins emit
  // an unquoted `type=application/ld+json`.
  const scriptRegex = /<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      continue;
    }
    const recipe = findRecipeNode(json);
    if (!recipe) continue;

    const ingredients = Array.isArray(recipe.recipeIngredient)
      ? recipe.recipeIngredient.map(asText).filter(Boolean)
      : [];
    const steps = extractSteps(recipe.recipeInstructions);

    if (ingredients.length === 0 && steps.length === 0) continue;

    return {
      name: asText(recipe.name),
      imageUrl: extractImage(recipe.image),
      ingredients,
      steps,
    };
  }
  return null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  // Accept the target URL from a query param (GET) or a JSON body (POST).
  let target = '';
  if (req.method === 'GET') {
    target = new URL(req.url).searchParams.get('url') ?? '';
  } else if (req.method === 'POST') {
    try {
      const body = await req.json();
      target = typeof body?.url === 'string' ? body.url : '';
    } catch {
      target = '';
    }
  } else {
    return json({ error: 'Method not allowed' }, 405);
  }

  target = target.trim();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(target);
  } catch {
    return json({ error: 'INVALID_URL' }, 400);
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return json({ error: 'INVALID_URL' }, 400);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(parsedUrl.toString(), {
      method: 'GET',
      headers: {
        // Some sites serve minimal markup to unknown agents; present as a browser.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Fetch failed: ${response.status} for ${parsedUrl}`);
      return json({ error: 'FETCH_FAILED' }, 502);
    }

    const html = await response.text();
    const recipe = parseRecipeFromHtml(html);
    if (!recipe) {
      return json({ error: 'NO_RECIPE_FOUND' }, 422);
    }
    return json(recipe, 200);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      return json({ error: 'TIMEOUT' }, 504);
    }
    console.error('import-recipe-url error:', err);
    return json({ error: 'INTERNAL_ERROR' }, 500);
  }
});
