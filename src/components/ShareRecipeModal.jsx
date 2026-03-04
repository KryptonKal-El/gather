/**
 * ShareRecipeModal — modal for sharing a recipe with other users by email.
 * Fetches current shares on mount and allows adding/removing them.
 * Only the recipe owner can use this modal.
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import styles from './ShareRecipeModal.module.css';

/**
 * Modal for managing recipe sharing.
 * @param {Object} props
 * @param {Object} props.recipe - The recipe object (must include id, name)
 * @param {string} props.ownerEmail - The recipe owner's email
 * @param {Function} props.onShare - Called with (recipeId, email) to share
 * @param {Function} props.onUnshare - Called with (recipeId, email) to revoke
 * @param {Function} props.getShares - Called with (recipeId) to fetch shares
 * @param {Function} props.onClose - Called to close the modal
 */
export const ShareRecipeModal = ({ recipe, ownerEmail, onShare, onUnshare, getShares, onClose }) => {
  const [email, setEmail] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState(null);
  const [shares, setShares] = useState([]);
  const [isLoadingShares, setIsLoadingShares] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchShares = async () => {
      setIsLoadingShares(true);
      try {
        const result = await getShares(recipe.id);
        if (!cancelled) {
          setShares(result ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(`Failed to load shares: ${err.message}`);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingShares(false);
        }
      }
    };
    fetchShares();
    return () => { cancelled = true; };
  }, [recipe.id, getShares]);

  const collaboratorEmails = shares.map((s) => s.email);

  const refetchShares = async () => {
    try {
      const result = await getShares(recipe.id);
      setShares(result ?? []);
    } catch (err) {
      setError(`Failed to refresh shares: ${err.message}`);
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address');
      return;
    }

    if (trimmed === ownerEmail?.toLowerCase()) {
      setError('You already own this recipe');
      return;
    }

    if (collaboratorEmails.includes(trimmed)) {
      setError('This person already has access');
      return;
    }

    setError(null);
    setIsSharing(true);
    try {
      await onShare(recipe.id, trimmed);
      setEmail('');
      await refetchShares();
    } catch (err) {
      setError(`Failed to share: ${err.message}`);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRemove = async (collaboratorEmail) => {
    try {
      await onUnshare(recipe.id, collaboratorEmail);
      await refetchShares();
    } catch (err) {
      setError(`Failed to remove: ${err.message}`);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={`Share "${recipe.name}"`}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Share &ldquo;{recipe.name}&rdquo;</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <form className={styles.form} onSubmit={handleShare}>
          <input
            className={styles.emailInput}
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="Enter email address..."
            autoFocus
            disabled={isSharing}
          />
          <button
            className={styles.shareBtn}
            type="submit"
            disabled={!email.trim() || isSharing}
          >
            {isSharing ? 'Sharing...' : 'Share'}
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.collaborators}>
          <h4 className={styles.subTitle}>People with access</h4>

          <div className={styles.owner}>
            <span className={styles.personEmail}>{ownerEmail ?? 'You'}</span>
            <span className={styles.ownerBadge}>Owner</span>
          </div>

          {isLoadingShares ? (
            <p className={styles.emptyMsg}>Loading...</p>
          ) : collaboratorEmails.length === 0 ? (
            <p className={styles.emptyMsg}>No one else has access yet.</p>
          ) : (
            shares.map((share) => (
              <div key={share.id} className={styles.person}>
                <span className={styles.personEmail}>{share.email}</span>
                <button
                  className={styles.removeBtn}
                  onClick={() => handleRemove(share.email)}
                  aria-label={`Remove ${share.email}`}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

ShareRecipeModal.propTypes = {
  recipe: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  }).isRequired,
  ownerEmail: PropTypes.string,
  onShare: PropTypes.func.isRequired,
  onUnshare: PropTypes.func.isRequired,
  getShares: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
