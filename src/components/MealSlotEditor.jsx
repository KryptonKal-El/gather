/**
 * MealSlotEditor — modal for choosing what goes in one meal slot:
 * a recipe, another meal, leftovers, eating out, or skip, plus an optional note.
 */
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { ENTRY_KINDS } from '../utils/mealPlan.js';
import styles from './MealSlotEditor.module.css';

/**
 * @param {Object} props
 * @param {string} props.heading - e.g. "Wed Dinner"
 * @param {string} props.mealLabel - e.g. "Dinner"
 * @param {Object|null} props.entry - The slot's current entry, if any
 * @param {Array<{id: string, name: string, lastCookedAt?: string}>} props.recipes - Plannable recipes
 * @param {Function} props.onSave - Called with ({kind, recipe, title, note}); resolves to whether it saved
 * @param {Function} props.onClear - Clears the slot
 * @param {Function} props.onViewRecipe - Called with a recipe id
 * @param {Function} props.onClose
 */
export const MealSlotEditor = ({ heading, mealLabel, entry, recipes, onSave, onClear, onViewRecipe, onClose }) => {
  const [kind, setKind] = useState(entry?.kind ?? 'recipe');
  const [recipeId, setRecipeId] = useState(entry?.kind === 'recipe' ? entry.recipeId : null);
  const [customTitle, setCustomTitle] = useState(entry?.kind === 'custom' ? entry.title ?? '' : '');
  const [note, setNote] = useState(entry?.note ?? '');
  const [query, setQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filteredRecipes = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return recipes;
    return recipes.filter((r) => r.name.toLowerCase().includes(trimmed));
  }, [recipes, query]);

  const selectedRecipe = recipes.find((r) => r.id === recipeId) ?? null;
  const canSave =
    (kind === 'recipe' && selectedRecipe) ||
    (kind === 'custom' && customTitle.trim()) ||
    !['recipe', 'custom'].includes(kind);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave || isSaving) return;
    setIsSaving(true);
    const saved = await onSave({ kind, recipe: selectedRecipe, title: customTitle, note });
    setIsSaving(false);
    if (saved) onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div className={styles.backdrop} onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label={heading}>
      <form className={styles.modal} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <h3 className={styles.title}>{heading}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <fieldset className={styles.kinds}>
          <legend className={styles.label}>What&apos;s for {mealLabel.toLowerCase()}?</legend>
          {ENTRY_KINDS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`${styles.kindBtn} ${kind === option.id ? styles.kindBtnActive : ''}`}
              aria-pressed={kind === option.id}
              onClick={() => setKind(option.id)}
            >
              <span aria-hidden="true">{option.icon}</span> {option.label}
            </button>
          ))}
        </fieldset>

        {kind === 'recipe' && (
          <div className={styles.section}>
            <input
              className={styles.input}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes..."
              aria-label="Search recipes"
            />
            <ul className={styles.recipeList} role="listbox" aria-label="Recipes">
              {recipes.length === 0 && <li className={styles.empty}>Add recipes in the Recipes tab to plan them here.</li>}
              {recipes.length > 0 && filteredRecipes.length === 0 && <li className={styles.empty}>No recipes match.</li>}
              {filteredRecipes.map((recipe) => (
                <li key={recipe.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={recipe.id === recipeId}
                    className={`${styles.recipeOption} ${recipe.id === recipeId ? styles.recipeOptionActive : ''}`}
                    onClick={() => setRecipeId(recipe.id)}
                  >
                    <span className={styles.recipeName}>{recipe.name}</span>
                    {recipe.lastCookedAt && (
                      <span className={styles.recipeMeta}>
                        Last made {new Date(recipe.lastCookedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {kind === 'custom' && (
          <div className={styles.section}>
            <label className={styles.label} htmlFor="meal-slot-custom">Meal</label>
            <input
              id="meal-slot-custom"
              className={styles.input}
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g. Sandwiches"
              autoFocus
            />
          </div>
        )}

        <div className={styles.section}>
          <label className={styles.label} htmlFor="meal-slot-note">Note</label>
          <input
            id="meal-slot-note"
            className={styles.input}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </div>

        {entry && (
          <div className={styles.secondaryActions}>
            {entry.kind === 'recipe' && entry.recipeId && (
              <button type="button" className={styles.linkBtn} onClick={() => onViewRecipe(entry.recipeId)}>
                View recipe
              </button>
            )}
            <button
              type="button"
              className={`${styles.linkBtn} ${styles.dangerLink}`}
              onClick={async () => {
                await onClear();
                onClose();
              }}
            >
              Clear meal
            </button>
          </div>
        )}

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.saveBtn} disabled={!canSave || isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
};

MealSlotEditor.propTypes = {
  heading: PropTypes.string.isRequired,
  mealLabel: PropTypes.string.isRequired,
  entry: PropTypes.shape({
    kind: PropTypes.string.isRequired,
    recipeId: PropTypes.string,
    title: PropTypes.string,
    note: PropTypes.string,
  }),
  recipes: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    lastCookedAt: PropTypes.string,
  })).isRequired,
  onSave: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  onViewRecipe: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
