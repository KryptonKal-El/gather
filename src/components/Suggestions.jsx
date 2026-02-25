import { useState } from 'react';
import PropTypes from 'prop-types';
import { getAllCategoryColors } from '../utils/categories.js';
import styles from './Suggestions.module.css';

const CATEGORY_COLORS = getAllCategoryColors();
const COLLAPSED_LIMIT = 4;

/**
 * Displays AI-powered item suggestions.
 * Each suggestion shows the item name, reason, and an add button.
 * When collapsible is true, shows only 4 items initially with a toggle.
 */
export const Suggestions = ({ suggestions, onAdd, collapsible = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (suggestions.length === 0) {
    return null;
  }

  const shouldCollapse = collapsible && suggestions.length > COLLAPSED_LIMIT;
  const visibleSuggestions = shouldCollapse && !isExpanded
    ? suggestions.slice(0, COLLAPSED_LIMIT)
    : suggestions;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>AI Suggestions</h3>
      <p className={styles.subtitle}>Based on your shopping habits</p>
      <div className={styles.grid}>
        {visibleSuggestions.map((suggestion) => (
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
      {shouldCollapse && (
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Show less' : `Show ${suggestions.length - COLLAPSED_LIMIT} more`}
        </button>
      )}
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
  collapsible: PropTypes.bool,
};
