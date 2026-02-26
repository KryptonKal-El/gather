/**
 * Mobile settings screen styled as an iOS grouped table view.
 * Displays account info, dark mode toggle, and sign out action.
 */
import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { uploadProfileImage } from '../services/imageStorage.js';
import styles from './MobileSettings.module.css';

/**
 * Renders the mobile settings screen.
 * @param {Object} props
 * @param {Object} props.user - Firebase user object
 * @param {Function} props.onSignOut - Sign out callback
 */
export const MobileSettings = ({ user, onSignOut }) => {
  const { theme, toggleTheme } = useTheme();
  const { refreshUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const isDark = theme === 'dark';
  const isGuest = user?.isAnonymous ?? true;

  const displayName = isGuest ? 'Guest' : (user?.displayName ?? 'User');
  const email = isGuest ? null : (user?.email ?? '');
  const avatarLetter = isGuest ? 'G' : (displayName.charAt(0).toUpperCase() || 'U');
  const photoURL = user?.photoURL;

  const handleAvatarClick = () => {
    if (isGuest || isUploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      await uploadProfileImage(user, file);
      await refreshUser();
    } catch (err) {
      console.error('Profile image upload failed:', err);
      setUploadError('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.sectionHeader}>Account</h3>
      <div className={styles.section}>
        <div className={styles.accountRow}>
          <div
            className={`${styles.avatar} ${!isGuest ? styles.avatarTappable : ''}`}
            onClick={handleAvatarClick}
            role={!isGuest ? 'button' : undefined}
            tabIndex={!isGuest ? 0 : undefined}
            aria-label={!isGuest ? 'Change profile photo' : undefined}
            onKeyDown={!isGuest ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleAvatarClick(); } : undefined}
          >
            {isUploading ? (
              <div className={styles.uploadSpinner} />
            ) : photoURL ? (
              <img src={photoURL} alt="" className={styles.avatarImage} />
            ) : (
              avatarLetter
            )}
            {!isGuest && !isUploading && (
              <div className={styles.avatarOverlay}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            )}
          </div>
          {!isGuest && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className={styles.hiddenInput}
              onChange={handleFileChange}
              aria-hidden="true"
              tabIndex={-1}
            />
          )}
          <div className={styles.accountInfo}>
            <span className={styles.displayName}>{displayName}</span>
            {email && <span className={styles.email}>{email}</span>}
            {isGuest && <span className={styles.email}>Anonymous user</span>}
          </div>
        </div>
        {uploadError && (
          <div className={styles.uploadError}>
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      <h3 className={styles.sectionHeader}>Appearance</h3>
      <div className={styles.section}>
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Dark Mode</span>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={isDark}
              onChange={toggleTheme}
              aria-label="Toggle dark mode"
            />
            <span className={styles.toggleTrack} />
          </label>
        </div>
      </div>

      <h3 className={styles.sectionHeader}>Account Actions</h3>
      <div className={styles.section}>
        {isGuest && (
          <div className={styles.infoRow}>
            <span className={styles.infoIcon}>ℹ️</span>
            <span className={styles.infoText}>Sign in to sync across devices</span>
          </div>
        )}
        <button
          type="button"
          className={styles.destructiveRow}
          onClick={onSignOut}
        >
          <span className={styles.destructiveText}>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

MobileSettings.propTypes = {
  user: PropTypes.shape({
    uid: PropTypes.string,
    displayName: PropTypes.string,
    email: PropTypes.string,
    isAnonymous: PropTypes.bool,
    photoURL: PropTypes.string,
  }),
  onSignOut: PropTypes.func.isRequired,
};
