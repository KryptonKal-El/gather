import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../context/AuthContext.jsx';
import { PasskeysSection } from './PasskeysSection.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

const PASSKEY = {
  id: 'pk-1',
  friendly_name: 'iCloud Keychain',
  created_at: '2026-11-01T12:00:00Z',
  last_used_at: '2026-11-08T12:00:00Z',
};

const cancelledError = () => {
  const err = new Error('The operation either timed out or was not allowed.');
  err.code = 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY';
  err.cause = { name: 'NotAllowedError' };
  return err;
};

describe('PasskeysSection', () => {
  let auth;

  beforeEach(() => {
    window.PublicKeyCredential = function PublicKeyCredential() {};
    auth = {
      listPasskeys: vi.fn().mockResolvedValue([]),
      registerPasskey: vi.fn(),
      renamePasskey: vi.fn(),
      deletePasskey: vi.fn(),
    };
    useAuth.mockReturnValue(auth);
  });

  afterEach(() => {
    delete window.PublicKeyCredential;
    vi.clearAllMocks();
  });

  it('shows an empty state when there are no passkeys', async () => {
    render(<PasskeysSection />);
    expect(await screen.findByText(/instead of a password/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a passkey' })).toBeEnabled();
  });

  it('lists passkeys with their dates', async () => {
    auth.listPasskeys.mockResolvedValue([PASSKEY]);
    render(<PasskeysSection />);
    expect(await screen.findByText('iCloud Keychain')).toBeInTheDocument();
    expect(screen.getByText(/Added Nov 1, 2026 · Last used Nov 8, 2026/)).toBeInTheDocument();
  });

  it('shows a retryable error when loading fails', async () => {
    const user = userEvent.setup();
    auth.listPasskeys.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([PASSKEY]);
    render(<PasskeysSection />);
    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('iCloud Keychain')).toBeInTheDocument();
  });

  it('adds a passkey and refreshes the list', async () => {
    const user = userEvent.setup();
    auth.registerPasskey.mockResolvedValue({ id: 'pk-1' });
    auth.listPasskeys.mockResolvedValueOnce([]).mockResolvedValueOnce([PASSKEY]);
    render(<PasskeysSection />);
    await user.click(await screen.findByRole('button', { name: 'Add a passkey' }));
    expect(auth.registerPasskey).toHaveBeenCalled();
    expect(await screen.findByText('iCloud Keychain')).toBeInTheDocument();
  });

  it('stays quiet when the user cancels the passkey prompt', async () => {
    const user = userEvent.setup();
    auth.registerPasskey.mockRejectedValue(cancelledError());
    render(<PasskeysSection />);
    await user.click(await screen.findByRole('button', { name: 'Add a passkey' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add a passkey' })).toBeEnabled());
    expect(screen.queryByText(/failed|couldn/i)).not.toBeInTheDocument();
  });

  it('explains a duplicate passkey', async () => {
    const user = userEvent.setup();
    auth.registerPasskey.mockRejectedValue(Object.assign(new Error('exists'), { code: 'webauthn_credential_exists' }));
    render(<PasskeysSection />);
    await user.click(await screen.findByRole('button', { name: 'Add a passkey' }));
    expect(await screen.findByText(/already has a passkey/)).toBeInTheDocument();
  });

  it('renames a passkey', async () => {
    const user = userEvent.setup();
    auth.listPasskeys.mockResolvedValue([PASSKEY]);
    auth.renamePasskey.mockResolvedValue();
    render(<PasskeysSection />);
    await user.click(await screen.findByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Passkey name' });
    await user.clear(input);
    await user.type(input, 'My iPhone');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(auth.renamePasskey).toHaveBeenCalledWith('pk-1', 'My iPhone');
    expect(await screen.findByText('My iPhone')).toBeInTheDocument();
  });

  it('removes a passkey only after confirming', async () => {
    const user = userEvent.setup();
    auth.listPasskeys.mockResolvedValue([PASSKEY]);
    auth.deletePasskey.mockResolvedValue();
    render(<PasskeysSection />);
    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(auth.deletePasskey).not.toHaveBeenCalled();

    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(auth.deletePasskey).toHaveBeenCalledWith('pk-1');
    await waitFor(() => expect(screen.queryByText('iCloud Keychain')).not.toBeInTheDocument());
  });

  it('hides the section while passkeys are disabled on the server', async () => {
    auth.listPasskeys.mockRejectedValue(Object.assign(new Error('Passkeys are disabled'), { code: 'passkey_disabled' }));
    const { container } = render(<PasskeysSection />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('explains when the browser has no passkey support', async () => {
    delete window.PublicKeyCredential;
    render(<PasskeysSection />);
    expect(await screen.findByText(/doesn’t support passkeys/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a passkey' })).not.toBeInTheDocument();
  });
});
