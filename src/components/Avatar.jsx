import PropTypes from 'prop-types';
import styles from './Avatar.module.css';

/**
 * Circular avatar component that displays a profile image or falls back to
 * displaying the first initial of the user's display name.
 */
export const Avatar = ({ imageUrl, displayName, color = '#1565c0', size = 24 }) => {
  const initial = displayName?.charAt(0).toUpperCase() ?? '?';

  const containerStyle = {
    width: size,
    height: size,
    backgroundColor: imageUrl ? 'transparent' : color,
  };

  if (imageUrl) {
    return (
      <div className={styles.avatar} style={containerStyle}>
        <img src={imageUrl} alt={displayName} className={styles.image} />
      </div>
    );
  }

  return (
    <div className={styles.avatar} style={containerStyle}>
      <span className={styles.initial} style={{ fontSize: size * 0.45 }}>
        {initial}
      </span>
    </div>
  );
};

Avatar.propTypes = {
  imageUrl: PropTypes.string,
  displayName: PropTypes.string.isRequired,
  color: PropTypes.string,
  size: PropTypes.number,
};
