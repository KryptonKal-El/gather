import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ItemClaimControls } from './ItemClaimControls.jsx';

const ME = 'user-me';
const SAM = 'user-sam';
const nameFor = (id) => (id === SAM ? 'Sam' : 'Someone');

const renderControls = (overrides = {}) => {
  const props = {
    item: { id: 'item-1', name: 'Mug', quantity: 1 },
    claims: [],
    currentUserId: ME,
    nameFor,
    isGiver: true,
    onClaim: vi.fn().mockResolvedValue(undefined),
    onUnclaim: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<ItemClaimControls {...props} />);
  return props;
};

describe('ItemClaimControls', () => {
  it('lets a giver claim an unclaimed item', async () => {
    const props = renderControls();
    await userEvent.click(screen.getByRole('button', { name: "I'm getting this" }));
    expect(props.onClaim).toHaveBeenCalledWith('item-1', 1);
  });

  it('shows who claimed it and hides the claim button when fully claimed', () => {
    renderControls({ claims: [{ claimedBy: SAM, quantity: 1 }] });
    expect(screen.getByText('Claimed by Sam')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /getting this/i })).not.toBeInTheDocument();
  });

  it("shows the giver's own claim with an unclaim button", async () => {
    const props = renderControls({ claims: [{ claimedBy: ME, quantity: 1 }] });
    expect(screen.getByText("You're getting this")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Unclaim' }));
    expect(props.onUnclaim).toHaveBeenCalledWith('item-1');
  });

  it('shows partial claims for multi-quantity items and lets another giver take one', async () => {
    const props = renderControls({
      item: { id: 'item-1', name: 'Mug', quantity: 3 },
      claims: [{ claimedBy: SAM, quantity: 2 }],
    });
    expect(screen.getByText('2 of 3 claimed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: "I'll get one" }));
    expect(props.onClaim).toHaveBeenCalledWith('item-1', 1);
  });

  it('shows only status (no actions) to the owner with claims revealed', () => {
    renderControls({ isGiver: false, claims: [{ claimedBy: SAM, quantity: 1 }] });
    expect(screen.getByText('Claimed by Sam')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing for the owner when nothing is claimed', () => {
    const { container } = render(
      <ItemClaimControls
        item={{ id: 'i', name: 'Bike', quantity: 1 }}
        claims={[]}
        currentUserId={ME}
        nameFor={nameFor}
        isGiver={false}
        onClaim={vi.fn()}
        onUnclaim={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the database error when a claim fails', async () => {
    const onClaim = vi.fn().mockRejectedValue(new Error('x', { cause: new Error('Only 0 left to claim') }));
    renderControls({ onClaim });
    await userEvent.click(screen.getByRole('button', { name: "I'm getting this" }));
    expect(await screen.findByText('Only 0 left to claim')).toBeInTheDocument();
  });
});
