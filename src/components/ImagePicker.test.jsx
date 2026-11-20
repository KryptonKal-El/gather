import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { searchImageSource, ImageSearchLimitError } from '../services/imageSearch.js';
import { ImagePicker } from './ImagePicker.jsx';

vi.mock('../services/imageSearch.js', async (importOriginal) => ({
  ...(await importOriginal()),
  searchImageSource: vi.fn(),
}));

const milkResult = {
  url: 'https://example.com/milk.jpg',
  thumbnail: 'https://example.com/milk-thumb.jpg',
  title: 'Milk carton',
};

const defaultProps = {
  itemName: 'Milk',
  currentImageUrl: null,
  onSelectUrl: vi.fn(),
  onUpload: vi.fn(),
  onRemove: vi.fn(),
  onClose: vi.fn(),
  isUploading: false,
  uploadError: null,
  imageSearchSettings: { walmart: true, spoonacular: false, openfoodfacts: false, serpapi: false },
  onNavigateToSettings: vi.fn(),
};

const renderImagePicker = (props = {}) => render(<ImagePicker {...defaultProps} {...props} />);

describe('ImagePicker image search sources', () => {
  beforeEach(() => {
    searchImageSource.mockReset();
    searchImageSource.mockResolvedValue([]);
    defaultProps.onSelectUrl.mockClear();
    defaultProps.onUpload.mockClear();
    defaultProps.onRemove.mockClear();
    defaultProps.onClose.mockClear();
    defaultProps.onNavigateToSettings.mockClear();
  });

  it('shows an empty state when all image search sources are off', () => {
    renderImagePicker({
      imageSearchSettings: { walmart: false, spoonacular: false, openfoodfacts: false, serpapi: false },
    });

    expect(screen.getByText('Image search is turned off for all sources.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open image search settings/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /image search query/i })).not.toBeInTheDocument();
    expect(searchImageSource).not.toHaveBeenCalled();
  });

  it('opens settings from the all-sources-off empty state', async () => {
    const user = userEvent.setup();
    const onNavigateToSettings = vi.fn();
    renderImagePicker({
      imageSearchSettings: { walmart: false, spoonacular: false, openfoodfacts: false, serpapi: false },
      onNavigateToSettings,
    });

    await user.click(screen.getByRole('button', { name: /open image search settings/i }));

    expect(onNavigateToSettings).toHaveBeenCalledTimes(1);
  });

  it('searches every source when settings are null', async () => {
    renderImagePicker({ imageSearchSettings: null });

    expect(screen.getByRole('textbox', { name: /image search query/i })).toHaveDisplayValue('Milk');
    await waitFor(() => {
      expect(searchImageSource.mock.calls.map(([query, source]) => [query, source])).toEqual([
        ['Milk', 'walmart'],
        ['Milk', 'spoonacular'],
        ['Milk', 'openfoodfacts'],
        ['Milk', 'serpapi'],
      ]);
    });
    expect(await screen.findByRole('button', { name: /^search$/i })).toBeInTheDocument();
  });

  it('renders a source section and selects an image', async () => {
    const user = userEvent.setup();
    const onSelectUrl = vi.fn();
    searchImageSource.mockResolvedValueOnce([milkResult]);
    renderImagePicker({ onSelectUrl });

    expect(await screen.findByRole('heading', { name: 'Walmart' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Milk carton' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Milk carton' }));

    expect(onSelectUrl).toHaveBeenCalledWith('https://example.com/milk.jpg');
  });

  it('shows every enabled section immediately and fills each in independently', async () => {
    let resolveGoogle;
    searchImageSource.mockImplementation((_query, source) => (
      source === 'serpapi'
        ? new Promise((resolve) => { resolveGoogle = resolve; })
        : Promise.resolve([milkResult])
    ));
    renderImagePicker({
      imageSearchSettings: { walmart: true, spoonacular: false, openfoodfacts: false, serpapi: true },
    });

    expect(screen.getByRole('heading', { name: 'Walmart' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Google Images' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Spoonacular' })).not.toBeInTheDocument();

    expect(await screen.findByRole('img', { name: 'Milk carton' })).toBeInTheDocument();
    expect(screen.getByText('Searching Google Images...')).toBeInTheDocument();

    resolveGoogle([{ ...milkResult, url: 'https://example.com/g.jpg', title: 'Google milk' }]);

    expect(await screen.findByRole('img', { name: 'Google milk' })).toBeInTheDocument();
    expect(screen.queryByText('Searching Google Images...')).not.toBeInTheDocument();
  });

  it('collapses and expands a source section from its header', async () => {
    const user = userEvent.setup();
    searchImageSource.mockResolvedValue([milkResult]);
    renderImagePicker();

    const header = await screen.findByRole('button', { name: /walmart/i });
    expect(await screen.findByRole('img', { name: 'Milk carton' })).toBeInTheDocument();
    expect(header).toHaveAttribute('aria-expanded', 'true');

    await user.click(header);

    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('img', { name: 'Milk carton' })).not.toBeInTheDocument();

    await user.click(header);

    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('img', { name: 'Milk carton' })).toBeInTheDocument();
  });

  it('shows "No results" for a source that returns nothing', async () => {
    renderImagePicker();

    expect(await screen.findByText('No results')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Walmart' })).toBeInTheDocument();
  });

  it('shows the Pro notice, without a retry, for a source over the free limit', async () => {
    searchImageSource.mockImplementation(async (_query, source) => {
      if (source === 'serpapi') throw new ImageSearchLimitError(source);
      return [milkResult];
    });

    renderImagePicker({ imageSearchSettings: { walmart: true, spoonacular: false, openfoodfacts: false, serpapi: true } });

    expect(await screen.findByText('Monthly limit reached')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry Google Images' })).not.toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Milk carton' })).toBeInTheDocument();
  });

  it('shows an error with retry for a failed source and reloads only that source', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    searchImageSource.mockImplementation((_query, source) => (
      source === 'serpapi' ? Promise.reject(new Error('timed out')) : Promise.resolve([milkResult])
    ));
    renderImagePicker({
      imageSearchSettings: { walmart: true, spoonacular: false, openfoodfacts: false, serpapi: true },
    });

    expect(await screen.findByText("Couldn't load Google Images results.")).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Milk carton' })).toBeInTheDocument();

    searchImageSource.mockClear();
    searchImageSource.mockResolvedValue([{ ...milkResult, url: 'https://example.com/g.jpg', title: 'Google milk' }]);
    await user.click(screen.getByRole('button', { name: 'Retry Google Images' }));

    expect(await screen.findByRole('img', { name: 'Google milk' })).toBeInTheDocument();
    expect(searchImageSource).toHaveBeenCalledTimes(1);
    expect(searchImageSource).toHaveBeenCalledWith('Milk', 'serpapi');
  });
});
