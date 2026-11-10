import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import styles from './Login.module.css';

const RESEND_COOLDOWN_SECONDS = 60;
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 8;

/**
 * Maps Supabase email-code errors to user-facing messages.
 * @param {{ code?: string, message?: string }} error
 * @returns {string}
 */
const emailCodeErrorMessage = (error) => {
  switch (error?.code) {
    case 'otp_expired':
      return 'That code is incorrect or has expired. Check the latest email or request a new code.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many codes requested. Please wait a minute and try again.';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Enter a valid email address.';
    case 'signup_disabled':
      return 'New accounts can’t be created right now.';
    case 'user_banned':
      return 'This account has been disabled.';
    default:
      return 'Something went wrong. Please try again.';
  }
};

/**
 * Two-step passwordless sign-in: request a code by email, then enter it.
 * Also creates an account when the email is new.
 * @param {Object} props
 * @param {(email: string) => Promise<void>} props.onSendCode - Emails a code; throws on failure
 * @param {(email: string, code: string) => Promise<void>} props.onVerifyCode - Signs in with the code; throws on failure
 */
export const EmailCodeForm = ({ onSendCode, onVerifyCode }) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const requestCode = async (address) => {
    setError(null);
    setIsBusy(true);
    try {
      await onSendCode(address);
      setSentTo(address);
      setCode('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(emailCodeErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendSubmit = (event) => {
    event.preventDefault();
    requestCode(email.trim());
  };

  const handleVerifySubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      await onVerifyCode(sentTo, code);
    } catch (err) {
      setError(emailCodeErrorMessage(err));
      setIsBusy(false);
    }
  };

  const handleCodeChange = (event) => {
    setCode(event.target.value.replace(/\D/g, '').slice(0, MAX_CODE_LENGTH));
  };

  const handleChangeEmail = () => {
    setSentTo(null);
    setCode('');
    setError(null);
  };

  if (!sentTo) {
    return (
      <form className={styles.emailForm} onSubmit={handleSendSubmit}>
        <input
          type="email"
          className={styles.emailInput}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username webauthn"
          aria-label="Email"
          required
        />
        <button type="submit" className={styles.emailBtn} disabled={isBusy}>
          {isBusy ? 'Sending…' : 'Email me a sign-in code'}
        </button>
        <p className={styles.newAccountHint}>New to Gather? This creates your account.</p>
        {error && <p className={styles.error}>{error}</p>}
      </form>
    );
  }

  return (
    <form className={styles.emailForm} onSubmit={handleVerifySubmit}>
      <p className={styles.codeHint}>
        Enter the code we sent to <strong>{sentTo}</strong>.
      </p>
      <input
        type="text"
        className={`${styles.emailInput} ${styles.codeInput}`}
        placeholder="Sign-in code"
        value={code}
        onChange={handleCodeChange}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="Sign-in code"
        autoFocus
        required
      />
      <button
        type="submit"
        className={styles.emailBtn}
        disabled={isBusy || code.length < MIN_CODE_LENGTH}
      >
        {isBusy ? 'Signing in…' : 'Sign In'}
      </button>
      <div className={styles.codeActions}>
        <button type="button" className={styles.toggleMode} onClick={handleChangeEmail}>
          Use a different email
        </button>
        <button
          type="button"
          className={styles.toggleMode}
          onClick={() => requestCode(sentTo)}
          disabled={isBusy || cooldown > 0}
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
};

EmailCodeForm.propTypes = {
  onSendCode: PropTypes.func.isRequired,
  onVerifyCode: PropTypes.func.isRequired,
};
