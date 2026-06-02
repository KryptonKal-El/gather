import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStore,
  saveUserStoreDefaultOrder,
  subscribeStores,
  updateImageSearchSettings,
} from './database.js';
import { supabase } from './supabase.js';

vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

const makeRealtimeChannel = () => {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  };
  return channel;
};

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

describe('store database operations', () => {
  beforeEach(() => {
    supabase.from.mockReset();
    supabase.channel.mockReset();
    supabase.removeChannel.mockReset();
  });

  it('fetches stores by list ID when subscribing to stores', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqMock = vi.fn(() => ({ order: orderMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    supabase.from.mockReturnValue({ select: selectMock });
    supabase.channel.mockReturnValue(makeRealtimeChannel());

    subscribeStores('list-1', vi.fn());

    await waitFor(() => {
      expect(eqMock).toHaveBeenCalledWith('list_id', 'list-1');
    });
  });

  it('includes the list ID when creating a store', async () => {
    const singleMock = vi.fn().mockResolvedValue({ data: { id: 'store-1' }, error: null });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));
    supabase.from.mockReturnValue({ insert: insertMock });

    const result = await createStore('user-1', 'list-1', {
      name: 'Costco',
      color: '#B5E8C8',
      sortOrder: 2,
    });

    expect(result).toBe('store-1');
    expect(insertMock).toHaveBeenCalledWith({
      list_id: 'list-1',
      name: 'Costco',
      color: '#B5E8C8',
      sort_order: 2,
    });
  });

  it('saves order only for persisted user store defaults with UUID IDs', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ upsert: upsertMock });

    await saveUserStoreDefaultOrder([
      { id: 'temp-1', name: 'Draft', listType: 'grocery' },
      { id: 'not-a-uuid', name: 'Legacy', listType: 'grocery' },
      { id: '123e4567-e89b-12d3-a456-426614174000', name: 'Saved', listType: 'grocery' },
    ]);

    expect(upsertMock).toHaveBeenCalledWith(
      [{ id: '123e4567-e89b-12d3-a456-426614174000', sort_order: 0 }],
      { onConflict: 'id' },
    );
  });

  it('skips Supabase writes when user store default order has no persisted UUID IDs', async () => {
    await saveUserStoreDefaultOrder([
      { id: 'temp-1', name: 'Draft', listType: 'grocery' },
      { id: 'not-a-uuid', name: 'Legacy', listType: 'grocery' },
    ]);

    expect(supabase.from).not.toHaveBeenCalled();
  });
});
