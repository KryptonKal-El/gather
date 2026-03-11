import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { SORT_MODES } from '../services/preferences.js';
import styles from './SortPicker.module.css';

/**
 * Sort picker dropdown component.
 * Shows sort options in a popover with the current selection indicated.
 */
export const SortPicker = ({ currentMode, hasOverride, onSelect }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleSelect = (mode) => {
    onSelect(mode);
    setOpen(false);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-label="Sort items"
        aria-expanded={open}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 15l5 5 5-5" />
          <path d="M7 9l5-5 5 5" />
        </svg>
      </button>
      {open && (
        <div className={styles.dropdown}>
          {SORT_MODES.map((mode) => (
            <button
              key={mode.key}
              type="button"
              className={`${styles.option} ${currentMode === mode.key ? styles.active : ''}`}
              onClick={() => handleSelect(mode.key)}
            >
              <span className={styles.optionLabel}>{mode.label}</span>
              {currentMode === mode.key && (
                <svg className={styles.checkmark} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
          {hasOverride && (
            <>
              <div className={styles.divider} />
              <button
                type="button"
                className={styles.option}
                onClick={() => handleSelect(null)}
              >
                <span className={styles.optionLabel}>Use default</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

SortPicker.propTypes = {
  currentMode: PropTypes.string.isRequired,
  hasOverride: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
};
