import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserStoreDefaultsManager } from './UserStoreDefaultsManager.jsx';

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual('@dnd-kit/core');
  return {
    ...actual,
    DndContext: ({ children, onDragEnd }) => (
      <div>
        {children}
        <button
          type="button"
          onClick={() => onDragEnd({ active: { id: 'default-1' }, over: { id: 'default-2' } })}
        >
          simulate reorder
        </button>
      </div>
    ),
  };
});

const userStoreDefaults = [
  {
    id: 'default-1',
    userId: 'user-1',
    listType: 'grocery',
    name: 'Costco',
    color: '#B5E8C8',
    sortOrder: 0,
  },
  {
    id: 'default-2',
    userId: 'user-1',
    listType: 'grocery',
    name: 'Target',
    color: '#A8D8EA',
    sortOrder: 1,
  },
  {
    id: 'packing-1',
    userId: 'user-1',
    listType: 'packing',
    name: 'Travel Shop',
    color: '#85BFA8',
    sortOrder: 0,
  },
];

const defaultProps = {
  listType: 'grocery',
  userStoreDefaults,
  onCreateDefault: vi.fn(),
  onUpdateDefault: vi.fn(),
  onDeleteDefault: vi.fn(),
  onReorderDefaults: vi.fn(),
};

const renderManager = (props = {}) => render(
  <UserStoreDefaultsManager {...defaultProps} {...props} />,
);

describe('UserStoreDefaultsManager callbacks', () => {
  beforeEach(() => {
    defaultProps.onCreateDefault.mockClear();
    defaultProps.onUpdateDefault.mockClear();
    defaultProps.onDeleteDefault.mockClear();
    defaultProps.onReorderDefaults.mockClear();
  });

  it('calls onCreateDefault with the list type, name, and color for new defaults', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(screen.getByRole('button', { name: /add store default/i }));
    await user.type(screen.getByRole('textbox'), 'Walmart');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(defaultProps.onCreateDefault).toHaveBeenCalledWith('grocery', 'Walmart', '#B5E8C8');
  });

  it('calls onUpdateDefault with the default ID, name, and color separately', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0]);
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'Costco Business');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(defaultProps.onUpdateDefault).toHaveBeenCalledWith('default-1', 'Costco Business', '#B5E8C8');
  });

  it('calls onDeleteDefault with the selected default ID', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0]);
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[2]);

    expect(defaultProps.onDeleteDefault).toHaveBeenCalledWith('default-1');
  });

  it('calls onReorderDefaults with only reordered defaults for the current list type', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(screen.getByRole('button', { name: /simulate reorder/i }));

    await waitFor(() => {
      expect(defaultProps.onReorderDefaults).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'default-2', listType: 'grocery', sortOrder: 0 }),
        expect.objectContaining({ id: 'default-1', listType: 'grocery', sortOrder: 1 }),
      ]);
    });
  });
});
