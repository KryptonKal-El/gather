/**
 * AddToListModal — modal for adding recipe ingredients to a shopping list.
 * Two-step flow: select list → preview items with dedup merge.
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { categorizeItem } from '../utils/categories.js';
import { mapSpoonacularUnit } from '../utils/unitMapping.js';
import { fetchItemsForList, batchUpdateItemQuantities } from '../services/database.js';
import styles from './AddToListModal.module.css';

const MAX_VISIBLE_INGREDIENTS = 5;

/**
 * Modal for adding recipe ingredients to a shopping list.
 * @param {Object} props
 * @param {Array<{name: string, quantity: string, amount: number, unit: string}>} props.ingredients - Selected ingredients
 * @param {Array} props.lists - User's shopping lists
 * @param {Function} props.onAddItems - Called with (listId, items) to add items
 * @param {Function} props.onClose - Called to close the modal
 */
export const AddToListModal = ({ ingredients, lists, onAddItems, onClose }) => {
  const [selectedListId, setSelectedListId] = useState(lists[0]?.id ?? null);
  const [step, setStep] = useState('select');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [newItems, setNewItems] = useState([]);
  const [duplicateItems, setDuplicateItems] = useState([]);
  const [existingItems, setExistingItems] = useState([]);
  const [remapOpenId, setRemapOpenId] = useState(null);
  const [remapSearch, setRemapSearch] = useState('');

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

  const handleReview = async () => {
    if (!selectedListId) return;

    setIsLoadingPreview(true);
    setError(null);

    try {
      const existing = await fetchItemsForList(selectedListId);
      const existingMap = new Map(
        existing.map((item) => [item.name.toLowerCase(), item])
      );

      const newList = [];
      const dupList = [];

      for (const ing of ingredients) {
        const name = ing.name;
        const quantity = Math.max(1, Math.round(ing.amount ?? 1));
        const unit = ing.unit ? mapSpoonacularUnit(ing.unit) : 'each';
        const category = categorizeItem(name);
        const key = name.toLowerCase();

        const existingItem = existingMap.get(key);
        if (existingItem) {
          dupList.push({
            id: existingItem.id,
            name: existingItem.name,
            currentQuantity: existingItem.quantity,
            newQuantity: existingItem.quantity + quantity,
            unit: existingItem.unit ?? 'each',
            isExcluded: false,
          });
        } else {
          newList.push({
            tempId: crypto.randomUUID(),
            name,
            quantity,
            recipeQuantity: quantity,
            unit,
            category,
            isExcluded: false,
          });
        }
      }

      setNewItems(newList);
      setDuplicateItems(dupList);
      setExistingItems(existing);
      setStep('preview');
    } catch (err) {
      setError(err.message ?? 'Failed to load preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleBack = () => {
    setStep('select');
    setNewItems([]);
    setDuplicateItems([]);
    setRemapOpenId(null);
    setRemapSearch('');
    setError(null);
  };

  const toggleNewItem = (tempId) => {
    setNewItems((prev) =>
      prev.map((item) =>
        item.tempId === tempId ? { ...item, isExcluded: !item.isExcluded } : item
      )
    );
  };

  const toggleDuplicateItem = (id) => {
    setDuplicateItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isExcluded: !item.isExcluded } : item
      )
    );
  };

  const updateNewItemQty = (tempId, delta) => {
    setNewItems((prev) =>
      prev.map((item) => {
        if (item.tempId !== tempId) return item;
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      })
    );
  };

  const updateDuplicateQty = (id, delta) => {
    setDuplicateItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const newQty = Math.max(item.currentQuantity, item.newQuantity + delta);
        return { ...item, newQuantity: newQty };
      })
    );
  };

  const usedExistingIds = new Set(duplicateItems.map((d) => d.id));
  const availableForRemap = existingItems.filter((item) => !usedExistingIds.has(item.id));
  const filteredRemapItems = remapSearch
    ? availableForRemap.filter((item) =>
        item.name.toLowerCase().includes(remapSearch.toLowerCase())
      )
    : availableForRemap;

  const handleRemap = (newItemTempId, existingItem) => {
    const foundNewItem = newItems.find((n) => n.tempId === newItemTempId);
    if (!foundNewItem) return;

    setNewItems((prev) => prev.filter((n) => n.tempId !== newItemTempId));
    setDuplicateItems((prev) => [
      ...prev,
      {
        id: existingItem.id,
        name: existingItem.name,
        currentQuantity: existingItem.quantity,
        newQuantity: existingItem.quantity + foundNewItem.recipeQuantity,
        unit: existingItem.unit ?? 'each',
        isExcluded: false,
      },
    ]);
    setRemapOpenId(null);
    setRemapSearch('');
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    setError(null);

    try {
      const itemsToAdd = newItems
        .filter((item) => !item.isExcluded)
        .map((item) => ({
          name: item.name,
          category: item.category,
          isChecked: false,
          quantity: item.quantity,
          unit: item.unit,
        }));

      const itemsToUpdate = duplicateItems
        .filter((item) => !item.isExcluded)
        .map((item) => ({
          id: item.id,
          quantity: item.newQuantity,
        }));

      if (itemsToAdd.length > 0) {
        await onAddItems(selectedListId, itemsToAdd);
      }

      if (itemsToUpdate.length > 0) {
        await batchUpdateItemQuantities(itemsToUpdate);
      }

      const selectedList = lists.find((l) => l.id === selectedListId);
      const listName = selectedList?.name ?? 'list';

      let message;
      if (itemsToAdd.length > 0 && itemsToUpdate.length > 0) {
        message = `Added ${itemsToAdd.length}, updated ${itemsToUpdate.length} items in ${listName}`;
      } else if (itemsToAdd.length > 0) {
        message = `Added ${itemsToAdd.length} item${itemsToAdd.length !== 1 ? 's' : ''} to ${listName}`;
      } else if (itemsToUpdate.length > 0) {
        message = `Updated ${itemsToUpdate.length} item${itemsToUpdate.length !== 1 ? 's' : ''} in ${listName}`;
      } else {
        message = 'No changes made';
      }

      setSuccess({ message });
    } catch (err) {
      setError(err.message ?? 'Failed to save changes');
      setIsConfirming(false);
    }
  };

  const includedNewCount = newItems.filter((i) => !i.isExcluded).length;
  const includedDupCount = duplicateItems.filter((i) => !i.isExcluded).length;

  const getConfirmButtonText = () => {
    if (isConfirming) return 'Saving...';
    if (includedNewCount > 0 && includedDupCount > 0) {
      return `Add ${includedNewCount} Items, Update ${includedDupCount}`;
    }
    if (includedNewCount > 0) {
      return `Add ${includedNewCount} Item${includedNewCount !== 1 ? 's' : ''}`;
    }
    if (includedDupCount > 0) {
      return `Update ${includedDupCount} Item${includedDupCount !== 1 ? 's' : ''}`;
    }
    return 'Nothing Selected';
  };

  const visibleIngredients = ingredients.slice(0, MAX_VISIBLE_INGREDIENTS);
  const remainingCount = ingredients.length - MAX_VISIBLE_INGREDIENTS;

  const renderSelectStep = () => (
    <>
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

      <button
        type="button"
        className={styles.addBtn}
        onClick={handleReview}
        disabled={!selectedListId || isLoadingPreview || lists.length === 0}
      >
        {isLoadingPreview ? 'Loading...' : 'Review Items'}
      </button>
    </>
  );

  const renderPreviewRow = (item, isDuplicate) => {
    const isExcluded = item.isExcluded;
    const rowClass = `${styles.previewRow} ${isExcluded ? styles.previewRowExcluded : ''}`;
    const checkClass = `${styles.previewCheck} ${isExcluded ? styles.previewCheckExcluded : ''}`;
    const nameClass = `${styles.previewName} ${isExcluded ? styles.previewNameExcluded : ''}`;

    const handleToggle = () => {
      if (isDuplicate) {
        toggleDuplicateItem(item.id);
      } else {
        toggleNewItem(item.tempId);
      }
    };

    const handleQtyChange = (delta) => {
      if (isDuplicate) {
        updateDuplicateQty(item.id, delta);
      } else {
        updateNewItemQty(item.tempId, delta);
      }
    };

    const currentQty = isDuplicate ? item.newQuantity : item.quantity;
    const minQty = isDuplicate ? item.currentQuantity : 1;

    return (
      <li key={isDuplicate ? item.id : item.tempId} className={rowClass}>
        <button type="button" className={checkClass} onClick={handleToggle}>
          {isExcluded ? '☐' : '☑'}
        </button>
        <div className={styles.previewInfo}>
          {isDuplicate ? (
            <div className={nameClass}>{item.name}</div>
          ) : (
            <button
              type="button"
              className={`${nameClass} ${!item.isExcluded && availableForRemap.length > 0 ? styles.remapTrigger : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!item.isExcluded && availableForRemap.length > 0) {
                  setRemapOpenId(remapOpenId === item.tempId ? null : item.tempId);
                  setRemapSearch('');
                }
              }}
              disabled={item.isExcluded || availableForRemap.length === 0}
            >
              {item.name}
            </button>
          )}
          {isDuplicate && (
            <div className={styles.previewSub}>
              {item.currentQuantity} → {item.newQuantity} {item.unit}
            </div>
          )}
          {!isDuplicate && remapOpenId === item.tempId && (
            <div className={styles.remapDropdown}>
              <input
                type="text"
                className={styles.remapSearch}
                placeholder="Search items..."
                value={remapSearch}
                onChange={(e) => setRemapSearch(e.target.value)}
                autoFocus
              />
              <ul className={styles.remapList}>
                {filteredRemapItems.map((existing) => (
                  <li key={existing.id}>
                    <button
                      type="button"
                      className={styles.remapOption}
                      onClick={() => handleRemap(item.tempId, existing)}
                    >
                      <span>{existing.name}</span>
                      <span className={styles.remapQty}>
                        {existing.quantity} {existing.unit ?? 'each'}
                      </span>
                    </button>
                  </li>
                ))}
                {filteredRemapItems.length === 0 && (
                  <li className={styles.remapEmpty}>No matching items</li>
                )}
              </ul>
            </div>
          )}
        </div>
        <div className={styles.qtyStepper}>
          <button
            type="button"
            className={styles.qtyBtn}
            onClick={() => handleQtyChange(-1)}
            disabled={currentQty <= minQty}
          >
            −
          </button>
          <span className={styles.qtyValue}>{currentQty}</span>
          <button
            type="button"
            className={styles.qtyBtn}
            onClick={() => handleQtyChange(1)}
          >
            +
          </button>
        </div>
        <span className={styles.unitLabel}>{item.unit}</span>
      </li>
    );
  };

  const renderPreviewStep = () => {
    const hasNewItems = newItems.length > 0;
    const hasDuplicates = duplicateItems.length > 0;
    const isEmpty = !hasNewItems && !hasDuplicates;

    return (
      <>
        {isEmpty ? (
          <div className={styles.emptyPreview}>
            <p>No items to preview.</p>
          </div>
        ) : (
          <>
            {hasNewItems && (
              <>
                <p className={styles.sectionLabel}>New Items</p>
                <ul className={styles.previewList}>
                  {newItems.map((item) => renderPreviewRow(item, false))}
                </ul>
              </>
            )}
            {hasDuplicates && (
              <>
                <p className={styles.sectionLabel}>Already in List — Update Quantity</p>
                <ul className={styles.previewList}>
                  {duplicateItems.map((item) => renderPreviewRow(item, true))}
                </ul>
              </>
            )}
          </>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {success ? (
          <div className={styles.successMsg}>
            <span className={styles.successIcon}>✅</span>
            <span>{success.message}</span>
          </div>
        ) : (
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={
              isConfirming ||
              (includedNewCount === 0 && includedDupCount === 0)
            }
          >
            {getConfirmButtonText()}
          </button>
        )}
      </>
    );
  };

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
          {step === 'preview' ? (
            <button type="button" className={styles.backBtn} onClick={handleBack}>
              ← Back
            </button>
          ) : null}
          <h3 className={styles.title}>
            {step === 'select' ? 'Add to Shopping List' : 'Review Items'}
          </h3>
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
          {step === 'select' ? renderSelectStep() : renderPreviewStep()}
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
