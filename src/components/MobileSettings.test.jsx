import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useShoppingList } from '../hooks/useShoppingList.js';
import { updateImageSearchSettings } from '../services/database.js';
import { MobileSettings } from './MobileSettings.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../context/ThemeContext.jsx', () => ({
  useTheme: vi.fn(),
}));

vi.mock('../hooks/useShoppingList.js', () => ({
  useShoppingList: vi.fn(),
}));

vi.mock('../services/database.js', () => ({
  updateImageSearchSettings: vi.fn(),
}));

vi.mock('../services/imageStorage.js', () => ({
  uploadProfileImage: vi.fn(),
}));

vi.mock('./CategoryEditor.jsx', () => ({
  CategoryEditor: () => <div>Category editor</div>,
}));

vi.mock('./ConfirmDialog.jsx', () => ({
  ConfirmDialog: () => <div role="dialog">Confirm reset</div>,
}));

vi.mock('./ListTypeIcons.jsx', () => ({
  GroceryIcon: () => null,
  TodoIcon: () => null,
  PackingIcon: () => null,
  ProjectIcon: () => null,
}));

const imageSearchSettings = {
  walmart: true,
  spoonacular: false,
  openfoodfacts: false,
  serpapi: false,
};

const makeUser = (settings = imageSearchSettings) => ({
  id: 'user-1',
  email: 'user@example.com',
  user_metadata: { full_name: 'Taylor' },
  profile: {
    display_name: 'Taylor',
    imageSearchSettings: settings,
  },
});

describe('MobileSettings image search settings', () => {
  let refreshUser;

  beforeEach(() => {
    refreshUser = vi.fn().mockResolvedValue(undefined);
    useAuth.mockReturnValue({ refreshUser });
    useTheme.mockReturnValue({ theme: 'light', toggleTheme: vi.fn() });
    useShoppingList.mockReturnValue({
      state: { userCategoryDefaults: [] },
      actions: { saveUserCategoryDefault: vi.fn() },
    });
    updateImageSearchSettings.mockResolvedValue({ error: null });
  });

  it('renders toggles for every image search source', () => {
    render(<MobileSettings user={makeUser()} onSignOut={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: /toggle walmart image search/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /toggle spoonacular image search/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /toggle open food facts image search/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /toggle serpapi image search/i })).not.toBeChecked();
  });

  it('optimistically enables a source and refreshes the user after saving', async () => {
    const user = userEvent.setup();
    let resolveUpdate;
    updateImageSearchSettings.mockReturnValue(new Promise((resolve) => {
      resolveUpdate = resolve;
    }));
    render(<MobileSettings user={makeUser()} onSignOut={vi.fn()} />);

    await user.click(screen.getByRole('checkbox', { name: /toggle spoonacular image search/i }));

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /toggle spoonacular image search/i })).toBeChecked();
    });
    expect(updateImageSearchSettings).toHaveBeenCalledWith('user-1', {
      ...imageSearchSettings,
      spoonacular: true,
    });

    resolveUpdate({ error: null });

    await waitFor(() => {
      expect(refreshUser).toHaveBeenCalledTimes(1);
    });
  });

  it('rolls back the optimistic update when saving fails', async () => {
    const user = userEvent.setup();
    let resolveUpdate;
    updateImageSearchSettings.mockReturnValue(new Promise((resolve) => {
      resolveUpdate = resolve;
    }));
    render(<MobileSettings user={makeUser()} onSignOut={vi.fn()} />);

    await user.click(screen.getByRole('checkbox', { name: /toggle walmart image search/i }));

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /toggle walmart image search/i })).not.toBeChecked();
    });

    resolveUpdate({ error: { message: 'save failed' } });

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /toggle walmart image search/i })).toBeChecked();
    });
    expect(screen.getByText('Unable to save image search settings. Please try again.')).toBeInTheDocument();
    expect(refreshUser).not.toHaveBeenCalled();
  });
});
