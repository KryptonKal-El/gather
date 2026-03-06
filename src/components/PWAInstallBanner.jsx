import { useState } from 'react';
import PropTypes from 'prop-types';
import styles from './PWAInstallBanner.module.css';

/**
 * PWA install banner that shows platform-appropriate install instructions.
 * Android: Shows install button that triggers beforeinstallprompt.
 * iOS: Shows instructional message with share icon.
 */
export const PWAInstallBanner = ({ showBanner, platform, onInstall, onDismiss }) => {
  const [isDismissing, setIsDismissing] = useState(false);

  if (!showBanner) return null;

  const handleDismiss = () => {
    setIsDismissing(true);
  };

  const handleAnimationEnd = () => {
    if (isDismissing) {
      onDismiss();
    }
  };

  const bannerClass = isDismissing
    ? `${styles.banner} ${styles.bannerExit}`
    : `${styles.banner} ${styles.bannerEnter}`;

  return (
    <div className={bannerClass} onAnimationEnd={handleAnimationEnd}>
      <img
        src="/icon-192x192.png"
        alt="App icon"
        className={styles.icon}
        width={32}
        height={32}
      />

      {platform === 'android' && (
        <>
          <span className={styles.message}>
            Add Gather Lists to your home screen — Gather your lists, meals, and more.
          </span>
          <button type="button" className={styles.installBtn} onClick={onInstall}>
            Install
          </button>
        </>
      )}

      {platform === 'ios' && (
        <span className={styles.message}>
          Install Gather Lists: tap{' '}
          <svg
            className={styles.shareIcon}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label="Share icon"
          >
            <path d="M12 2v13" />
            <path d="M17 7l-5-5-5 5" />
            <rect x="4" y="11" width="16" height="11" rx="2" />
          </svg>{' '}
          then &quot;Add to Home Screen&quot;
        </span>
      )}

      <button
        type="button"
        className={styles.dismissBtn}
        onClick={handleDismiss}
        aria-label="Dismiss install banner"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

PWAInstallBanner.propTypes = {
  showBanner: PropTypes.bool.isRequired,
  platform: PropTypes.oneOf(['android', 'ios', null]).isRequired,
  onInstall: PropTypes.func.isRequired,
  onDismiss: PropTypes.func.isRequired,
};
