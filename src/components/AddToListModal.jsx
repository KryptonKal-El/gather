/**
 * AddToListModal — modal for adding recipe ingredients to a shopping list.
 * Shows selected ingredients, allows choosing a list, and adds items.
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { categorizeItem } from '../utils/categories.js';
import { mapSpoonacularUnit } from '../utils/unitMapping.js';
import styles from './AddToListModal.module.css';

const MAX_VISIBLE_INGREDIENTS = 5;

/**
 * Modal for adding recipe ingredients to a shopping list.
 * @param {Object} props
 * @param {Array<{name: string, quantity: string}>} props.ingredients - Selected ingredients
 * @param {Array} props.lists - User's shopping lists
 * @param {Function} props.onAddItems - Called with (listId, items) to add items
 * @param {Function} props.onClose - Called to close the modal
 */
export const AddToListModal = ({ ingredients, lists, onAddItems, onClose }) => {
  const [selectedListId, setSelectedListId] = useState(lists[0]?.id ?? null);
  const [isAdding, setIsAdding] = useState(false);
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

  const handleAddItems = async () => {
    if (!selectedListId) return;

    setIsAdding(true);
    setError(null);

    try {
      const items = ingredients.map((ing) => ({
        name: ing.name,
        category: categorizeItem(ing.name),
        isChecked: false,
        quantity: Math.max(1, Math.round(ing.amount ?? 1)),
        unit: ing.unit ? mapSpoonacularUnit(ing.unit) : 'each',
      }));

      await onAddItems(selectedListId, items);

      const selectedList = lists.find((l) => l.id === selectedListId);
      setSuccess({
        count: items.length,
        listName: selectedList?.name ?? 'list',
      });
    } catch (err) {
      setError(err.message ?? 'Failed to add items');
      setIsAdding(false);
    }
  };

  const visibleIngredients = ingredients.slice(0, MAX_VISIBLE_INGREDIENTS);
  const remainingCount = ingredients.length - MAX_VISIBLE_INGREDIENTS;

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Add to Shopping List"
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Add to Shopping List</h3>
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
          <div className={styles.ingredientSummary}>
            <p className={styles.summaryLabel}>
              Adding {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''}:
            </p>
            <ul className={styles.ingredientList}>
              {visibleIngredients.map((ing, index) => (
                <li key={`${ing.name}-${index}`} className={styles.ingredientItem}>
                  {ing.name}
                </li>
              ))}
            </ul>
            {remainingCount > 0 && (
              <p className={styles.moreLabel}>and {remainingCount} more...</p>
            )}
          </div>

          {lists.length === 0 ? (
            <div className={styles.noLists}>
              <p className={styles.noListsMsg}>No lists yet. Create a list first!</p>
              <p className={styles.noListsHint}>Go to the Lists tab to create one.</p>
            </div>
          ) : (
            <>
              <p className={styles.chooseLabel}>Choose a list:</p>
              <div className={styles.listSelector}>
                {lists.map((list) => {
                  const isSelected = list.id === selectedListId;
                  return (
                    <button
                      key={list.id}
                      type="button"
                      className={`${styles.listItem} ${isSelected ? styles.listItemSelected : ''}`}
                      onClick={() => setSelectedListId(list.id)}
                      aria-pressed={isSelected}
                    >
                      <span className={styles.listEmoji}>{list.emoji ?? '🛒'}</span>
                      <span className={styles.listName}>{list.name}</span>
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
              <span>Added {success.count} item{success.count !== 1 ? 's' : ''} to {success.listName}</span>
            </div>
          ) : (
            <button
              type="button"
              className={styles.addBtn}
              onClick={handleAddItems}
              disabled={!selectedListId || isAdding || lists.length === 0}
            >
              {isAdding
                ? 'Adding...'
                : `Add ${ingredients.length} Item${ingredients.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

AddToListModal.propTypes = {
  ingredients: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      quantity: PropTypes.string,
      amount: PropTypes.number,
      unit: PropTypes.string,
    })
  ).isRequired,
  lists: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      emoji: PropTypes.string,
    })
  ).isRequired,
  onAddItems: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
