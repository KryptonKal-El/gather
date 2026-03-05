import { useState } from 'react';
import PropTypes from 'prop-types';
import { CATEGORIES, DEFAULT_CATEGORIES, getAllCategoryLabels, getAllCategoryColors, getAllCategoryKeys } from '../utils/categories.js';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { ShoppingItem } from './ShoppingItem.jsx';
import styles from './ShoppingList.module.css';

/**
 * Renders a category-grouped block of items. Used within each store section.
 */
const CategoryGroup = ({
  categoryOrder,
  grouped,
  allLabels,
  allColors,
  stores,
  onToggle,
  onRemove,
  onUpdateCategory,
  onUpdateStore,
  onUpdateItem,
  restoredItemIds,
  onRestoreAnimationDone,
}) => {
  const orderSet = new Set(categoryOrder);
  const uncategorized = Object.keys(grouped)
    .filter((key) => !orderSet.has(key))
    .flatMap((key) => grouped[key]);

  return (
    <>
      {categoryOrder.map((cat) => {
        const group = grouped[cat];
        if (!group?.length) return null;
        return (
          <div key={cat} className={styles.group}>
            <h4 className={styles.categoryTitle}>
              <span
                className={styles.dot}
                style={{ backgroundColor: allColors[cat] ?? '#9e9e9e' }}
              />
              {allLabels[cat] ?? cat}
              <span className={styles.count}>{group.length}</span>
            </h4>
            {group.map((item) => (
              <ShoppingItem
                key={item.id}
                item={item}
                stores={stores}
                isRestored={restoredItemIds?.has(item.id)}
                onRestoreAnimationDone={onRestoreAnimationDone ? () => onRestoreAnimationDone(item.id) : undefined}
                onToggle={() => onToggle(item.id)}
                onRemove={() => onRemove(item.id)}
                onUpdateCategory={onUpdateCategory}
                onUpdateStore={onUpdateStore}
                onUpdateItem={onUpdateItem}
              />
            ))}
          </div>
        );
      })}
      {uncategorized.length > 0 && (
        <div className={styles.group}>
          <h4 className={styles.categoryTitle}>
            <span
              className={styles.dot}
              style={{ backgroundColor: '#9e9e9e' }}
            />
            Uncategorized
            <span className={styles.count}>{uncategorized.length}</span>
          </h4>
          {uncategorized.map((item) => (
            <ShoppingItem
              key={item.id}
              item={item}
              stores={stores}
              isRestored={restoredItemIds?.has(item.id)}
              onRestoreAnimationDone={onRestoreAnimationDone ? () => onRestoreAnimationDone(item.id) : undefined}
              onToggle={() => onToggle(item.id)}
              onRemove={() => onRemove(item.id)}
              onUpdateCategory={onUpdateCategory}
              onUpdateStore={onUpdateStore}
              onUpdateItem={onUpdateItem}
            />
          ))}
        </div>
      )}
    </>
  );
};

/**
 * Groups items by category key. Returns an object keyed by category.
 */
const groupByCategory = (items) => {
  const grouped = {};
  for (const item of items) {
    const cat = item.category ?? CATEGORIES.OTHER;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }
  return grouped;
};

/**
 * Computes the subtotal for a group of items (qty * price, skipping items without a price).
 * @param {Array} items
 * @returns {number|null} The subtotal, or null if no items have a price
 */
const computeSubtotal = (items) => {
  let total = 0;
  let hasAny = false;
  for (const item of items) {
    const price = item.price ?? null;
    if (price !== null) {
      total += (item.quantity ?? 1) * price;
      hasAny = true;
    }
  }
  return hasAny ? total : null;
};

/**
 * Displays the shopping list items grouped by store at the top level,
 * then by category within each store. Items without a store appear
 * in an "Unassigned" section. Checked items appear at the bottom.
 *
 * Category labels/colors within each store section use that store's
 * categories. Unassigned items use global DEFAULT_CATEGORIES.
 */
