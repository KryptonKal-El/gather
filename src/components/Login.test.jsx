import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../context/AuthContext.jsx';
import { Login } from './Login.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

vi.mock('./HeartfieldBackground.jsx', () => ({
  HeartfieldBackground: () => null,
}));

describe('Login passkey sign-in', () => {
  let auth;

  beforeEach(() => {
    window.PublicKeyCredential = function PublicKeyCredential() {};
    auth = {
      signInWithApple: vi.fn(),
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      signInWithPasskey: vi.fn().mockResolvedValue(),
    };
    useAuth.mockReturnValue(auth);
  });

  afterEach(() => {
    delete window.PublicKeyCredential;
    vi.clearAllMocks();
  });

  it('signs in with a passkey from the button', async () => {
    const user = userEvent.setup();
    render(<Login />);
    await user.click(screen.getByRole('button', { name: 'Sign in with a passkey' }));
    expect(auth.signInWithPasskey).toHaveBeenCalledWith();
  });

  it('shows no error when the passkey prompt is dismissed', async () => {
    const user = userEvent.setup();
    auth.signInWithPasskey.mockRejectedValue(Object.assign(new Error('not allowed'), { cause: { name: 'NotAllowedError' } }));
    render(<Login />);
    await user.click(screen.getByRole('button', { name: 'Sign in with a passkey' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in with a passkey' })).toBeEnabled());
    expect(screen.queryByText(/failed|try again/i)).not.toBeInTheDocument();
  });

  it('explains an unknown passkey', async () => {
    const user = userEvent.setup();
    auth.signInWithPasskey.mockRejectedValue(Object.assign(new Error('nf'), { code: 'webauthn_credential_not_found' }));
    render(<Login />);
    await user.click(screen.getByRole('button', { name: 'Sign in with a passkey' }));
    expect(await screen.findByText(/no longer linked/)).toBeInTheDocument();
  });

  it('offers passkeys through autofill when the browser supports it', async () => {
    window.PublicKeyCredential.isConditionalMediationAvailable = vi.fn().mockResolvedValue(true);
    render(<Login />);
    await waitFor(() => expect(auth.signInWithPasskey).toHaveBeenCalledWith(
      expect.objectContaining({ mediation: 'conditional' }),
    ));
    expect(screen.getByPlaceholderText('Email')).toHaveAttribute('autocomplete', 'username webauthn');
  });

  it('keeps background autofill failures off the screen', async () => {
    window.PublicKeyCredential.isConditionalMediationAvailable = vi.fn().mockResolvedValue(true);
    auth.signInWithPasskey.mockRejectedValue(Object.assign(new Error('off'), { code: 'passkey_disabled' }));
    render(<Login />);
    await waitFor(() => expect(auth.signInWithPasskey).toHaveBeenCalled());
    expect(screen.queryByText(/not available/)).not.toBeInTheDocument();
  });

  it('hides the passkey button when the browser has no passkey support', () => {
    delete window.PublicKeyCredential;
    render(<Login />);
    expect(screen.queryByRole('button', { name: 'Sign in with a passkey' })).not.toBeInTheDocument();
  });
});
