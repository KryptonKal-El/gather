import { useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './Toast.module.css';

const EXIT_DURATION_MS = 180;

/**
 * Toast notification item with timed dismissal and exit animation.
 *
 * @param {Object} props - Component props
 * @param {string} props.message - Toast message text
 * @param {'success'|'error'} props.variant - Visual and accessibility variant
 * @param {number} props.durationMs - Auto-dismiss delay in milliseconds
 * @param {boolean} props.isVisible - Whether the toast is in its entered state
 * @param {Function} props.onDismiss - Called when the toast should start dismissing
 * @param {Function} props.onExited - Called after the exit transition completes
 * @returns {JSX.Element}
 */
export const Toast = ({ message, variant = 'success', durationMs, isVisible, onDismiss, onExited }) => {
  useEffect(() => {
    if (!isVisible) return undefined;

    const timer = window.setTimeout(() => {
      onDismiss();
    }, durationMs);

    return () => window.clearTimeout(timer);
  }, [durationMs, isVisible, onDismiss]);

  useEffect(() => {
    if (isVisible) return undefined;

    const timer = window.setTimeout(() => {
      onExited();
    }, EXIT_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [isVisible, onExited]);

  const handleDismissClick = (event) => {
    event.stopPropagation();
    onDismiss();
  };

  const role = variant === 'error' ? 'alert' : 'status';
  const ariaLive = variant === 'error' ? 'assertive' : 'polite';
  const className = [styles.toast, styles[variant], !isVisible ? styles.hidden : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
      onClick={onDismiss}
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.message}>{message}</span>
      <button
        type="button"
        className={styles.dismissButton}
        aria-label="Dismiss notification"
        onClick={handleDismissClick}
      >
        ✕
      </button>
    </div>
  );
};

Toast.propTypes = {
  message: PropTypes.string.isRequired,
  variant: PropTypes.oneOf(['success', 'error']),
  durationMs: PropTypes.number.isRequired,
  isVisible: PropTypes.bool.isRequired,
  onDismiss: PropTypes.func.isRequired,
  onExited: PropTypes.func.isRequired,
};

