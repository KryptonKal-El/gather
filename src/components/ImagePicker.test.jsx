import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { searchImages } from '../services/imageSearch.js';
import { ImagePicker } from './ImagePicker.jsx';

vi.mock('../services/imageSearch.js', () => ({
  searchImages: vi.fn(),
}));

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
    searchImages.mockResolvedValue([]);
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
    expect(searchImages).not.toHaveBeenCalled();
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

  it('renders the normal search UI when settings are null', async () => {
    renderImagePicker({ imageSearchSettings: null });

    expect(screen.getByRole('textbox', { name: /image search query/i })).toHaveDisplayValue('Milk');
    await waitFor(() => {
      expect(searchImages).toHaveBeenCalledWith('Milk', 25, null);
    });
    expect(await screen.findByRole('button', { name: /^search$/i })).toBeInTheDocument();
  });

  it('renders grouped image search results and selects an image', async () => {
    const user = userEvent.setup();
    const onSelectUrl = vi.fn();
    searchImages.mockResolvedValueOnce([
      {
        source: 'walmart',
        label: 'Walmart',
        results: [
          {
            url: 'https://example.com/milk.jpg',
            thumbnail: 'https://example.com/milk-thumb.jpg',
            title: 'Milk carton',
          },
        ],
      },
    ]);
    renderImagePicker({ onSelectUrl });

    expect(await screen.findByRole('heading', { name: 'Walmart' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Milk carton' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Milk carton' }));

    expect(onSelectUrl).toHaveBeenCalledWith('https://example.com/milk.jpg');
  });
});
