/**
 * RecipeAttributesSection — shows a recipe's planner details as chips, with an
 * Edit/Add button for people who can edit the recipe. On the web the details are
 * view/edit only; automatic tagging runs on iPhone.
 */
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { fetchRecipeAttributes, saveRecipeAttributes } from '../services/recipeAttributesDatabase.js';
import { attributeChips, emptyAttributes } from '../utils/recipeAttributes.js';
import { RecipeAttributesEditor } from './RecipeAttributesEditor.jsx';
import styles from './RecipeAttributesSection.module.css';

/**
 * @param {Object} props
 * @param {string} props.recipeId
 * @param {string} props.recipeName
 * @param {boolean} props.canEdit
 * @param {string} props.userId
 */
export const RecipeAttributesSection = ({ recipeId, recipeName, canEdit, userId }) => {
  const [attributes, setAttributes] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoaded(false);
      setError(null);
      try {
        const result = await fetchRecipeAttributes(recipeId);
        if (!cancelled) setAttributes(result);
      } catch (err) {
        console.error('[RecipeAttributesSection] Failed to load:', err);
        if (!cancelled) setError("Couldn't load details.");
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [recipeId]);

  const chips = attributeChips(attributes);

  const handleSave = async (updated) => {
    setAttributes(await saveRecipeAttributes(updated, userId));
  };

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>DETAILS</h2>
        {canEdit && isLoaded && !error && (
          <button type="button" className={styles.editBtn} onClick={() => setIsEditing(true)}>
            {attributes ? 'Edit' : 'Add'}
          </button>
        )}
      </div>
      {error && <p className={styles.muted}>{error}</p>}
      {!error && isLoaded && chips.length === 0 && (
        <p className={styles.muted}>Meal, protein, cuisine and effort help the Plan tab suggest a balanced week.</p>
      )}
      {chips.length > 0 && (
        <ul className={styles.chips}>
          {chips.map((chip) => <li key={chip} className={styles.chip}>{chip}</li>)}
        </ul>
      )}
      {isEditing && (
        <RecipeAttributesEditor
          recipeName={recipeName}
          attributes={attributes ?? emptyAttributes(recipeId)}
          onSave={handleSave}
          onClose={() => setIsEditing(false)}
        />
      )}
    </div>
  );
};

RecipeAttributesSection.propTypes = {
  recipeId: PropTypes.string.isRequired,
  recipeName: PropTypes.string.isRequired,
  canEdit: PropTypes.bool.isRequired,
  userId: PropTypes.string.isRequired,
};
