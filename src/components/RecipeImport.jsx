import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import styles from './RecipeImport.module.css';
import { parseRecipeFromText } from '../services/recipes.js';

/**
 * Step 1 of the "Import from Text" flow: a full-screen paste view. The user
 * pastes (or types) raw recipe text and taps Next, which runs the AI parser.
 * The structured result is handed back via onParsed so the caller can open the
 * editable recipe form pre-filled with it for review before importing.
 */
export const RecipeImport = ({ onParsed, onCancel }) => {
  const [text, setText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [pasteError, setPasteError] = useState('');
  const textareaRef = useRef(null);

  const handlePaste = async () => {
    setPasteError('');
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) {
        setText(clip);
        textareaRef.current?.focus();
      }
    } catch {
      setPasteError('Clipboard access was blocked. Paste into the box manually instead.');
    }
  };

  const handleNext = async () => {
    if (!text.trim() || isParsing) return;
    setIsParsing(true);
    try {
      const parsed = await parseRecipeFromText(text);
      onParsed(parsed);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className={styles.container}>
      <nav className={styles.navBar}>
        <button
          type="button"
          className={styles.backButton}
          onClick={onCancel}
          disabled={isParsing}
          aria-label="Back"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className={styles.navTitle}>Import from Text</h1>
        <button
          type="button"
          className={styles.nextButton}
          onClick={handleNext}
          disabled={!text.trim() || isParsing}
        >
          {isParsing ? 'Reading…' : 'Next'}
        </button>
      </nav>

      <div className={styles.scrollArea}>
        <p className={styles.hint}>
          Paste a whole recipe — the ingredients and steps are detected
          automatically. You can review and edit everything on the next screen
          before importing.
        </p>

        <button
          type="button"
          className={styles.pasteBtn}
          onClick={handlePaste}
          disabled={isParsing}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
          Paste from clipboard
        </button>
        {pasteError && <p className={styles.pasteError}>{pasteError}</p>}

        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Grandma's Chili\n\nIngredients\n2 cups flour\n1 lb ground beef\n3 cloves garlic, minced\n\nInstructions\n1. Brown the beef in a large pot.\n2. Add the garlic and cook until fragrant.\n3. Stir in the remaining ingredients and simmer 30 minutes."}
          disabled={isParsing}
          autoFocus
        />
      </div>

      {isParsing && (
        <div className={styles.parsingOverlay}>
          <div className={styles.spinner} />
          <p className={styles.parsingText}>Reading your recipe…</p>
        </div>
      )}
    </div>
  );
};

RecipeImport.propTypes = {
  onParsed: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
