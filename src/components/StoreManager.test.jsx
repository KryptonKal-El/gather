import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StoreManager } from './StoreManager.jsx';

vi.mock('./ConfirmDialog.jsx', () => ({
  ConfirmDialog: ({ message, onConfirm, onCancel }) => (
    <div role="dialog" aria-label={message}>
      <button type="button" onClick={onConfirm}>Confirm delete</button>
      <button type="button" onClick={onCancel}>Cancel delete</button>
    </div>
  ),
}));

const defaultProps = {
  stores: [
    { id: 'store-1', name: 'Costco', color: '#B5E8C8' },
    { id: 'store-2', name: 'Target', color: '#A8D8EA' },
  ],
  onAdd: vi.fn(),
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
  onReorder: vi.fn(),
};

describe('StoreManager list-scoped stores', () => {
  it('renders stores without a list ID prop', () => {
    render(<StoreManager {...defaultProps} />);

    expect(screen.getByRole('heading', { name: /your stores \(2\)/i })).toBeInTheDocument();
    expect(screen.getByText('Costco')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
  });
});
