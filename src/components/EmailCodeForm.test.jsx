import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../context/AuthContext.jsx';
import { EmailCodeForm } from './EmailCodeForm.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

const authError = (code) => Object.assign(new Error(code), { code });

describe('EmailCodeForm', () => {
  let auth;

  beforeEach(() => {
    auth = {
      sendEmailCode: vi.fn().mockResolvedValue(),
      verifyEmailCode: vi.fn().mockResolvedValue(),
    };
    useAuth.mockReturnValue(auth);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const requestCode = async (user, email = 'sam@example.com') => {
    await user.type(screen.getByPlaceholderText('Email'), email);
    await user.click(screen.getByRole('button', { name: 'Email me a sign-in code' }));
  };

  it('sends a code, then signs in with it', async () => {
    const user = userEvent.setup();
    render(<EmailCodeForm onUsePassword={vi.fn()} />);
    await requestCode(user);

    expect(auth.sendEmailCode).toHaveBeenCalledWith('sam@example.com');
    expect(await screen.findByText('sam@example.com')).toBeInTheDocument();

    const signIn = screen.getByRole('button', { name: 'Sign In' });
    expect(signIn).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Sign-in code' }), '12a3456');
    expect(screen.getByRole('textbox', { name: 'Sign-in code' })).toHaveValue('123456');
    await user.click(signIn);

    expect(auth.verifyEmailCode).toHaveBeenCalledWith('sam@example.com', '123456');
  });

  it('starts with the email already typed on the password form', () => {
    render(<EmailCodeForm initialEmail="sam@example.com" onUsePassword={vi.fn()} />);
    expect(screen.getByPlaceholderText('Email')).toHaveValue('sam@example.com');
  });

  it('explains a wrong or expired code', async () => {
    const user = userEvent.setup();
    auth.verifyEmailCode.mockRejectedValue(authError('otp_expired'));
    render(<EmailCodeForm onUsePassword={vi.fn()} />);
    await requestCode(user);
    await user.type(await screen.findByRole('textbox', { name: 'Sign-in code' }), '000000');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByText(/incorrect or has expired/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  });

  it('explains when too many codes were requested', async () => {
    const user = userEvent.setup();
    auth.sendEmailCode.mockRejectedValue(authError('over_email_send_rate_limit'));
    render(<EmailCodeForm onUsePassword={vi.fn()} />);
    await requestCode(user);
    expect(await screen.findByText(/Too many codes requested/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  });

  it('waits before allowing a resend', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EmailCodeForm onUsePassword={vi.fn()} />);
    await requestCode(user);

    expect(await screen.findByRole('button', { name: /Resend code in \d+s/ })).toBeDisabled();
    for (let i = 0; i < 60; i += 1) {
      await act(async () => { vi.advanceTimersByTime(1000); });
    }
    await user.click(screen.getByRole('button', { name: 'Resend code' }));
    expect(auth.sendEmailCode).toHaveBeenCalledTimes(2);
  });

  it('goes back to entering an email', async () => {
    const user = userEvent.setup();
    render(<EmailCodeForm onUsePassword={vi.fn()} />);
    await requestCode(user);
    await user.click(await screen.findByRole('button', { name: 'Use a different email' }));
    expect(screen.getByRole('button', { name: 'Email me a sign-in code' })).toBeInTheDocument();
  });

  it('switches back to password sign-in', async () => {
    const user = userEvent.setup();
    const onUsePassword = vi.fn();
    render(<EmailCodeForm onUsePassword={onUsePassword} />);
    await user.click(screen.getByRole('button', { name: 'Use a password instead' }));
    expect(onUsePassword).toHaveBeenCalled();
  });
});
