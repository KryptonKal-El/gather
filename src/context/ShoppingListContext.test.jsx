import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useShoppingList } from '../hooks/useShoppingList.js';
import { ShoppingListProvider } from './ShoppingListContext.jsx';
import {
  createUserStoreDefault,
  fetchListCollaborators,
  fetchUserStoreDefaults,
  saveUserStoreDefaultOrder,
  subscribeHistory,
  subscribeItems,
  subscribeLists,
  subscribeSharedListRefs,
  subscribeStores,
  subscribeUserCategoryDefaults,
} from '../services/database.js';

vi.mock('./AuthContext.jsx', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-1', email: 'user@example.com' },
    sessionVersion: 0,
  })),
}));

vi.mock('../services/database.js', () => ({
  subscribeLists: vi.fn(),
  subscribeItems: vi.fn(),
  subscribeHistory: vi.fn(),
  subscribeStores: vi.fn(),
  subscribeSharedListRefs: vi.fn(),
  subscribeList: vi.fn(),
  subscribeSharedItems: vi.fn(),
  subscribeUserCategoryDefaults: vi.fn(),
  createList: vi.fn(),
  updateList: vi.fn(),
  deleteList: vi.fn(),
  duplicateList: vi.fn(),
  addItem: vi.fn(),
  addItems: vi.fn(),
  updateItem: vi.fn(),
  removeItem: vi.fn(),
  clearCheckedItems: vi.fn(),
  resetGuestListRsvp: vi.fn(),
  addHistoryEntry: vi.fn(),
  addHistoryEntries: vi.fn(),
  setHistoryImageForItem: vi.fn(),
  createStore: vi.fn(),
  updateStore: vi.fn(),
  deleteStore: vi.fn(),
  saveStoreOrder: vi.fn(),
  fetchUserStoreDefaults: vi.fn(),
  createUserStoreDefault: vi.fn(),
  updateUserStoreDefault: vi.fn(),
  deleteUserStoreDefault: vi.fn(),
  saveUserStoreDefaultOrder: vi.fn(),
  shareList: vi.fn(),
  unshareList: vi.fn(),
  upsertUserCategoryDefault: vi.fn(),
  fetchListCollaborators: vi.fn(),
}));

vi.mock('../services/preferences.js', () => ({
  updateLastListId: vi.fn().mockResolvedValue(undefined),
  updateListOrder: vi.fn().mockResolvedValue(undefined),
  getUserPreferences: vi.fn().mockResolvedValue({ last_list_id: null }),
}));

vi.mock('../services/supabase.js', () => {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  };
  return {
    supabase: {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    },
  };
});

const defaultsByType = {
  grocery: [
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
    {
      id: 'grocery-3',
      userId: 'user-1',
      listType: 'grocery',
      name: 'Kroger',
      color: '#FFD6A5',
      sortOrder: 2,
    },
  ],
  packing: [
    {
      id: 'packing-1',
      userId: 'user-1',
      listType: 'packing',
      name: 'Travel Store',
      color: '#85BFA8',
      sortOrder: 0,
    },
    {
      id: 'packing-2',
      userId: 'user-1',
      listType: 'packing',
      name: 'Camp Store',
      color: '#F4C89E',
      sortOrder: 1,
    },
  ],
  project: [],
};

const TestConsumer = () => {
  const { state, actions } = useShoppingList();
  const groceryDefaults = state.userStoreDefaults.filter((def) => def.listType === 'grocery');
  const packingDefaults = state.userStoreDefaults.filter((def) => def.listType === 'packing');

  return (
    <div>
      <div>defaults: {state.userStoreDefaults.map((def) => `${def.listType}:${def.name}`).join(', ')}</div>
      <div>grocery defaults: {groceryDefaults.map((def) => def.name).join(', ')}</div>
      <div>packing defaults: {packingDefaults.map((def) => def.name).join(', ')}</div>
      <div>defaults count: {state.userStoreDefaults.length}</div>
      <button type="button" onClick={() => actions.createUserStoreDefault('grocery', 'Walmart', '#FDCFE8')}>
        create default
      </button>
      <button
        type="button"
        onClick={() => actions.saveUserStoreDefaultOrder(['grocery-3', 'grocery-1', 'grocery-2'].map((id, index) => ({
          ...groceryDefaults.find((def) => def.id === id),
          sortOrder: index,
        })))}
      >
        reorder grocery defaults
      </button>
    </div>
  );
};

const renderProvider = () => render(
  <ShoppingListProvider>
    <TestConsumer />
  </ShoppingListProvider>,
);

describe('ShoppingListProvider store scoping and user store defaults', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    subscribeLists.mockImplementation((_userId, callback) => {
      callback([
        {
          id: 'active-list',
          name: 'Groceries',
          type: 'grocery',
          ownerId: 'user-1',
          itemCount: 0,
        },
      ]);
      return vi.fn();
    });
    subscribeSharedListRefs.mockImplementation((_email, callback) => {
      callback([]);
      return vi.fn();
    });
    subscribeItems.mockImplementation((_userId, _listId, callback) => {
      callback([]);
      return vi.fn();
    });
    subscribeHistory.mockImplementation((_userId, callback) => {
      callback([]);
      return vi.fn();
    });
    subscribeStores.mockImplementation((_listId, callback) => {
      callback([]);
      return vi.fn();
    });
    subscribeUserCategoryDefaults.mockImplementation((_userId, callback) => {
      callback([]);
      return vi.fn();
    });
    fetchListCollaborators.mockResolvedValue([]);
    fetchUserStoreDefaults.mockImplementation((_userId, listType) => Promise.resolve(defaultsByType[listType] ?? []));
    createUserStoreDefault.mockResolvedValue('new-default-id');
    saveUserStoreDefaultOrder.mockResolvedValue(undefined);
  });

  it('subscribes to stores for the active list ID', async () => {
    localStorage.setItem('gather_last_list_id', 'active-list');

    renderProvider();

    await waitFor(() => {
      expect(subscribeStores).toHaveBeenCalledWith('active-list', expect.any(Function));
    });
  });

  it('appends a complete user store default after creating one', async () => {
    const user = userEvent.setup();
    renderProvider();

    await screen.findByText(/grocery:Costco/);
    await user.click(screen.getByRole('button', { name: /create default/i }));

    await waitFor(() => {
      expect(screen.getByText(/grocery:Walmart/)).toBeInTheDocument();
    });
    expect(createUserStoreDefault).toHaveBeenCalledWith('user-1', 'grocery', {
      name: 'Walmart',
      color: '#FDCFE8',
      sortOrder: 3,
    });
  });

  it('merges reordered user store defaults by list type', async () => {
    const user = userEvent.setup();
    renderProvider();

    await screen.findByText(/packing:Travel Store/);
    await user.click(screen.getByRole('button', { name: /reorder grocery defaults/i }));

    await waitFor(() => {
      expect(saveUserStoreDefaultOrder).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'grocery-3', listType: 'grocery', sortOrder: 0 }),
        expect.objectContaining({ id: 'grocery-1', listType: 'grocery', sortOrder: 1 }),
        expect.objectContaining({ id: 'grocery-2', listType: 'grocery', sortOrder: 2 }),
      ]);
    });
    expect(screen.getByText('grocery defaults: Kroger, Costco, Target')).toBeInTheDocument();
    expect(screen.getByText('packing defaults: Travel Store, Camp Store')).toBeInTheDocument();
    expect(screen.getByText('defaults count: 5')).toBeInTheDocument();
  });
});
