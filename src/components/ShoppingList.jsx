import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { applySortPipeline, SYSTEM_DEFAULT_SORT_CONFIG } from '../utils/sortPipeline.js';
import { formatPrice } from '../utils/formatPrice.js';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { ShoppingItem } from './ShoppingItem.jsx';
import styles from './ShoppingList.module.css';

const COLLAPSED_GROUPS_PREFIX = 'gather:collapsedGroups:';

/** Reserved collapse key for the bottom "Crossed" section. */
const CROSSED_GROUP_KEY = '__crossed__';

/** Loads the persisted set of collapsed group keys for a list. */
const loadCollapsedGroups = (listId) => {
  if (!listId) return new Set();
  try {
    const raw = localStorage.getItem(COLLAPSED_GROUPS_PREFIX + listId);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

/** Persists the set of collapsed group keys for a list. */
const saveCollapsedGroups = (listId, collapsed) => {
  if (!listId) return;
  try {
    localStorage.setItem(COLLAPSED_GROUPS_PREFIX + listId, JSON.stringify([...collapsed]));
  } catch {
    // ignore storage write failures (e.g. private mode / quota)
  }
};

/** Helper to compute subtotal for a set of items. */
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

/** Collects all items from a group tree (recursively). */
const collectGroupItems = (group) => {
  if (group.items) return group.items;
  if (group.subGroups) return group.subGroups.flatMap(collectGroupItems);
  return [];
};

/** Renders a flat list of ShoppingItem components. */
const ItemList = ({ items, stores, listType, listCategories, restoredItemIds, onRestoreAnimationDone, getEffectiveChecked, onToggle, onRemove, onUpdateCategory, onUpdateStore, onUpdateItem, onNavigateToSettings }) => (
  <>
    {items.map((item) => (
      <ShoppingItem
        key={item.id}
        item={item}
        isChecked={getEffectiveChecked(item)}
        stores={stores}
        listType={listType}
        listCategories={listCategories}
        isRestored={restoredItemIds?.has(item.id)}
        onRestoreAnimationDone={onRestoreAnimationDone ? () => onRestoreAnimationDone(item.id) : undefined}
        onToggle={() => onToggle(item)}
        onRemove={() => onRemove(item.id)}
        onUpdateCategory={onUpdateCategory}
        onUpdateStore={onUpdateStore}
        onUpdateItem={onUpdateItem}
        onNavigateToSettings={onNavigateToSettings}
      />
    ))}
  </>
);

/** Renders a group recursively — depth 0 = prominent collapsible card, depth 1+ = small sub-header. */
const GroupRenderer = ({ group, depth = 0, collapsedGroups, onToggleGroup, stores, listType, listCategories, restoredItemIds, onRestoreAnimationDone, getEffectiveChecked, onToggle, onRemove, onUpdateCategory, onUpdateStore, onUpdateItem, onNavigateToSettings }) => {
  const itemProps = { stores, listType, listCategories, restoredItemIds, onRestoreAnimationDone, getEffectiveChecked, onToggle, onRemove, onUpdateCategory, onUpdateStore, onUpdateItem, onNavigateToSettings };

  const allItems = collectGroupItems(group);
  const count = group.type === 'rsvp' ? allItems.reduce((sum, item) => sum + (item.quantity ?? 1), 0) : allItems.length;

  // Depth 0: Prominent collapsible card (for ANY group type at top level)
  if (depth === 0) {
    const isCollapsed = collapsedGroups.has(group.key);
    const subtotal = computeSubtotal(allItems);

    return (
      <div className={styles.topLevelSection}>
        <h3
          className={`${styles.topLevelTitle} ${isCollapsed ? styles.topLevelTitleCollapsed : ''}`}
          onClick={() => onToggleGroup(group.key)}
        >
          <span className={`${styles.chevron} ${isCollapsed ? '' : styles.chevronExpanded}`} />
          <span className={styles.topLevelDot} style={{ backgroundColor: group.color ?? '#9e9e9e' }} />
          {group.label}
          <span className={styles.count}>{count}</span>
          {subtotal !== null && (
            <span className={styles.subtotal}>{formatPrice(subtotal)}</span>
          )}
        </h3>
        {!isCollapsed && (
          <div className={styles.topLevelBody}>
            {group.subGroups ? (
              group.subGroups.map((subGroup) => (
                <GroupRenderer key={subGroup.key} group={subGroup} depth={depth + 1} collapsedGroups={collapsedGroups} onToggleGroup={onToggleGroup} {...itemProps} />
              ))
            ) : group.items ? (
              <ItemList items={group.items} {...itemProps} />
            ) : null}
          </div>
        )}
      </div>
    );
  }

  // Depth 1+: Small sub-header (for ANY group type at nested level)
  return (
    <div className={styles.nestedGroup} style={{ '--category-bar-color': group.color ?? '#9e9e9e' }}>
      {/* Pass color to ::before pseudo-element via CSS custom property */}
      <h4 className={styles.nestedGroupTitle} style={{ color: group.color ?? '#9e9e9e' }}>
        {group.label}
        <span className={styles.count}>{count}</span>
      </h4>
      {group.subGroups ? (
        group.subGroups.map((subGroup) => (
          <GroupRenderer key={subGroup.key} group={subGroup} depth={depth + 1} collapsedGroups={collapsedGroups} onToggleGroup={onToggleGroup} {...itemProps} />
        ))
      ) : group.items ? (
        <ItemList items={group.items} {...itemProps} />
      ) : null}
    </div>
  );
};

/**
 * Displays the shopping list items using the sort pipeline.
 * Supports flexible sort configurations via sortConfig array.
 * Checked items always appear at the bottom regardless of config.
 */
export const ShoppingList = ({
  items,
  isLoading = false,
  stores = [],
  sortConfig = null,
  listType = 'grocery',
  listId = null,
  listCategories = null,
  getEffectiveChecked = (item) => item.isChecked,
  onToggle,
  onRemove,
  onUpdateCategory,
  onUpdateStore,
  onUpdateItem,
  onClearChecked,
  restoredItemIds = null,
  onRestoreAnimationDone = null,
  onNavigateToSettings = null,
}) => {
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(() => loadCollapsedGroups(listId));

  // Reload the persisted collapsed state when switching to a different list.
  useEffect(() => {
    setCollapsedGroups(loadCollapsedGroups(listId));
  }, [listId]);

  const handleToggleGroup = (groupKey) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      saveCollapsedGroups(listId, next);
      return next;
    });
  };

  const rsvpSummary = listType === 'guest_list' ? (() => {
    const counts = { invited: 0, confirmed: 0, declined: 0, maybe: 0, not_invited: 0 };
    let totalHeadCount = 0;
    for (const item of items) {
      const status = item.rsvpStatus ?? 'not_invited';
      counts[status] = (counts[status] ?? 0) + (item.quantity ?? 1);
      totalHeadCount += item.quantity ?? 1;
    }
    return { counts, totalHeadCount };
  })() : null;

  if (isLoading) {
    return (
      <div className={styles.empty}>
        <p className={styles.loading}>Loading items...</p>
      </div>
    );
  }

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

  const config = sortConfig ?? SYSTEM_DEFAULT_SORT_CONFIG;
  const uncheckedResult = applySortPipeline(unchecked, config, stores, listType, listCategories);

  // Crossed items render as a single flat list (matching iOS): run the same
  // pipeline to preserve ordering, then flatten the groups so no sub-headers show.
  const checkedResult = applySortPipeline(checkedItems, config, stores, listType, listCategories);
  const checkedFlat = checkedResult.items
    ?? [...checkedResult.groups.flatMap(collectGroupItems), ...(checkedResult.ungrouped ?? [])];

  const itemProps = { stores, listType, listCategories, restoredItemIds, onRestoreAnimationDone, getEffectiveChecked, onToggle, onRemove, onUpdateCategory, onUpdateStore, onUpdateItem, onNavigateToSettings };
  const groupProps = { collapsedGroups, onToggleGroup: handleToggleGroup, ...itemProps };

  return (
    <div className={styles.list}>
      {rsvpSummary && (
        <div className={styles.rsvpSummary}>
          <div className={styles.rsvpSummaryStats}>
            <span className={styles.rsvpSummaryStat} style={{ color: '#4caf50' }}>
              <span className={styles.rsvpStatCount}>{rsvpSummary.counts.confirmed}</span>
              <span className={styles.rsvpStatLabel}>Confirmed</span>
            </span>
            <span className={styles.rsvpSummaryStat} style={{ color: '#ff9800' }}>
              <span className={styles.rsvpStatCount}>{rsvpSummary.counts.maybe}</span>
              <span className={styles.rsvpStatLabel}>Maybe</span>
            </span>
            <span className={styles.rsvpSummaryStat} style={{ color: '#f44336' }}>
              <span className={styles.rsvpStatCount}>{rsvpSummary.counts.declined}</span>
              <span className={styles.rsvpStatLabel}>Declined</span>
            </span>
            <span className={styles.rsvpSummaryStat} style={{ color: '#42a5f5' }}>
              <span className={styles.rsvpStatCount}>{rsvpSummary.counts.invited}</span>
              <span className={styles.rsvpStatLabel}>Invited</span>
            </span>
            <span className={styles.rsvpSummaryStat} style={{ color: '#9e9e9e' }}>
              <span className={styles.rsvpStatCount}>{rsvpSummary.counts.not_invited}</span>
              <span className={styles.rsvpStatLabel}>Not Yet Invited</span>
            </span>
          </div>
          <div className={styles.rsvpSummaryTotal}>
            Total Guests: {rsvpSummary.totalHeadCount}
          </div>
        </div>
      )}

      {/* Grouped items */}
      {uncheckedResult.groups.map((group) => (
        <GroupRenderer key={group.key} group={group} depth={0} {...groupProps} />
      ))}

      {/* Ungrouped items (items not assigned to any group when grouping is active) */}
      {uncheckedResult.ungrouped?.length > 0 && (
        <div className={uncheckedResult.groups.length > 0 ? styles.topLevelSection : undefined}>
          {uncheckedResult.groups.length > 0 && (
            <h3
              className={`${styles.topLevelTitle} ${collapsedGroups.has('__ungrouped__') ? styles.topLevelTitleCollapsed : ''}`}
              onClick={() => handleToggleGroup('__ungrouped__')}
            >
              <span className={`${styles.chevron} ${collapsedGroups.has('__ungrouped__') ? '' : styles.chevronExpanded}`} />
              <span className={styles.topLevelDot} style={{ backgroundColor: '#bbb' }} />
              Unassigned
              <span className={styles.count}>{uncheckedResult.ungrouped.length}</span>
            </h3>
          )}
          {(!uncheckedResult.groups.length || !collapsedGroups.has('__ungrouped__')) && (
            <div className={uncheckedResult.groups.length > 0 ? styles.topLevelBody : undefined}>
              <ItemList items={uncheckedResult.ungrouped} {...itemProps} />
            </div>
          )}
        </div>
      )}

      {/* Flat sorted items (no grouping levels — e.g. config ['name'] or ['date']) */}
      {uncheckedResult.items?.length > 0 && (
        <ItemList items={uncheckedResult.items} {...itemProps} />
      )}

      {/* Checked items section — a single collapsible group, never sub-grouped (matches iOS) */}
      {checkedItems.length > 0 && (() => {
        const isCrossedCollapsed = collapsedGroups.has(CROSSED_GROUP_KEY);
        return (
          <div className={styles.checkedSection}>
            <div
              className={`${styles.checkedHeader} ${isCrossedCollapsed ? styles.checkedHeaderCollapsed : ''}`}
              onClick={() => handleToggleGroup(CROSSED_GROUP_KEY)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggleGroup(CROSSED_GROUP_KEY);
                }
              }}
            >
              <span className={`${styles.chevron} ${isCrossedCollapsed ? '' : styles.chevronExpanded}`} />
              <span className={styles.crossedTitle}>Crossed</span>
              <span className={styles.count}>{checkedItems.length}</span>
              <button
                className={styles.clearBtn}
                onClick={(e) => { e.stopPropagation(); setIsConfirmingClear(true); }}
              >
                Clear crossed
              </button>
            </div>
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
            {!isCrossedCollapsed && (
              <div className={styles.topLevelBody}>
                <ItemList items={checkedFlat} {...itemProps} />
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

ShoppingList.propTypes = {
  items: PropTypes.array.isRequired,
  isLoading: PropTypes.bool,
  stores: PropTypes.array,
  sortConfig: PropTypes.arrayOf(PropTypes.string),
  listType: PropTypes.string,
  listId: PropTypes.string,
  listCategories: PropTypes.array,
  getEffectiveChecked: PropTypes.func,
  onToggle: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  onUpdateCategory: PropTypes.func.isRequired,
  onUpdateStore: PropTypes.func.isRequired,
  onUpdateItem: PropTypes.func.isRequired,
  onClearChecked: PropTypes.func.isRequired,
  restoredItemIds: PropTypes.instanceOf(Set),
  onRestoreAnimationDone: PropTypes.func,
  onNavigateToSettings: PropTypes.func,
};

