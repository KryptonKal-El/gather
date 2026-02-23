/**
 * Emoji picker for selecting a list icon.
 * Uses emoji-mart for the full native emoji set with search, categories, and skin tones.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import data from '@emoji-mart/data';
import { Picker } from 'emoji-mart';
import styles from './EmojiPicker.module.css';

/**
 * @param {{ value: string|null, onSelect: (emoji: string|null) => void }} props
 */
export const EmojiPicker = ({ value, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const pickerRef = useRef(null);

  const handleSelect = useCallback((emoji) => {
    onSelect(emoji.native);
    setIsOpen(false);
  }, [onSelect]);

  const handleClear = useCallback(() => {
    onSelect(null);
    setIsOpen(false);
  }, [onSelect]);

  // Mount/unmount emoji-mart picker
  useEffect(() => {
    if (!isOpen || !pickerRef.current) return;

    // Clear previous picker content
    pickerRef.current.innerHTML = '';

    const picker = new Picker({
      data,
      onEmojiSelect: handleSelect,
      theme: 'auto',
      set: 'native',
      previewPosition: 'none',
      skinTonePosition: 'search',
      autoFocus: true,
      perLine: 8,
      maxFrequentRows: 2,
    });

    pickerRef.current.appendChild(picker);

    return () => {
      if (pickerRef.current) {
        pickerRef.current.innerHTML = '';
      }
    };
  }, [isOpen, handleSelect]);

  // Close on outside click
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
          <div ref={pickerRef} />
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
