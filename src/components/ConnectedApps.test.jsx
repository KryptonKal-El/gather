import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { disconnectApp, fetchConnectedApps } from '../services/connectedApps.js';
import { ConnectedApps } from './ConnectedApps.jsx';

vi.mock('../services/connectedApps.js', () => ({
  fetchConnectedApps: vi.fn(),
  disconnectApp: vi.fn(),
}));

const CLAUDE = {
  clientId: 'c1',
  name: 'Claude',
  uri: null,
  logoUri: null,
  scopes: ['openid'],
  grantedAt: '2026-10-26T22:00:00Z',
};

describe('ConnectedApps', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state when no apps are connected', async () => {
    fetchConnectedApps.mockResolvedValue([]);
    render(<ConnectedApps />);

    expect(await screen.findByText(/No apps connected/)).toBeInTheDocument();
  });

  it('lists connected apps', async () => {
    fetchConnectedApps.mockResolvedValue([CLAUDE]);
    render(<ConnectedApps />);

    expect(await screen.findByText('Claude')).toBeInTheDocument();
    expect(screen.getByText(/Connected Oct 26, 2026/)).toBeInTheDocument();
  });

  it('disconnects an app only after confirming', async () => {
    const user = userEvent.setup();
    fetchConnectedApps.mockResolvedValue([CLAUDE]);
    disconnectApp.mockResolvedValue();
    render(<ConnectedApps />);

    await user.click(await screen.findByRole('button', { name: 'Disconnect' }));
    expect(disconnectApp).not.toHaveBeenCalled();
    expect(screen.getByText('Disconnect Claude?')).toBeInTheDocument();

    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Disconnect' }));

    expect(disconnectApp).toHaveBeenCalledWith('c1');
    await waitFor(() => expect(screen.queryByText('Claude')).not.toBeInTheDocument());
  });

  it('keeps the app and shows an error when disconnecting fails', async () => {
    const user = userEvent.setup();
    fetchConnectedApps.mockResolvedValue([CLAUDE]);
    disconnectApp.mockRejectedValue(new Error('network'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ConnectedApps />);

    await user.click(await screen.findByRole('button', { name: 'Disconnect' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Disconnect' }));

    expect(await screen.findByText('Couldn’t disconnect Claude. Please try again.')).toBeInTheDocument();
    expect(screen.getByText('Claude')).toBeInTheDocument();
  });

  it('offers a retry when loading fails', async () => {
    const user = userEvent.setup();
    fetchConnectedApps.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([CLAUDE]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ConnectedApps />);

    await user.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Claude')).toBeInTheDocument();
  });

  it('opens the connect sheet and refreshes the list when it closes', async () => {
    const user = userEvent.setup();
    fetchConnectedApps.mockResolvedValueOnce([]).mockResolvedValueOnce([CLAUDE]);
    render(<ConnectedApps />);

    await user.click(await screen.findByRole('button', { name: 'Connect an AI app' }));
    const dialog = screen.getByRole('dialog', { name: 'Connect an AI app' });
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Claude')).toBeInTheDocument();
  });
});
