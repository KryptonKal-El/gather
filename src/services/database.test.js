import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateImageSearchSettings } from './database.js';
import { supabase } from './supabase.js';

vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('updateImageSearchSettings', () => {
  let updateMock;
  let eqMock;

  beforeEach(() => {
    updateMock = vi.fn(() => ({ eq: eqMock }));
    eqMock = vi.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ update: updateMock });
  });

  it('saves image search settings to the user profile', async () => {
    const settings = {
      walmart: true,
      spoonacular: false,
      openfoodfacts: true,
      serpapi: false,
    };

    const result = await updateImageSearchSettings('user-1', settings);

    expect(result).toEqual({ error: null });
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(updateMock).toHaveBeenCalledWith({ image_search_settings: settings });
    expect(eqMock).toHaveBeenCalledWith('id', 'user-1');
  });

  it('returns the Supabase error when saving fails', async () => {
    const error = { message: 'update failed' };
    eqMock.mockResolvedValueOnce({ error });

    const result = await updateImageSearchSettings('user-1', { walmart: false });

    expect(result).toEqual({ error });
  });

  it('passes null settings through to Supabase', async () => {
    await updateImageSearchSettings('user-1', null);

    expect(updateMock).toHaveBeenCalledWith({ image_search_settings: null });
    expect(eqMock).toHaveBeenCalledWith('id', 'user-1');
  });

  it('passes undefined user IDs through to the profile filter', async () => {
    await updateImageSearchSettings(undefined, { walmart: true });

    expect(eqMock).toHaveBeenCalledWith('id', undefined);
  });
});
