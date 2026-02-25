/**
 * Emoji picker for selecting a list icon.
 * On desktop: custom emoji grid picker with search and categories.
 * On mobile: native text input that invokes the OS emoji keyboard.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useIsMobile } from '../hooks/useIsMobile';
import { DesktopEmojiPicker } from './DesktopEmojiPicker.jsx';
import styles from './EmojiPicker.module.css';

const extractEmoji = (str) => {
  const emojiRegex = /(?:\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)/u;
  const match = str.match(emojiRegex);
  return match ? match[0] : null;
};

/**
 * @param {{ value: string|null, onSelect: (emoji: string|null) => void }} props
 */
export const EmojiPicker = ({ value, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState(null);
  const triggerRef = useRef(null);
  const mobileInputRef = useRef(null);
  const isMobile = useIsMobile();

  const handleOpen = () => {
    if (!isOpen && triggerRef.current) {
      setTriggerRect(triggerRef.current.getBoundingClientRect());
    }
    setIsOpen(!isOpen);
  };

  const handleMobileInput = useCallback((e) => {
    const emoji = extractEmoji(e.target.value);
    if (emoji) {
      onSelect(emoji);
      setIsOpen(false);
    } else {
      e.target.value = '';
    }
  }, [onSelect]);

  const handleMobileBlur = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (isOpen && isMobile && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  }, [isOpen, isMobile]);

  return (
    <div className={styles.container}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={handleOpen}
        aria-label="Pick emoji icon"
      >
        {value || '😀'}
      </button>

      {isOpen && isMobile && (
        <div className={styles.mobileDropdown}>
          <input
            ref={mobileInputRef}
            type="text"
            inputMode="text"
            className={styles.mobileInput}
            placeholder="Tap 😊 on keyboard"
            onChange={handleMobileInput}
            onBlur={handleMobileBlur}
            aria-label="Select emoji from keyboard"
          />
        </div>
      )}

      {isOpen && !isMobile && triggerRect && (
        <DesktopEmojiPicker
          triggerRect={triggerRect}
          onSelect={(emoji) => {
            onSelect(emoji);
            setIsOpen(false);
          }}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

EmojiPicker.propTypes = {
  value: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};
