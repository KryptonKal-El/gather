import PropTypes from 'prop-types';
import styles from './ProUpgradeNotice.module.css';

/**
 * Inline notice that something needs Gather Lists Pro. Subscribing isn't
 * possible on the web yet, so it points to the iPhone app instead of a button.
 * @param {Object} props
 * @param {string} props.title
 * @param {string} props.message
 * @param {boolean} [props.showsUpgradeHint=true] - False where the viewer can't fix it by subscribing, e.g. someone else's plan
 */
export const ProUpgradeNotice = ({ title, message, showsUpgradeHint = true }) => (
  <div className={styles.notice} role="status">
    <p className={styles.title}>
      <svg className={styles.icon} viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path d="M17 10V7a5 5 0 0 0-10 0v3H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1Zm-8 0V7a3 3 0 0 1 6 0v3H9Z" />
      </svg>
      {title}
    </p>
    <p className={styles.message}>{message}</p>
    {showsUpgradeHint && (
      <p className={styles.hint}>Subscribe in the Gather Lists app on your iPhone. It unlocks here too.</p>
    )}
  </div>
);

ProUpgradeNotice.propTypes = {
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  showsUpgradeHint: PropTypes.bool,
};