export const ShoppingList = ({
  items,
  stores,
  onToggle,
  onRemove,
  onUpdateCategory,
  onUpdateStore,
  onUpdateItem,
  onClearChecked,
  restoredItemIds,
  onRestoreAnimationDone,
}) => {
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Your list is empty.</p>
        <p className={styles.hint}>Add items above or use AI suggestions below.</p>
      </div>
    );
  }

  const unchecked = items.filter((i) => !i.isChecked);
  const checkedItems = items.filter((i) => i.isChecked);

  const hasStores = stores.length > 0;

  // Build store map
  const storeMap = {};
  for (const s of stores) {
    storeMap[s.id] = s;
  }

  // Group unchecked items by store
  const byStore = {};
  const unassigned = [];
  for (const item of unchecked) {
    if (hasStores && item.store && storeMap[item.store]) {
      if (!byStore[item.store]) byStore[item.store] = [];
      byStore[item.store].push(item);
    } else {
      unassigned.push(item);
    }
  }

  // Default categories for unassigned section
  const defaultLabels = getAllCategoryLabels();
  const defaultColors = getAllCategoryColors();
  const defaultOrder = getAllCategoryKeys();

  const defaultGroupProps = {
    categoryOrder: defaultOrder,
    allLabels: defaultLabels,
    allColors: defaultColors,
    stores,
    onToggle,
    onRemove,
    onUpdateCategory,
    onUpdateStore,
    onUpdateItem,
    restoredItemIds,
    onRestoreAnimationDone,
  };

  return (
    <div className={styles.list}>
      {/* Store sections (in store order) */}
      {hasStores && stores.map((store) => {
        const storeItems = byStore[store.id];
        if (!storeItems?.length) return null;
        const grouped = groupByCategory(storeItems);
        const storeCats = store.categories ?? DEFAULT_CATEGORIES;
        const storeLabels = getAllCategoryLabels(storeCats);
        const storeColors = getAllCategoryColors(storeCats);
        const storeOrder = getAllCategoryKeys(storeCats);
        const subtotal = computeSubtotal(storeItems);
        return (
          <div key={store.id} className={styles.storeSection}>
            <h3 className={styles.storeTitle}>
              <span
                className={styles.storeDot}
                style={{ backgroundColor: store.color }}
              />
              {store.name}
              <span className={styles.count}>{storeItems.length}</span>
              {subtotal !== null && (
                <span className={styles.subtotal}>{`$${subtotal.toFixed(2)}`}</span>
              )}
            </h3>
            <div className={styles.storeBody}>
              <CategoryGroup
                categoryOrder={storeOrder}
                grouped={grouped}
                allLabels={storeLabels}
                allColors={storeColors}
                stores={stores}
                onToggle={onToggle}
                onRemove={onRemove}
                onUpdateCategory={onUpdateCategory}
                onUpdateStore={onUpdateStore}
                onUpdateItem={onUpdateItem}
                restoredItemIds={restoredItemIds}
                onRestoreAnimationDone={onRestoreAnimationDone}
              />
            </div>
          </div>
        );
      })}

      {/* Unassigned items */}
      {unassigned.length > 0 && (
        <div className={hasStores ? styles.storeSection : undefined}>
          {hasStores && (
            <h3 className={styles.storeTitle}>
              <span className={styles.storeDot} style={{ backgroundColor: '#bbb' }} />
              Unassigned
              <span className={styles.count}>{unassigned.length}</span>
            </h3>
          )}
          <div className={hasStores ? styles.storeBody : undefined}>
            <CategoryGroup grouped={groupByCategory(unassigned)} {...defaultGroupProps} />
          </div>
        </div>
      )}

      {/* Checked items */}
      {checkedItems.length > 0 && (
        <div className={styles.checkedSection}>
          <div className={styles.checkedHeader}>
            <h3 className={styles.groupTitle}>
              Checked ({checkedItems.length})
            </h3>
            <button className={styles.clearBtn} onClick={() => setIsConfirmingClear(true)}>
              Clear checked
            </button>
            {isConfirmingClear && (
              <ConfirmDialog
                message={`Clear all ${checkedItems.length} checked items?`}
                confirmLabel="Clear"
                onConfirm={() => {
                  onClearChecked();
                  setIsConfirmingClear(false);
                }}
                onCancel={() => setIsConfirmingClear(false)}
              />
            )}
          </div>
          {checkedItems.map((item) => (
            <ShoppingItem
              key={item.id}
              item={item}
              stores={stores}
              isRestored={restoredItemIds?.has(item.id)}
              onRestoreAnimationDone={onRestoreAnimationDone ? () => onRestoreAnimationDone(item.id) : undefined}
              onToggle={() => onToggle(item.id)}
              onRemove={() => onRemove(item.id)}
              onUpdateCategory={onUpdateCategory}
              onUpdateStore={onUpdateStore}
              onUpdateItem={onUpdateItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};

ShoppingList.propTypes = {
  items: PropTypes.array.isRequired,
  stores: PropTypes.array,
  onToggle: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  onUpdateCategory: PropTypes.func.isRequired,
  onUpdateStore: PropTypes.func.isRequired,
  onUpdateItem: PropTypes.func.isRequired,
  onClearChecked: PropTypes.func.isRequired,
  restoredItemIds: PropTypes.instanceOf(Set),
  onRestoreAnimationDone: PropTypes.func,
};

ShoppingList.defaultProps = {
  stores: [],
  restoredItemIds: null,
  onRestoreAnimationDone: null,
};
