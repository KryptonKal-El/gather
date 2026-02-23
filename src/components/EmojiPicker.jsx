/**
 * Compact emoji picker for selecting a list icon.
 * Displays a categorized grid of emojis with search filtering.
 */
import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './EmojiPicker.module.css';

const EMOJI_GROUPS = [
  {
    label: 'Food & Drink',
    emojis: [
      '🛒', '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍑',
      '🥑', '🥦', '🥕', '🌽', '🥬', '🍅', '🥒', '🌶️', '🧅', '🧄',
      '🍞', '🥖', '🧀', '🥚', '🥩', '🍗', '🐟', '🥛', '🧈', '🍕',
      '🍔', '🌮', '🍣', '🍜', '🥗', '🍰', '🧁', '🍪', '🍫', '☕',
    ],
  },
  {
    label: 'Home & Life',
    emojis: [
      '🏠', '🏡', '🧹', '🧺', '🧴', '🪥', '🧼', '🧽', '🪣', '💡',
      '🛁', '🚿', '🛏️', '🪴', '🌻', '🐶', '🐱', '👶', '👨‍👩‍👧', '💊',
    ],
  },
  {
    label: 'Activities',
    emojis: [
      '🎉', '🎂', '🎄', '🎃', '🏖️', '✈️', '🏕️', '🎒', '⛺', '🧳',
      '💪', '🏃', '⚽', '🎮', '📚', '🎵', '🎨', '📝', '💼', '🔧',
    ],
  },
  {
    label: 'Symbols',
    emojis: [
      '⭐', '❤️', '💚', '💙', '💜', '🧡', '💛', '🤍', '🖤', '✅',
      '📌', '🔥', '💎', '🏷️', '📋', '🗓️', '⏰', '🎯', '🚀', '💡',
    ],
  },
];

/** @type {string[]} */
const ALL_EMOJIS = EMOJI_GROUPS.flatMap((g) => g.emojis);

/**
 * @param {{ value: string|null, onSelect: (emoji: string|null) => void }} props
 */
export const EmojiPicker = ({ value, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (emoji) => {
    onSelect(emoji);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    onSelect(null);
    setIsOpen(false);
    setSearch('');
  };

  const filteredGroups = search
    ? [{ label: 'Results', emojis: ALL_EMOJIS.filter((e) => e.includes(search)) }]
    : EMOJI_GROUPS;

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Pick emoji icon"
      >
        {value || '😀'}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <input
            type="text"
            className={styles.search}
            placeholder="Search emoji..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />

          <div className={styles.grid}>
            {filteredGroups.map((group) => (
              <div key={group.label}>
                <p className={styles.groupLabel}>{group.label}</p>
                <div className={styles.emojis}>
                  {group.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={`${styles.emojiBtn} ${emoji === value ? styles.selected : ''}`}
                      onClick={() => handleSelect(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {filteredGroups.length === 1 && filteredGroups[0].emojis.length === 0 && (
              <p className={styles.noResults}>No emoji found</p>
            )}
          </div>

          {value && (
            <button type="button" className={styles.clearBtn} onClick={handleClear}>
              Remove icon
            </button>
          )}
        </div>
      )}
    </div>
  );
};

EmojiPicker.propTypes = {
  value: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};
