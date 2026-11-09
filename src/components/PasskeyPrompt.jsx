import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { isPasskeyCancelled, isPasskeySupported, passkeyErrorMessage } from '../utils/passkeyErrors.js';
import styles from './PasskeyPrompt.module.css';

const dismissedKey = (userId) => `gather.passkeyPromptDismissed.${userId}`;

const readDismissed = (userId) => {
  try {
    return localStorage.getItem(dismissedKey(userId)) === '1';
  } catch {
    return false;
  }
};

const writeDismissed = (userId) => {
  try {
    localStorage.setItem(dismissedKey(userId), '1');
  } catch {
    // Storage unavailable (private mode); the prompt may reappear next visit.
  }
};

/**
 * One-time suggestion for email/password users to add a passkey.
 * Hidden once dismissed, once a passkey exists, or when the browser can't use passkeys.
 */
export const PasskeyPrompt = () => {
  const { user, listPasskeys, registerPasskey } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState(null);
  const userId = user?.id ?? null;
  const usesPassword = user?.app_metadata?.providers?.includes('email') ?? false;

  useEffect(() => {
    if (!userId || !usesPassword || !isPasskeySupported() || readDismissed(userId)) return undefined;
    let cancelled = false;
    listPasskeys()
      .then((passkeys) => {
        if (!cancelled && passkeys.length === 0) setIsVisible(true);
      })
      .catch((err) => {
        if (err?.code !== 'passkey_disabled') console.error('[PasskeyPrompt] could not check passkeys', err);
      });
    return () => {
      cancelled = true;
    };
    // listPasskeys is recreated on every AuthProvider render; check once per user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, usesPassword]);

  const handleDismiss = () => {
    writeDismissed(userId);
    setIsVisible(false);
  };

  const handleAdd = async () => {
    setError(null);
    setIsAdding(true);
    try {
      await registerPasskey();
      writeDismissed(userId);
      setIsVisible(false);
    } catch (err) {
      if (!isPasskeyCancelled(err)) setError(passkeyErrorMessage(err));
    } finally {
      setIsAdding(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className={styles.toast} role="dialog" aria-labelledby="passkey-prompt-title">
      <div className={styles.text}>
        <p id="passkey-prompt-title" className={styles.title}>Skip the password next time</p>
        <p className={styles.message}>
          Add a passkey to sign in with Face ID, Touch ID, or your device passcode.
        </p>
        {error && <p className={styles.error}>{error}</p>}
      </div>
      <div className={styles.actions}>
        <button className={styles.dismissBtn} onClick={handleDismiss} type="button">
          Not now
        </button>
        <button className={styles.addBtn} onClick={handleAdd} disabled={isAdding} type="button">
          {isAdding ? 'Adding…' : 'Add passkey'}
        </button>
      </div>
    </div>
  );
};
