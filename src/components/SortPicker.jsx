import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { SortLevelEditor } from './SortLevelEditor.jsx';
import styles from './SortPicker.module.css';

/**
 * Drag-to-reorder sort level editor with popover UI.
 * Supports up to 4 total levels: 2 grouping levels and 2 sort-only levels.
 */
export const SortPicker = ({ currentConfig, hasOverride, onSelect, listType = 'grocery' }) => {
  const [open, setOpen] = useState(false);
  const [optimisticConfig, setOptimisticConfig] = useState(null);
  const containerRef = useRef(null);

  // Clear optimistic state when real config arrives from server
  useEffect(() => {
    setOptimisticConfig(null);
  }, [currentConfig]);

  const displayConfig = optimisticConfig ?? currentConfig;

  const handleConfigChange = (newConfig) => {
    setOptimisticConfig(newConfig);
    onSelect(newConfig);
  };

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

  const handleUseDefault = () => {
    onSelect(null);
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
        <div className={styles.popover}>
          <SortLevelEditor
            config={displayConfig}
            onConfigChange={handleConfigChange}
            listType={listType}
          />

          {hasOverride && (
            <>
              <div className={styles.divider} />
              <button
                type="button"
                className={styles.useDefault}
                onClick={handleUseDefault}
              >
                Use Default
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

SortPicker.propTypes = {
  currentConfig: PropTypes.arrayOf(PropTypes.string).isRequired,
  hasOverride: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  listType: PropTypes.string,
};
