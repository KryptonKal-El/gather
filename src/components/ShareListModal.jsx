/**
 * ShareListModal — modal for sharing a list with other users by email.
 * Shows current collaborators and allows adding/removing them.
 * Only the list owner can use this modal.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import styles from './ShareListModal.module.css';

/**
 * Extracts collaborator emails from the list's sharedWith map.
 * @param {Object} sharedWith - Map of sanitized email keys to { email, addedAt }
 * @returns {string[]} Array of email addresses
 */
const getCollaboratorEmails = (sharedWith) => {
  if (!sharedWith || typeof sharedWith !== 'object') return [];
  return Object.values(sharedWith).map((entry) => entry.email);
};

/**
 * Modal for managing list sharing.
 * @param {Object} props
 * @param {Object} props.list - The list object (must include sharedWith, ownerEmail)
 * @param {Function} props.onShare - Called with (listId, email) to share
 * @param {Function} props.onUnshare - Called with (listId, email) to revoke
 * @param {Function} props.onClose - Called to close the modal
 */
export const ShareListModal = ({ list, onShare, onUnshare, onClose }) => {
  const [email, setEmail] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState(null);

  const collaborators = getCollaboratorEmails(list.sharedWith);

  const handleShare = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address');
      return;
    }

    // Can't share with yourself
    if (trimmed === list.ownerEmail?.toLowerCase()) {
      setError('You already own this list');
      return;
    }

    // Already shared
    if (collaborators.includes(trimmed)) {
      setError('This person already has access');
      return;
    }

    setError(null);
    setIsSharing(true);
    try {
      await onShare(list.id, trimmed);
      setEmail('');
    } catch (err) {
      setError(`Failed to share: ${err.message}`);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRemove = async (collaboratorEmail) => {
    try {
      await onUnshare(list.id, collaboratorEmail);
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
      aria-label={`Share "${list.name}"`}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Share &ldquo;{list.name}&rdquo;</h3>
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
            <span className={styles.personEmail}>{list.ownerEmail ?? 'You'}</span>
            <span className={styles.ownerBadge}>Owner</span>
          </div>

          {collaborators.length === 0 ? (
            <p className={styles.emptyMsg}>No one else has access yet.</p>
          ) : (
            collaborators.map((collab) => (
              <div key={collab} className={styles.person}>
                <span className={styles.personEmail}>{collab}</span>
                <button
                  className={styles.removeBtn}
                  onClick={() => handleRemove(collab)}
                  aria-label={`Remove ${collab}`}
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

ShareListModal.propTypes = {
  list: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    ownerEmail: PropTypes.string,
    sharedWith: PropTypes.object,
  }).isRequired,
  onShare: PropTypes.func.isRequired,
  onUnshare: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
