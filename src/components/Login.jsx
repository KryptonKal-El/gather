/**
 * Login screen with Apple, Google, email/password, and guest sign-in options.
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Login.module.css';

/**
 * Maps Firebase auth error codes to user-friendly messages.
 * @param {string} code - Firebase error code
 * @returns {string}
 */
const friendlyError = (code) => {
  switch (code) {
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
};

export const Login = () => {
  const { signInWithApple, signInWithGoogle, signInWithEmail, signUpWithEmail, signInAsGuest } = useAuth();
  const [error, setError] = useState(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(false);

  const handleApple = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await signInWithApple();
    } catch (err) {
      setError('Apple sign-in failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError('Google sign-in failed. Please try again.');
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
      setError(friendlyError(err.code));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGuest = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await signInAsGuest();
    } catch (err) {
      setError('Guest sign-in failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <h1 className={styles.logo}>
          ShoppingList<span className={styles.ai}>AI</span>
        </h1>
        <p className={styles.tagline}>Smart grocery lists powered by AI</p>

        <div className={styles.buttons}>
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

          <button
            className={styles.googleBtn}
            onClick={handleGoogle}
            disabled={isSigningIn}
            type="button"
          >
            <svg className={styles.googleIcon} viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
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
              autoComplete="email"
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

          <div className={styles.divider}>
            <span>or</span>
          </div>

          <button
            className={styles.guestBtn}
            onClick={handleGuest}
            disabled={isSigningIn}
            type="button"
          >
            Continue as Guest
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <p className={styles.note}>
          Guest data is temporary. Sign in to sync across devices.
        </p>
      </div>
    </div>
  );
};
