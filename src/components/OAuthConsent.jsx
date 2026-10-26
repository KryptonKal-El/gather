import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase.js';
import styles from './OAuthConsent.module.css';

/**
 * OAuth consent screen for the Gather Lists OAuth 2.1 server.
 *
 * Supabase Auth (acting as the authorization server) redirects here with an
 * `authorization_id` query parameter when an MCP client such as Claude asks to
 * connect to the user's account. The page shows which client is asking and the
 * scopes it wants, then approves or denies via the supabase-js OAuth API. If the
 * user isn't signed in, it gates on a minimal sign-in first.
 *
 * Mounted by main.jsx at the path configured in Supabase Auth
 * (`[auth.oauth_server].authorization_url_path` = /app/oauth/consent).
 */
export function OAuthConsent() {
  const authorizationId = new URLSearchParams(window.location.search).get('authorization_id');

  // loading | needsAuth | consent | submitting | error
  const [phase, setPhase] = useState(authorizationId ? 'loading' : 'error');
  const [details, setDetails] = useState(null);
  const [errorMessage, setErrorMessage] = useState(
    authorizationId ? null : 'Missing authorization request. Open this page from the app you are connecting.',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loadDetails = useCallback(async () => {
    setPhase('loading');
    setErrorMessage(null);
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error) {
      setErrorMessage(error.message || 'Could not load the authorization request.');
      setPhase('error');
      return;
    }
    // Already consented → Supabase returns a ready redirect URL.
    if (data && 'redirect_url' in data) {
      window.location.href = data.redirect_url;
      return;
    }
    setDetails(data);
    setPhase('consent');
  }, [authorizationId]);

  useEffect(() => {
    if (!authorizationId) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPhase('needsAuth');
        return;
      }
      await loadDetails();
    })();
  }, [authorizationId, loadDetails]);

  const handleDecision = useCallback(async (approve) => {
    setPhase('submitting');
    setErrorMessage(null);
    const fn = approve
      ? supabase.auth.oauth.approveAuthorization
      : supabase.auth.oauth.denyAuthorization;
    const { data, error } = await fn.call(supabase.auth.oauth, authorizationId, { skipBrowserRedirect: true });
    if (error) {
      setErrorMessage(error.message || 'Something went wrong. Please try again.');
      setPhase('consent');
      return;
    }
    window.location.href = data.redirect_url;
  }, [authorizationId]);

  const handlePasswordSignIn = useCallback(async (event) => {
    event.preventDefault();
    setErrorMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorMessage(error.message || 'Sign in failed.');
      return;
    }
    await loadDetails();
  }, [email, password, loadDetails]);

  const handleAppleSignIn = useCallback(async () => {
    // Return to this same consent URL (with authorization_id) after Apple sign-in.
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.href },
    });
  }, []);

  const renderBody = () => {
    if (phase === 'loading') {
      return <p className={styles.subtitle}>Loading…</p>;
    }

    if (phase === 'error') {
      return <div className={styles.error}>{errorMessage}</div>;
    }

    if (phase === 'needsAuth') {
      return (
        <>
          <h1 className={styles.title}>Sign in to continue</h1>
          <p className={styles.subtitle}>Sign in to your Gather Lists account to connect it.</p>
          {errorMessage && <div className={styles.error}>{errorMessage}</div>}
          <form onSubmit={handlePasswordSignIn}>
            <input
              className={styles.field}
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className={styles.field}
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button className={`${styles.button} ${styles.approve}`} type="submit">
              Sign in
            </button>
          </form>
          <div className={styles.divider}>or</div>
          <button className={styles.appleButton} type="button" onClick={handleAppleSignIn}>
            Continue with Apple
          </button>
        </>
      );
    }

    // consent | submitting
    const clientName = details?.client?.name || 'An application';
    const scopes = (details?.scope || '').split(/\s+/).filter(Boolean);
    const submitting = phase === 'submitting';
    return (
      <>
        <h1 className={styles.title}>
          <span className={styles.client}>{clientName}</span> wants to access your Gather Lists account
        </h1>
        <p className={styles.subtitle}>
          Signed in as {details?.user?.email}. If you approve, it will be able to:
        </p>
        {errorMessage && <div className={styles.error}>{errorMessage}</div>}
        <ul className={styles.scopes}>
          {scopes.length === 0 ? (
            <li className={styles.scopeItem}><span className={styles.check}>✓</span> Access your lists, recipes, and meal plans</li>
          ) : (
            scopes.map((scope) => (
              <li key={scope} className={styles.scopeItem}>
                <span className={styles.check}>✓</span> {scope}
              </li>
            ))
          )}
        </ul>
        <div className={styles.actions}>
          <button
            className={`${styles.button} ${styles.deny}`}
            type="button"
            onClick={() => handleDecision(false)}
            disabled={submitting}
          >
            Deny
          </button>
          <button
            className={`${styles.button} ${styles.approve}`}
            type="button"
            onClick={() => handleDecision(true)}
            disabled={submitting}
          >
            {submitting ? 'Connecting…' : 'Approve'}
          </button>
        </div>
      </>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>Gather Lists</div>
        {renderBody()}
        <p className={styles.muted}>
          You can revoke access at any time from your Gather Lists account settings.
        </p>
      </div>
    </div>
  );
}
