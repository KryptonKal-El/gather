import PropTypes from 'prop-types';
import { Avatar } from './Avatar';
import styles from './AvatarGroup.module.css';

/**
 * Displays a group of overlapping avatars with an overflow indicator
 * when there are more collaborators than maxDisplay.
 */
export const AvatarGroup = ({ collaborators, maxDisplay = 3, size = 24, color = '#1565c0' }) => {
  if (!collaborators?.length) return null;

  const visible = collaborators.slice(0, maxDisplay);
  const overflow = collaborators.length - maxDisplay;
  const overlap = Math.round(size * -0.33);
  const borderWidth = 2;

  return (
    <div className={styles.group}>
      {visible.map((collab, i) => (
        <div
          key={collab.user_id}
          className={styles.avatarWrapper}
          style={{
            marginLeft: i === 0 ? 0 : overlap,
            zIndex: i,
            border: `${borderWidth}px solid var(--bg-card)`,
          }}
        >
          <Avatar
            imageUrl={collab.avatar_url}
            displayName={collab.display_name}
            color={color}
            size={size}
          />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={styles.overflow}
          style={{
            marginLeft: overlap,
            zIndex: visible.length,
            width: size + borderWidth * 2,
            height: size + borderWidth * 2,
            fontSize: size * 0.38,
            border: `${borderWidth}px solid var(--bg-card)`,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};

AvatarGroup.propTypes = {
  collaborators: PropTypes.arrayOf(
    PropTypes.shape({
      user_id: PropTypes.string.isRequired,
      display_name: PropTypes.string.isRequired,
      avatar_url: PropTypes.string,
    })
  ).isRequired,
  maxDisplay: PropTypes.number,
  size: PropTypes.number,
  color: PropTypes.string,
};
