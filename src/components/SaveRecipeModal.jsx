/**
 * SaveRecipeModal — modal for saving an online recipe to a collection.
 * Shows collection picker with option to select where to save the recipe.
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import styles from './SaveRecipeModal.module.css';

/**
 * Modal for saving an online recipe to a user's collection.
 * @param {Object} props
 * @param {Object} props.recipeDetail - Spoonacular recipe detail object
 * @param {Array} props.collections - User's recipe collections
 * @param {string|null} props.activeCollectionId - Currently active collection ID
 * @param {Function} props.onSave - Called with (collectionId) to save the recipe
 * @param {Function} props.onClose - Called to close the modal
 */
export const SaveRecipeModal = ({
  recipeDetail,
  collections,
  activeCollectionId,
  onSave,
  onClose,
}) => {
  const defaultCollection = collections.find((c) => c.isDefault);
  const initialSelection = activeCollectionId ?? defaultCollection?.id ?? collections[0]?.id ?? null;
  const [selectedCollectionId, setSelectedCollectionId] = useState(initialSelection);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      onClose();
    }, 1500);
    return () => clearTimeout(timer);
  }, [success, onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSave = async () => {
    if (!selectedCollectionId) return;

    setIsSaving(true);
    setError(null);

    try {
      await onSave(selectedCollectionId);
      const selectedCollection = collections.find((c) => c.id === selectedCollectionId);
      setSuccess({
        recipeName: recipeDetail.title,
        collectionName: selectedCollection?.name ?? 'collection',
      });
    } catch (err) {
      setError(err.message ?? 'Failed to save recipe');
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Save Recipe to Collection"
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Save to Collection</h3>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            &times;
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.recipeSummary}>
            <p className={styles.summaryLabel}>Saving:</p>
            <p className={styles.recipeName}>{recipeDetail.title}</p>
          </div>

          {collections.length === 0 ? (
            <div className={styles.noCollections}>
              <p className={styles.noCollectionsMsg}>No collections yet.</p>
              <p className={styles.noCollectionsHint}>Create a collection first!</p>
            </div>
          ) : (
            <>
              <p className={styles.chooseLabel}>Choose a collection:</p>
              <div className={styles.collectionSelector}>
                {collections.map((collection) => {
                  const isSelected = collection.id === selectedCollectionId;
                  return (
                    <button
                      key={collection.id}
                      type="button"
                      className={`${styles.collectionItem} ${isSelected ? styles.collectionItemSelected : ''}`}
                      onClick={() => setSelectedCollectionId(collection.id)}
                      aria-pressed={isSelected}
                    >
                      <span className={styles.collectionEmoji}>{collection.emoji ?? '📖'}</span>
                      <span className={styles.collectionName}>{collection.name}</span>
                      {isSelected && <span className={styles.checkmark}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {error && <p className={styles.error}>{error}</p>}

          {success ? (
            <div className={styles.successMsg}>
              <span className={styles.successIcon}>✅</span>
              <span>Saved to {success.collectionName}</span>
            </div>
          ) : (
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={!selectedCollectionId || isSaving || collections.length === 0}
            >
              {isSaving ? 'Saving...' : 'Save Recipe'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

SaveRecipeModal.propTypes = {
  recipeDetail: PropTypes.shape({
    id: PropTypes.number,
    title: PropTypes.string.isRequired,
    image: PropTypes.string,
    readyInMinutes: PropTypes.number,
    servings: PropTypes.number,
    sourceUrl: PropTypes.string,
    extendedIngredients: PropTypes.array,
    analyzedInstructions: PropTypes.array,
  }).isRequired,
  collections: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      emoji: PropTypes.string,
      isDefault: PropTypes.bool,
    })
  ).isRequired,
  activeCollectionId: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
