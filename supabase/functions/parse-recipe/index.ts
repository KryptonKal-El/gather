/**
 * Supabase Edge Function: parse freeform recipe text into structured data.
 *
 * Takes a blob of pasted recipe text and uses Claude (Haiku 4.5) to extract a
 * title, a list of ingredients (each split into quantity + name), and ordered
 * steps. This handles the messy real-world formats that line-by-line parsing
 * can't: multi-line ingredients, "For the sauce:" headers, inline quantities,
 * numbered or paragraph steps, etc.
 *
 * The ANTHROPIC_API_KEY is a server-side secret and is never exposed to clients.
 * If it is unset, the function returns 503 so the client can fall back to its
 * local line parser.
 */

const ALLOWED_ORIGINS = [
  'https://gatherlists.com',
  'https://gatherapp.vercel.app',
  'http://localhost:5173',
  'http://localhost:4000',
  'capacitor://localhost',
];

const ANTHROPIC_MODEL = 'claude-haiku-4-5';
const MAX_INPUT_CHARS = 12000;

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(status: number, body: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

const SYSTEM_PROMPT = `You parse pasted recipe text into structured data. You will be given raw, possibly messy text copied from a website, note, or message.

Extract:
- name: the recipe's title. Use an empty string if the text has no clear title.
- ingredients: every ingredient, in order. Split each into:
    - quantity: the amount and unit exactly as written (e.g. "2 cups", "1 lb", "3 cloves", "½ tsp"). Empty string if no amount is given.
    - name: the ingredient itself without the quantity (e.g. "all-purpose flour", "ground beef, minced").
- steps: the ordered instructions, one entry per step. Strip leading numbers/bullets. Combine wrapped lines that belong to the same step.

Rules:
- Only use information present in the text. Never invent ingredients, steps, or amounts.
- Drop section headers like "Ingredients", "Directions", "For the sauce:" from the lists, but if a header gives important context (e.g. "For the topping"), you may prefix the relevant ingredient names with it in parentheses.
- Preserve the original order.
- Call the save_recipe tool exactly once with the result.`;

const RECIPE_TOOL = {
  name: 'save_recipe',
  description: 'Return the structured recipe parsed from the text.',
  input_schema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: "The recipe title, or an empty string if none is present.",
      },
      ingredients: {
        type: 'array',
        description: 'The ingredients in order.',
        items: {
          type: 'object',
          properties: {
            quantity: {
              type: 'string',
              description: "Amount and unit as written, e.g. '2 cups'. Empty string if none.",
            },
            name: {
              type: 'string',
              description: 'The ingredient name without the quantity.',
            },
          },
          required: ['quantity', 'name'],
        },
      },
      steps: {
        type: 'array',
        description: 'The ordered instruction steps.',
        items: { type: 'string' },
      },
    },
    required: ['name', 'ingredients', 'steps'],
  },
};

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' }, cors);
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    // Signal the client to use its local fallback parser.
    return json(503, { error: 'parser_unavailable' }, cors);
  }

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' }, cors);
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return json(400, { error: 'empty_text' }, cors);
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [RECIPE_TOOL],
        tool_choice: { type: 'tool', name: 'save_recipe' },
        messages: [{ role: 'user', content: text.slice(0, MAX_INPUT_CHARS) }],
      }),
    });

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      console.error('Anthropic API error:', anthropicRes.status, detail);
      return json(502, { error: 'parse_failed' }, cors);
    }

    const data = await anthropicRes.json();
    const toolUse = Array.isArray(data?.content)
      ? data.content.find((b: { type?: string }) => b.type === 'tool_use')
      : null;

    if (!toolUse?.input) {
      console.error('No tool_use block in Anthropic response');
      return json(502, { error: 'no_parse' }, cors);
    }

    const result = toolUse.input as {
      name?: string;
      ingredients?: Array<{ quantity?: string; name?: string }>;
      steps?: string[];
    };

    return json(200, {
      name: typeof result.name === 'string' ? result.name : '',
      ingredients: Array.isArray(result.ingredients)
        ? result.ingredients
            .map((ing) => ({
              quantity: typeof ing?.quantity === 'string' ? ing.quantity : '',
              name: typeof ing?.name === 'string' ? ing.name : '',
            }))
            .filter((ing) => ing.name.trim())
        : [],
      steps: Array.isArray(result.steps)
        ? result.steps.filter((s) => typeof s === 'string' && s.trim())
        : [],
    }, cors);
  } catch (err) {
    console.error('parse-recipe failed:', err);
    return json(502, { error: 'parse_failed' }, cors);
  }
});
