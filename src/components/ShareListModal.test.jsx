import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/database.js', () => ({ fetchListShares: vi.fn() }));

const { fetchListShares } = await import('../services/database.js');
const { ShareListModal } = await import('./ShareListModal.jsx');

const renderModal = (list) => {
  const props = {
    list,
    onShare: vi.fn().mockResolvedValue(undefined),
    onUnshare: vi.fn().mockResolvedValue(undefined),
    onUpdateRole: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
  };
  render(<ShareListModal {...props} />);
  return props;
};

describe('ShareListModal roles', () => {
  beforeEach(() => {
    fetchListShares.mockReset();
  });

  it('lists people with their role and changes it', async () => {
    fetchListShares.mockResolvedValue([{ email: 'sam@example.com', role: 'editor' }]);
    const props = renderModal({ id: 'l1', name: 'Groceries', type: 'grocery' });
    const select = await screen.findByLabelText('Access for sam@example.com');
    expect(select).toHaveValue('editor');
    await userEvent.selectOptions(select, 'viewer');
    expect(props.onUpdateRole).toHaveBeenCalledWith('l1', 'sam@example.com', 'viewer');
  });

  it('defaults new shares to view-only on wish lists and passes the role', async () => {
    fetchListShares.mockResolvedValue([]);
    const props = renderModal({ id: 'w1', name: 'Birthday', type: 'wish_list' });
    expect(screen.getByLabelText('Access for the new person')).toHaveValue('viewer');
    await userEvent.type(screen.getByPlaceholderText('Enter email address...'), 'mum@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(props.onShare).toHaveBeenCalledWith('w1', 'mum@example.com', 'viewer'));
  });

  it('defaults new shares to edit on other list types', async () => {
    fetchListShares.mockResolvedValue([]);
    renderModal({ id: 'l1', name: 'Groceries', type: 'grocery' });
    expect(screen.getByLabelText('Access for the new person')).toHaveValue('editor');
  });

  it('keeps the role when removing someone so undo restores it', async () => {
    fetchListShares.mockResolvedValue([{ email: 'mum@example.com', role: 'viewer' }]);
    const props = renderModal({ id: 'w1', name: 'Birthday', type: 'wish_list' });
    await userEvent.click(await screen.findByRole('button', { name: 'Remove mum@example.com' }));
    expect(props.onUnshare).toHaveBeenCalledWith('w1', 'mum@example.com', 'viewer');
  });
});
