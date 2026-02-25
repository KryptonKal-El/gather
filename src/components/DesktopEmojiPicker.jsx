/**
 * Desktop emoji picker with search, categories, and emoji grid.
 * Renders via portal to escape overflow containers.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { EMOJI_DATA, CATEGORIES } from './emojiData.js';
import styles from './DesktopEmojiPicker.module.css';

/**
 * @param {{
 *   triggerRect: DOMRect,
 *   onSelect: (emoji: string) => void,
 *   onClose: () => void
 * }} props
 */
export const DesktopEmojiPicker = ({ triggerRect, onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('food');
  const searchRef = useRef(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filteredEmojis = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (query) {
      return EMOJI_DATA.filter((e) => e.name.toLowerCase().includes(query));
    }
    return EMOJI_DATA.filter((e) => e.category === activeCategory);
  }, [search, activeCategory]);

  const handleEmojiClick = (emoji) => {
    onSelect(emoji);
    onClose();
  };

  const pickerHeight = 400;
  const pickerWidth = 320;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  const spaceBelow = viewportHeight - triggerRect.bottom;
  const showAbove = spaceBelow < pickerHeight && triggerRect.top > pickerHeight;

  const top = showAbove
    ? triggerRect.top - pickerHeight - 4
    : triggerRect.bottom + 4;

  let left = triggerRect.left;
  if (left + pickerWidth > viewportWidth - 8) {
    left = viewportWidth - pickerWidth - 8;
  }
  if (left < 8) {
    left = 8;
  }

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div
        ref={pickerRef}
        className={styles.picker}
        style={{ top: `${top}px`, left: `${left}px` }}
      >
        <div className={styles.searchWrap}>
          <input
            ref={searchRef}
            type="text"
            className={styles.searchInput}
            placeholder="Search emojis..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {!search && (
          <div className={styles.categories}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`${styles.categoryBtn} ${activeCategory === cat.id ? styles.categoryBtnActive : ''}`}
                onClick={() => setActiveCategory(cat.id)}
                title={cat.label}
              >
                {cat.icon}
              </button>
            ))}
          </div>
        )}

        <div className={styles.grid}>
          {filteredEmojis.length > 0 ? (
            filteredEmojis.map((item) => (
              <button
                key={item.emoji}
                type="button"
                className={styles.emojiBtn}
                onClick={() => handleEmojiClick(item.emoji)}
                title={item.name}
              >
                {item.emoji}
              </button>
            ))
          ) : (
            <div className={styles.emptyMsg}>No emojis found</div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

DesktopEmojiPicker.propTypes = {
  triggerRect: PropTypes.shape({
    top: PropTypes.number.isRequired,
    bottom: PropTypes.number.isRequired,
    left: PropTypes.number.isRequired,
    right: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
  }).isRequired,
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
