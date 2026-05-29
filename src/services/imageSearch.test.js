import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { searchImages } from './imageSearch.js';

const groups = [
  {
    source: 'walmart',
    label: 'Walmart',
    results: [
      { url: 'https://example.com/milk.jpg', thumbnail: 'https://example.com/milk-thumb.jpg', title: 'Milk' },
    ],
  },
];

describe('searchImages', () => {
  let fetchMock;

  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_EDGE_FUNCTION_URL', 'https://edge.example.com');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ groups }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns grouped results for enabled sources', async () => {
    const result = await searchImages('milk', 25, {
      walmart: true,
      spoonacular: false,
      openfoodfacts: false,
      serpapi: true,
    });

    const requestUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(result).toEqual(groups);
    expect(requestUrl.pathname).toBe('/search-products');
    expect(requestUrl.searchParams.get('q')).toBe('milk');
    expect(requestUrl.searchParams.get('num')).toBe('25');
    expect(requestUrl.searchParams.get('sources')).toBe('serpapi,walmart');
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), {
      headers: { Authorization: 'Bearer anon-key' },
    });
  });

  it('returns an empty array without fetching when all sources are off', async () => {
    const result = await searchImages('milk', 25, {
      walmart: false,
      spoonacular: false,
      openfoodfacts: false,
      serpapi: false,
    });

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('defaults null enabled sources to all image sources', async () => {
    await searchImages('bread', 10, null);

    const requestUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestUrl.searchParams.get('sources')).toBe('openfoodfacts,serpapi,spoonacular,walmart');
  });

  it('returns cached results for the same query and sources', async () => {
    const settings = { walmart: true, spoonacular: false, openfoodfacts: false, serpapi: false };

    const firstResult = await searchImages('cached milk', 25, settings);
    const secondResult = await searchImages('  CACHED MILK  ', 25, settings);

    expect(firstResult).toEqual(groups);
    expect(secondResult).toEqual(groups);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when the edge function responds with an error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' });

    const result = await searchImages('edge failure', 25, { walmart: true });

    expect(result).toEqual([]);
  });

  it('returns an empty array when fetch rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const result = await searchImages('network failure', 25, { walmart: true });

    expect(result).toEqual([]);
  });
});
