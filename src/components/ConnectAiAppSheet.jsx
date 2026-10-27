import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import styles from './ConnectAiAppSheet.module.css';

/** Address of Gather's MCP server, which AI apps add as a custom connector. */
export const MCP_SERVER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp`;

/** Claude's connector settings, where a custom connector is added. */
export const CLAUDE_CONNECTORS_URL = 'https://claude.ai/settings/connectors';

/**
 * Modal that walks the user through connecting an AI app (Claude) to Gather:
 * copy the server address, add it as a custom connector, then approve.
 * The AI app starts the OAuth flow, so Gather can only hand off.
 */
export const ConnectAiAppSheet = ({ onClose }) => {
  const titleId = useId();
  const [copyState, setCopyState] = useState('idle');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(MCP_SERVER_URL);
      setCopyState('copied');
    } catch (error) {
      console.error('[ConnectAiAppSheet] copy failed', error);
      setCopyState('failed');
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className={styles.title}>Connect an AI app</h2>
        <p className={styles.intro}>
          Let Claude see and update your lists, recipes, and meal plans.
        </p>

        <div className={styles.urlRow}>
          <code className={styles.url}>{MCP_SERVER_URL}</code>
          <button type="button" className={styles.copyBtn} onClick={handleCopy}>
            {copyState === 'copied' ? 'Copied' : 'Copy'}
          </button>
        </div>
        {copyState === 'failed' && (
          <p className={styles.errorText}>Couldn’t copy. Select the address and copy it yourself.</p>
        )}

        <ol className={styles.steps}>
          <li>Copy the server address above.</li>
          <li>In Claude, open Settings → Connectors and choose “Add custom connector”.</li>
          <li>Name it Gather Lists, paste the address, then sign in and approve.</li>
        </ol>
        <p className={styles.note}>
          Add it on claude.ai. Once it’s added, the Claude app on your phone can use it too.
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Close
          </button>
          <a
            className={styles.primaryBtn}
            href={CLAUDE_CONNECTORS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Claude settings
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
};

ConnectAiAppSheet.propTypes = {
  onClose: PropTypes.func.isRequired,
};
