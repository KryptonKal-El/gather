/**
 * Login screen with Apple and email/password sign-in options.
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
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

export const Login = () => {
  const { signInWithApple, signInWithEmail, signUpWithEmail } = useAuth();
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
      <div className={styles.card}>
        <div className={styles.logoStack}>
          <svg className={styles.logoIcon} viewBox="0 0 512 512" aria-hidden="true">
            <defs>
              <linearGradient id="loginIconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#B5E8C8"/>
                <stop offset="100%" stopColor="#A8D8EA"/>
              </linearGradient>
            </defs>
            <rect width="512" height="512" rx="96" fill="url(#loginIconGrad)"/>
            <circle cx="160" cy="210" r="18" fill="#fff" opacity="0.95"/>
            <rect x="198" y="198" width="158" height="24" rx="12" fill="#fff" opacity="0.95"/>
            <circle cx="160" cy="260" r="18" fill="#fff" opacity="0.95"/>
            <rect x="198" y="248" width="120" height="24" rx="12" fill="#fff" opacity="0.95"/>
            <circle cx="160" cy="310" r="18" fill="#fff" opacity="0.95"/>
            <rect x="198" y="298" width="144" height="24" rx="12" fill="#fff" opacity="0.95"/>
            <path d="M400,180 C400,180 378,164 378,150 C378,142 384,136 389,136 C394,136 397,140 400,144 C403,140 406,136 411,136 C416,136 422,142 422,150 C422,164 400,180 400,180 Z" fill="#F9A8C9" opacity="0.92"/>
          </svg>
          <h1 className={styles.logo}>Gather</h1>
          <p className={styles.tagline}>Gather your lists, meals, and more.</p>
        </div>

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

        </div>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
};
