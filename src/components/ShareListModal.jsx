/**
 * ShareListModal — modal for sharing a list with other users by email.
 * Shows current collaborators with their role (editor/viewer) and allows
 * adding, removing, and changing roles. Only the list owner can use this modal.
 */
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { fetchListShares } from '../services/database.js';
import styles from './ShareListModal.module.css';

const ROLE_OPTIONS = [
  { value: 'editor', label: 'Can edit' },
  { value: 'viewer', label: 'Can view' },
];

/**
 * Modal for managing list sharing.
 * @param {Object} props
 * @param {Object} props.list - The list object (id, name, type, ownerEmail)
 * @param {Function} props.onShare - Called with (listId, email, role) to share
 * @param {Function} props.onUpdateRole - Called with (listId, email, role) to change access
 * @param {Function} props.onUnshare - Called with (listId, email) to revoke
 * @param {Function} props.onClose - Called to close the modal
 */
export const ShareListModal = ({ list, onShare, onUnshare, onUpdateRole, onClose }) => {
  const isWishList = list.type === 'wish_list';
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState(isWishList ? 'viewer' : 'editor');
  const [shares, setShares] = useState([]);
  const [isLoadingShares, setIsLoadingShares] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState(null);

  const collaborators = shares.map((share) => share.email);

  const loadShares = useCallback(async () => {
    try {
      setShares(await fetchListShares(list.id));
    } catch (err) {
      setError(`Couldn't load people with access: ${err.message}`);
    } finally {
      setIsLoadingShares(false);
    }
  }, [list.id]);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

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
      await onShare(list.id, trimmed, newRole);
      setEmail('');
      await loadShares();
    } catch (err) {
      setError(`Failed to share: ${err.message}`);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRemove = async (collaboratorEmail) => {
    const role = shares.find((share) => share.email === collaboratorEmail)?.role ?? 'editor';
    try {
      await onUnshare(list.id, collaboratorEmail, role);
      await loadShares();
    } catch (err) {
      setError(`Failed to remove: ${err.message}`);
    }
  };

  const handleRoleChange = async (collaboratorEmail, role) => {
    setShares((prev) => prev.map((share) => (share.email === collaboratorEmail ? { ...share, role } : share)));
    try {
      await onUpdateRole(list.id, collaboratorEmail, role);
    } catch (err) {
      setError(`Failed to change access: ${err.message}`);
      await loadShares();
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
          <select
            className={styles.roleSelect}
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            aria-label="Access for the new person"
            disabled={isSharing}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            className={styles.shareBtn}
            type="submit"
            disabled={!email.trim() || isSharing}
          >
            {isSharing ? 'Sharing...' : 'Share'}
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}

        {isWishList && (
          <p className={styles.hint}>
            People who can view can claim gifts without you seeing. Those who can edit can also change your list.
          </p>
        )}

        <div className={styles.collaborators}>
          <h4 className={styles.subTitle}>People with access</h4>

          <div className={styles.owner}>
            <span className={styles.personEmail}>{list.ownerEmail ?? 'You'}</span>
            <span className={styles.ownerBadge}>Owner</span>
          </div>

          {isLoadingShares ? (
            <p className={styles.emptyMsg}>Loading…</p>
          ) : shares.length === 0 ? (
            <p className={styles.emptyMsg}>No one else has access yet.</p>
          ) : (
            shares.map(({ email: collab, role }) => (
              <div key={collab} className={styles.person}>
                <span className={styles.personEmail}>{collab}</span>
                <select
                  className={styles.roleSelect}
                  value={role}
                  onChange={(e) => handleRoleChange(collab, e.target.value)}
                  aria-label={`Access for ${collab}`}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
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
    type: PropTypes.string,
  }).isRequired,
  onShare: PropTypes.func.isRequired,
  onUnshare: PropTypes.func.isRequired,
  onUpdateRole: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
