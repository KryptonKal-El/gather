const { onRequest } = require('firebase-functions/v2/https');

/**
 * Cloud Function proxy for SerpAPI Google Images search.
 * Avoids CORS issues by making the API call server-side.
 * The SERPAPI_KEY is loaded from functions/.env (deployed with the function).
 */
exports.searchImages = onRequest(
  { cors: true, invoker: 'public' },
  async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const query = req.query.q;
    const count = parseInt(req.query.num, 10) || 8;

    if (!query) {
      res.status(400).json({ error: 'Missing required parameter: q' });
      return;
    }

    const apiKey = process.env.SERPAPI_KEY ?? '';
    if (!apiKey) {
      res.status(500).json({ error: 'SerpAPI key not configured' });
      return;
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
        res.status(response.status).json({ error: 'SerpAPI request failed' });
        return;
      }

      const data = await response.json();
      const results = (data.images_results ?? []).slice(0, count).map((img) => ({
        url: img.original,
        thumbnail: img.thumbnail,
        title: img.title ?? '',
      }));

      res.json({ results });
    } catch (err) {
      console.error('Image search proxy error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);
