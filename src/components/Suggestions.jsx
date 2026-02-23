import PropTypes from 'prop-types';
import { getAllCategoryColors } from '../utils/categories.js';

const CATEGORY_COLORS = getAllCategoryColors();
import styles from './Suggestions.module.css';

/**
 * Displays AI-powered item suggestions.
 * Each suggestion shows the item name, reason, and an add button.
 */
export const Suggestions = ({ suggestions, onAdd }) => {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>AI Suggestions</h3>
      <p className={styles.subtitle}>Based on your shopping habits</p>
      <div className={styles.grid}>
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.name}
            className={styles.chip}
            onClick={() => onAdd(suggestion.name)}
          >
            <span
              className={styles.dot}
              style={{ backgroundColor: CATEGORY_COLORS[suggestion.category] ?? '#9e9e9e' }}
            />
            <span className={styles.name}>{suggestion.name}</span>
            <span className={styles.reason}>{suggestion.reason}</span>
            <span className={styles.addIcon}>+</span>
          </button>
        ))}
      </div>
    </div>
  );
};

Suggestions.propTypes = {
  suggestions: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      reason: PropTypes.string.isRequired,
      category: PropTypes.string.isRequired,
    })
  ).isRequired,
  onAdd: PropTypes.func.isRequired,
};
