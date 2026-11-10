import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailCodeForm } from './EmailCodeForm.jsx';

const authError = (code) => Object.assign(new Error(code), { code });

describe('EmailCodeForm', () => {
  let auth;

  beforeEach(() => {
    auth = {
      sendEmailCode: vi.fn().mockResolvedValue(),
      verifyEmailCode: vi.fn().mockResolvedValue(),
    };
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
    render(<EmailCodeForm onSendCode={auth.sendEmailCode} onVerifyCode={auth.verifyEmailCode} />);
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

  it('tells new people the code creates their account', () => {
    render(<EmailCodeForm onSendCode={auth.sendEmailCode} onVerifyCode={auth.verifyEmailCode} />);
    expect(screen.getByText(/This creates your account/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toHaveAttribute('autocomplete', 'username webauthn');
  });

  it('explains a wrong or expired code', async () => {
    const user = userEvent.setup();
    auth.verifyEmailCode.mockRejectedValue(authError('otp_expired'));
    render(<EmailCodeForm onSendCode={auth.sendEmailCode} onVerifyCode={auth.verifyEmailCode} />);
    await requestCode(user);
    await user.type(await screen.findByRole('textbox', { name: 'Sign-in code' }), '000000');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByText(/incorrect or has expired/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  });

  it('explains when too many codes were requested', async () => {
    const user = userEvent.setup();
    auth.sendEmailCode.mockRejectedValue(authError('over_email_send_rate_limit'));
    render(<EmailCodeForm onSendCode={auth.sendEmailCode} onVerifyCode={auth.verifyEmailCode} />);
    await requestCode(user);
    expect(await screen.findByText(/Too many codes requested/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  });

  it('waits before allowing a resend', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EmailCodeForm onSendCode={auth.sendEmailCode} onVerifyCode={auth.verifyEmailCode} />);
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
    render(<EmailCodeForm onSendCode={auth.sendEmailCode} onVerifyCode={auth.verifyEmailCode} />);
    await requestCode(user);
    await user.click(await screen.findByRole('button', { name: 'Use a different email' }));
    expect(screen.getByRole('button', { name: 'Email me a sign-in code' })).toBeInTheDocument();
  });

});
