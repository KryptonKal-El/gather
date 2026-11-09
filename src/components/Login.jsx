/**
 * Login screen with passkey, Apple, and email/password sign-in options.
 */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { HeartfieldBackground } from './HeartfieldBackground.jsx';
import { isPasskeyCancelled, isPasskeySupported, passkeyErrorMessage } from '../utils/passkeyErrors.js';
import styles from './Login.module.css';

/**
 * Maps Supabase auth error messages to user-friendly messages.
 * @param {string} message - Supabase error message
 * @returns {string}
 */
const friendlyError = (message) => {
  switch (message) {
    case 'Invalid login credentials':
      return 'Incorrect email or password.';
    case 'User already registered':
      return 'An account with this email already exists.';
    case 'Password should be at least 6 characters':
      return 'Password must be at least 6 characters.';
    case 'Email rate limit exceeded':
      return 'Too many attempts. Please try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
};

const AUTOFILL_REPORTABLE_CODES = new Set([
  'webauthn_credential_not_found',
  'webauthn_verification_failed',
  'webauthn_challenge_expired',
  'email_not_confirmed',
  'user_banned',
]);

/**
 * Whether the browser can offer passkeys from the email field's autofill menu.
 * @returns {Promise<boolean>}
 */
const canUsePasskeyAutofill = async () => {
  try {
    return await window.PublicKeyCredential?.isConditionalMediationAvailable?.() === true;
  } catch {
    return false;
  }
};

/** Sign-in screen shown when no user session exists. */
export const Login = () => {
  const { signInWithApple, signInWithEmail, signUpWithEmail, signInWithPasskey } = useAuth();
  const [error, setError] = useState(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const autofillAbortRef = useRef(null);
  // The context recreates its actions on every render; keep the autofill effect
  // from restarting the passkey request each time.
  const signInWithPasskeyRef = useRef(signInWithPasskey);
  signInWithPasskeyRef.current = signInWithPasskey;
  const hasPasskeySupport = isPasskeySupported();

  // Offer saved passkeys from the email field's autofill menu. Aborted before any
  // modal passkey prompt so the browser never has two WebAuthn requests pending.
  useEffect(() => {
    if (!hasPasskeySupport || isSignUpMode) return undefined;
    let isActive = true;
    const controller = new AbortController();
    autofillAbortRef.current = controller;

    const startAutofill = async () => {
      if (!(await canUsePasskeyAutofill()) || !isActive) return;
      try {
        await signInWithPasskeyRef.current({ mediation: 'conditional', signal: controller.signal });
      } catch (err) {
        if (!isActive || controller.signal.aborted || isPasskeyCancelled(err)) return;
        // Autofill runs in the background on page load, so only report failures
        // that happen after the user actually picked a passkey.
        if (AUTOFILL_REPORTABLE_CODES.has(err?.code)) setError(passkeyErrorMessage(err));
      }
    };
    startAutofill();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [hasPasskeySupport, isSignUpMode]);

  const handlePasskey = async () => {
    autofillAbortRef.current?.abort();
    setError(null);
    setIsSigningIn(true);
    try {
      await signInWithPasskey();
    } catch (err) {
      if (!isPasskeyCancelled(err)) {
        setError(passkeyErrorMessage(err));
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleApple = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await signInWithApple();
    } catch {
      setError('Apple sign-in failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSigningIn(true);
    try {
      if (isSignUpMode) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className={styles.backdrop}>
      <HeartfieldBackground />
      <div className={styles.card}>
        <div className={styles.logoStack}>
          <img src="/logo/stacked.svg" alt="Gather Lists" className={styles.logoImg} />
          <h1 className={styles.srOnly}>Gather Lists</h1>
        </div>

        <div className={styles.buttons}>
          {hasPasskeySupport && (
            <button
              className={styles.passkeyBtn}
              onClick={handlePasskey}
              disabled={isSigningIn}
              type="button"
            >
              <svg className={styles.passkeyIcon} viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M2 21v-1a6 6 0 0 1 9.5-4.9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="18" cy="13" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M18 15.5V21m0-2h2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Sign in with a passkey
            </button>
          )}

          <button
            className={styles.appleBtn}
            onClick={handleApple}
            disabled={isSigningIn}
            type="button"
          >
            <svg className={styles.appleIcon} viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                fill="currentColor"
              />
            </svg>
            Sign in with Apple
          </button>

          <div className={styles.divider}>
            <span>or</span>
          </div>

          <form className={styles.emailForm} onSubmit={handleEmailSubmit}>
            <input
              type="email"
              className={styles.emailInput}
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete={isSignUpMode ? 'email' : 'username webauthn'}
              required
            />
            <input
              type="password"
              className={styles.emailInput}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUpMode ? 'new-password' : 'current-password'}
              required
              minLength={6}
            />
            <button
              type="submit"
              className={styles.emailBtn}
              disabled={isSigningIn}
            >
              {isSignUpMode ? 'Create Account' : 'Sign In'}
            </button>
            <button
              type="button"
              className={styles.toggleMode}
              onClick={() => { setIsSignUpMode(!isSignUpMode); setError(null); }}
            >
              {isSignUpMode ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
            </button>
          </form>

        </div>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
};
