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
 * Displays the shopping list items using the specified sort mode.
 * Supported modes:
 *  - 'store-category' (default): grouped by store → category
 *  - 'category': grouped by category only, no store sections
 *  - 'alpha': flat A–Z by name, no grouping headers
 *  - 'date-added': flat by added_at descending (newest first), no grouping headers
 * Checked items always appear at the bottom regardless of mode.
 */
export const ShoppingList = ({
  items,
  stores,
  sortMode,
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
  const [collapsedStores, setCollapsedStores] = useState(new Set());

  const handleToggleStore = (storeId) => {
    setCollapsedStores((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) {
        next.delete(storeId);
      } else {
        next.add(storeId);
      }
      return next;
    });
  };

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

  // Category mode: group unchecked items by category, sorted by added_at within each
  const getCategoryModeGrouped = () => {
    const categoryGrouped = groupByCategory(unchecked);
    for (const key of Object.keys(categoryGrouped)) {
      categoryGrouped[key].sort((a, b) =>
        new Date(a.added_at ?? 0) - new Date(b.added_at ?? 0)
      );
    }
    return categoryGrouped;
  };

  // Sort checked items based on mode
  const sortedCheckedItems = (() => {
    if (sortMode === 'alpha') {
      return [...checkedItems].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }));
    }
    if (sortMode === 'date-added') {
      return [...checkedItems].sort((a, b) => new Date(b.added_at ?? 0) - new Date(a.added_at ?? 0));
    }
    return checkedItems;
  })();

  return (
    <div className={styles.list}>
      {/* Category mode: flat category grouping (no store sections) */}
      {sortMode === 'category' && unchecked.length > 0 && (
        <CategoryGroup
          grouped={getCategoryModeGrouped()}
          categoryOrder={defaultOrder}
          allLabels={defaultLabels}
          allColors={defaultColors}
          stores={stores}
          onToggle={onToggle}
          onRemove={onRemove}
          onUpdateCategory={onUpdateCategory}
          onUpdateStore={onUpdateStore}
          onUpdateItem={onUpdateItem}
          restoredItemIds={restoredItemIds}
          onRestoreAnimationDone={onRestoreAnimationDone}
        />
      )}

      {/* Alpha mode: flat A–Z by name */}
      {sortMode === 'alpha' && unchecked.length > 0 && (
        <>
          {[...unchecked]
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }))
            .map((item) => (
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
        </>
      )}

      {/* Date-added mode: flat by added_at descending (newest first) */}
      {sortMode === 'date-added' && unchecked.length > 0 && (
        <>
          {[...unchecked]
            .sort((a, b) => new Date(b.added_at ?? 0) - new Date(a.added_at ?? 0))
            .map((item) => (
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
        </>
      )}

      {/* Store-category mode: store sections (in store order) */}
      {sortMode === 'store-category' && hasStores && stores.map((store) => {
        const storeItems = byStore[store.id];
        if (!storeItems?.length) return null;
        const grouped = groupByCategory(storeItems);
        const storeCats = store.categories ?? DEFAULT_CATEGORIES;
        const storeLabels = getAllCategoryLabels(storeCats);
        const storeColors = getAllCategoryColors(storeCats);
        const storeOrder = getAllCategoryKeys(storeCats);
        const subtotal = computeSubtotal(storeItems);
        const isCollapsed = collapsedStores.has(store.id);
        return (
          <div key={store.id} className={styles.storeSection}>
            <h3
              className={`${styles.storeTitle} ${isCollapsed ? styles.storeTitleCollapsed : ''}`}
              onClick={() => handleToggleStore(store.id)}
            >
              <span className={`${styles.chevron} ${isCollapsed ? '' : styles.chevronExpanded}`} />
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
            {!isCollapsed && (
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
            )}
          </div>
        );
      })}

      {/* Store-category mode: unassigned items */}
      {sortMode === 'store-category' && unassigned.length > 0 && (
        <div className={hasStores ? styles.storeSection : undefined}>
          {hasStores && (
            <h3
              className={`${styles.storeTitle} ${collapsedStores.has('__unassigned__') ? styles.storeTitleCollapsed : ''}`}
              onClick={() => handleToggleStore('__unassigned__')}
            >
              <span className={`${styles.chevron} ${collapsedStores.has('__unassigned__') ? '' : styles.chevronExpanded}`} />
              <span className={styles.storeDot} style={{ backgroundColor: '#bbb' }} />
              Unassigned
              <span className={styles.count}>{unassigned.length}</span>
            </h3>
          )}
          {(!hasStores || !collapsedStores.has('__unassigned__')) && (
            <div className={hasStores ? styles.storeBody : undefined}>
              <CategoryGroup grouped={groupByCategory(unassigned)} {...defaultGroupProps} />
            </div>
          )}
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
          {sortedCheckedItems.map((item) => (
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
  sortMode: PropTypes.string,
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
  sortMode: 'store-category',
  restoredItemIds: null,
  onRestoreAnimationDone: null,
};
