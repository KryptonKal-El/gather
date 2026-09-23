/**
 * RecipeAttributesEditor — modal for editing a recipe's planner details.
 * Changed fields are recorded as set by hand so iOS auto-tagging keeps them.
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { MEAL_TYPES } from '../utils/mealPlan.js';
import { COURSES, PROTEINS, CUISINES, EFFORTS, METHODS, markManualEdits } from '../utils/recipeAttributes.js';
import styles from './RecipeAttributesEditor.module.css';

const SELECTS = [
  { field: 'course', label: 'Course', options: COURSES },
  { field: 'protein', label: 'Main protein', options: PROTEINS },
  { field: 'cuisine', label: 'Cuisine', options: CUISINES },
  { field: 'effort', label: 'Effort', options: EFFORTS },
  { field: 'method', label: 'Method', options: METHODS },
];

/**
 * @param {Object} props
 * @param {string} props.recipeName
 * @param {Object} props.attributes - Current attributes (or an empty set)
 * @param {Function} props.onSave - Called with updated attributes; resolves when saved
 * @param {Function} props.onClose
 */
export const RecipeAttributesEditor = ({ recipeName, attributes, onSave, onClose }) => {
  const [draft, setDraft] = useState(attributes);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleMeal = (mealId) => {
    setDraft((prev) => {
      const meals = new Set(prev.mealTypes);
      if (meals.has(mealId)) meals.delete(mealId);
      else meals.add(mealId);
      return { ...prev, mealTypes: MEAL_TYPES.map((m) => m.id).filter((id) => meals.has(id)) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await onSave(markManualEdits(attributes, draft));
      onClose();
    } catch (err) {
      console.error('[RecipeAttributesEditor] Failed to save:', err);
      setError("Couldn't save. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const kidValue = draft.kidFriendly === null || draft.kidFriendly === undefined ? '' : String(draft.kidFriendly);

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${recipeName}`}
    >
      <form className={styles.modal} onSubmit={handleSubmit}>
        <h3 className={styles.title}>{recipeName}</h3>

        <fieldset className={styles.meals}>
          <legend className={styles.label}>Good for</legend>
          {MEAL_TYPES.map((meal) => (
            <label key={meal.id} className={styles.check}>
              <input type="checkbox" checked={draft.mealTypes.includes(meal.id)} onChange={() => toggleMeal(meal.id)} />
              {meal.label}
            </label>
          ))}
          <p className={styles.hint}>The Plan tab only suggests this recipe for these meals.</p>
        </fieldset>

        {SELECTS.map(({ field, label, options }) => (
          <label key={field} className={styles.row}>
            <span className={styles.label}>{label}</span>
            <select
              className={styles.select}
              value={draft[field] ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, [field]: e.target.value || null }))}
            >
              <option value="">Not set</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        ))}

        <label className={styles.row}>
          <span className={styles.label}>Kid-friendly</span>
          <select
            className={styles.select}
            value={kidValue}
            onChange={(e) => setDraft((prev) => ({ ...prev, kidFriendly: e.target.value === '' ? null : e.target.value === 'true' }))}
          >
            <option value="">Not set</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.saveBtn} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
};

RecipeAttributesEditor.propTypes = {
  recipeName: PropTypes.string.isRequired,
  attributes: PropTypes.shape({
    recipeId: PropTypes.string.isRequired,
    mealTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
    manualFields: PropTypes.arrayOf(PropTypes.string).isRequired,
  }).isRequired,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
