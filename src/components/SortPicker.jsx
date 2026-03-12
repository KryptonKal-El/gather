import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { SortLevelEditor } from './SortLevelEditor.jsx';
import styles from './SortPicker.module.css';

/**
 * Drag-to-reorder sort level editor with popover UI.
 * Allows adding, removing, and reordering up to 3 sort levels.
 */
export const SortPicker = ({ currentConfig, hasOverride, onSelect, listType = 'grocery' }) => {
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
          <div className={styles.header}>Sort Levels</div>
          <SortLevelEditor
            config={currentConfig}
            onConfigChange={onSelect}
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
