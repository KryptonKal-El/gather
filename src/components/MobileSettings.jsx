/**
 * Mobile settings screen styled as an iOS grouped table view.
 * Displays account info, dark mode toggle, and sign out action.
 */
import PropTypes from 'prop-types';
import { useTheme } from '../context/ThemeContext.jsx';
import styles from './MobileSettings.module.css';

/**
 * Renders the mobile settings screen.
 * @param {Object} props
 * @param {Object} props.user - Firebase user object
 * @param {Function} props.onSignOut - Sign out callback
 */
export const MobileSettings = ({ user, onSignOut }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const isGuest = user?.isAnonymous ?? true;

  const displayName = isGuest ? 'Guest' : (user?.displayName ?? 'User');
  const email = isGuest ? null : (user?.email ?? '');
  const avatarLetter = isGuest ? 'G' : (displayName.charAt(0).toUpperCase() || 'U');
  const photoURL = user?.photoURL;

  return (
    <div className={styles.container}>
      <h3 className={styles.sectionHeader}>Account</h3>
      <div className={styles.section}>
        <div className={styles.accountRow}>
          <div className={styles.avatar}>
            {photoURL ? (
              <img src={photoURL} alt="" className={styles.avatarImage} />
            ) : (
              avatarLetter
            )}
          </div>
          <div className={styles.accountInfo}>
            <span className={styles.displayName}>{displayName}</span>
            {email && <span className={styles.email}>{email}</span>}
            {isGuest && <span className={styles.email}>Anonymous user</span>}
          </div>
        </div>
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
