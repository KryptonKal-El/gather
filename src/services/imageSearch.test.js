import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getEnabledImageSources, searchImageSource } from './imageSearch.js';

const milkResults = [
  { url: 'https://example.com/milk.jpg', thumbnail: 'https://example.com/milk-thumb.jpg', title: 'Milk' },
];

const okResponse = (body) => ({ ok: true, json: vi.fn().mockResolvedValue(body) });

describe('getEnabledImageSources', () => {
  it('returns enabled sources in display order', () => {
    const sources = getEnabledImageSources({ walmart: true, spoonacular: false, openfoodfacts: false, serpapi: true });

    expect(sources.map(({ key }) => key)).toEqual(['walmart', 'serpapi']);
    expect(sources.map(({ label }) => label)).toEqual(['Walmart', 'Google Images']);
  });

  it('defaults null settings to all sources', () => {
    expect(getEnabledImageSources(null).map(({ key }) => key)).toEqual([
      'walmart', 'spoonacular', 'openfoodfacts', 'serpapi',
    ]);
  });

  it('returns no sources when all are off', () => {
    expect(getEnabledImageSources({ walmart: false, spoonacular: false, openfoodfacts: false, serpapi: false })).toEqual([]);
  });
});

describe('searchImageSource', () => {
  let fetchMock;

  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_EDGE_FUNCTION_URL', 'https://edge.example.com');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    fetchMock = vi.fn().mockResolvedValue(okResponse({
      groups: [{ source: 'walmart', label: 'Walmart', results: milkResults }],
      failed: [],
    }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests a single source and returns its results', async () => {
    const result = await searchImageSource('milk', 'walmart', 25);

    const requestUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(result).toEqual(milkResults);
    expect(requestUrl.pathname).toBe('/search-products');
    expect(requestUrl.searchParams.get('q')).toBe('milk');
    expect(requestUrl.searchParams.get('num')).toBe('25');
    expect(requestUrl.searchParams.get('sources')).toBe('walmart');
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), {
      headers: { Authorization: 'Bearer anon-key' },
    });
  });

  it('returns an empty array when the source has no results', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ groups: [], failed: [] }));

    expect(await searchImageSource('nothing here', 'serpapi')).toEqual([]);
  });

  it('caches successful results per source and query', async () => {
    const first = await searchImageSource('cached milk', 'walmart');
    const second = await searchImageSource('  CACHED MILK  ', 'walmart');

    expect(first).toEqual(milkResults);
    expect(second).toEqual(milkResults);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws and does not cache when the source is reported as failed', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ groups: [], failed: ['serpapi'] }));

    await expect(searchImageSource('slow query', 'serpapi')).rejects.toThrow(/serpapi/);

    fetchMock.mockResolvedValueOnce(okResponse({
      groups: [{ source: 'serpapi', label: 'Google Images', results: milkResults }],
      failed: [],
    }));
    expect(await searchImageSource('slow query', 'serpapi')).toEqual(milkResults);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when the edge function responds with an error', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' });

    await expect(searchImageSource('edge failure', 'walmart')).rejects.toThrow(/500/);
  });

  it('throws with the original error as cause when fetch rejects', async () => {
    const networkError = new Error('network down');
    fetchMock.mockRejectedValueOnce(networkError);

    await expect(searchImageSource('network failure', 'walmart')).rejects.toMatchObject({ cause: networkError });
  });

  it('throws when the edge function URL is not configured', async () => {
    vi.stubEnv('VITE_SUPABASE_EDGE_FUNCTION_URL', '');

    await expect(searchImageSource('unconfigured', 'walmart')).rejects.toThrow(/not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
