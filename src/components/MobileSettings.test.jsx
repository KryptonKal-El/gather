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

const groceryStoreDefaults = [
  {
    id: 'grocery-1',
    userId: 'user-1',
    listType: 'grocery',
    name: 'Costco',
    color: '#B5E8C8',
    sortOrder: 0,
  },
  {
    id: 'grocery-2',
    userId: 'user-1',
    listType: 'grocery',
    name: 'Target',
    color: '#A8D8EA',
    sortOrder: 1,
  },
];

describe('MobileSettings image search settings', () => {
  let refreshUser;

  beforeEach(() => {
    refreshUser = vi.fn().mockResolvedValue(undefined);
    useAuth.mockReturnValue({ refreshUser });
    useTheme.mockReturnValue({ theme: 'light', toggleTheme: vi.fn() });
    useShoppingList.mockReturnValue({
      state: { userCategoryDefaults: [], userStoreDefaults: [] },
      actions: {
        saveUserCategoryDefault: vi.fn(),
        createUserStoreDefault: vi.fn(),
        updateUserStoreDefault: vi.fn(),
        deleteUserStoreDefault: vi.fn(),
        saveUserStoreDefaultOrder: vi.fn(),
      },
    });
    updateImageSearchSettings.mockResolvedValue({ error: null });
  });

  it('renders toggles for every image search source', () => {
    render(<MobileSettings user={makeUser()} onSignOut={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: /toggle walmart image search/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /toggle spoonacular image search/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /toggle open food facts image search/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /toggle google images image search/i })).not.toBeChecked();
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

describe('MobileSettings store defaults manager wiring', () => {
  let createUserStoreDefault;
  let updateUserStoreDefault;
  let deleteUserStoreDefault;
  let saveUserStoreDefaultOrder;

  beforeEach(() => {
    createUserStoreDefault = vi.fn().mockResolvedValue(undefined);
    updateUserStoreDefault = vi.fn().mockResolvedValue(undefined);
    deleteUserStoreDefault = vi.fn().mockResolvedValue(undefined);
    saveUserStoreDefaultOrder = vi.fn().mockResolvedValue(undefined);

    useAuth.mockReturnValue({ refreshUser: vi.fn() });
    useTheme.mockReturnValue({ theme: 'light', toggleTheme: vi.fn() });
    useShoppingList.mockReturnValue({
      state: { userCategoryDefaults: [], userStoreDefaults: groceryStoreDefaults },
      actions: {
        saveUserCategoryDefault: vi.fn(),
        createUserStoreDefault,
        updateUserStoreDefault,
        deleteUserStoreDefault,
        saveUserStoreDefaultOrder,
      },
    });
    updateImageSearchSettings.mockResolvedValue({ error: null });
  });

  it('calls the context create action when adding a store default', async () => {
    const user = userEvent.setup();
    render(<MobileSettings user={makeUser()} onSignOut={vi.fn()} />);

    await user.click(screen.getAllByRole('button', { name: /grocery/i }).at(-1));
    await user.click(screen.getByRole('button', { name: /\+ add store default/i }));
    await user.type(screen.getByPlaceholderText(/store name/i), 'Walmart');
    await user.click(screen.getByTitle('#FDCFE8'));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(createUserStoreDefault).toHaveBeenCalledWith('grocery', 'Walmart', '#FDCFE8');
  });

  it('calls the context delete action when deleting a store default', async () => {
    const user = userEvent.setup();
    render(<MobileSettings user={makeUser()} onSignOut={vi.fn()} />);

    await user.click(screen.getAllByRole('button', { name: /grocery/i }).at(-1));
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0]);
    await user.click(screen.getAllByRole('button', { name: /^delete$/i }).at(-1));

    expect(deleteUserStoreDefault).toHaveBeenCalledWith('grocery-1');
  });
});
