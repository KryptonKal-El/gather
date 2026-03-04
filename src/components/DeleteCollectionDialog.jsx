import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import styles from './DeleteCollectionDialog.module.css';

/**
 * Confirmation dialog for deleting a collection.
 * Shows two options when collection has recipes: move recipes or delete all.
 * Shows simple confirmation when collection is empty.
 */
export const DeleteCollectionDialog = ({
  collectionName,
  recipeCount,
  defaultCollectionName,
  onMoveAndDelete,
  onDeleteAll,
  onCancel,
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onCancel();
  };

  const hasRecipes = recipeCount > 0;
  const recipeLabel = recipeCount === 1 ? 'recipe' : 'recipes';

  return createPortal(
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.dialog}>
        <h3 className={styles.title}>Delete &ldquo;{collectionName}&rdquo;?</h3>

        {hasRecipes ? (
          <div className={styles.options}>
            <button
              type="button"
              className={styles.safeBtn}
              onClick={onMoveAndDelete}
            >
              Move {recipeCount} {recipeLabel} to {defaultCollectionName} and delete
            </button>
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={onDeleteAll}
            >
              Delete collection and all {recipeCount} {recipeLabel}
            </button>
          </div>
        ) : (
          <p className={styles.message}>
            This collection is empty and will be permanently deleted.
          </p>
        )}

        <div className={styles.footer}>
          {!hasRecipes && (
            <button type="button" className={styles.deleteBtn} onClick={onDeleteAll}>
              Delete
            </button>
          )}
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

DeleteCollectionDialog.propTypes = {
  collectionName: PropTypes.string.isRequired,
  recipeCount: PropTypes.number.isRequired,
  defaultCollectionName: PropTypes.string.isRequired,
  onMoveAndDelete: PropTypes.func.isRequired,
  onDeleteAll: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
