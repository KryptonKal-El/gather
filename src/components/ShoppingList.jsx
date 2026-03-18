import { useState } from 'react';
import PropTypes from 'prop-types';
import { applySortPipeline, SYSTEM_DEFAULT_SORT_CONFIG } from '../utils/sortPipeline.js';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { ShoppingItem } from './ShoppingItem.jsx';
import styles from './ShoppingList.module.css';

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
const ItemList = ({ items, stores, listType, restoredItemIds, onRestoreAnimationDone, onToggle, onRemove, onUpdateCategory, onUpdateStore, onUpdateItem }) => (
  <>
    {items.map((item) => (
      <ShoppingItem
        key={item.id}
        item={item}
        stores={stores}
        listType={listType}
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
);

/** Renders a group recursively — depth 0 = prominent collapsible card, depth 1+ = small sub-header. */
const GroupRenderer = ({ group, depth = 0, collapsedGroups, onToggleGroup, stores, listType, restoredItemIds, onRestoreAnimationDone, onToggle, onRemove, onUpdateCategory, onUpdateStore, onUpdateItem }) => {
  const itemProps = { stores, listType, restoredItemIds, onRestoreAnimationDone, onToggle, onRemove, onUpdateCategory, onUpdateStore, onUpdateItem };

  const allItems = collectGroupItems(group);

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
          <span className={styles.count}>{allItems.length}</span>
          {subtotal !== null && (
            <span className={styles.subtotal}>{`$${subtotal.toFixed(2)}`}</span>
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
    <div className={styles.nestedGroup}>
      <h4 className={styles.nestedGroupTitle}>
        <span className={styles.nestedGroupDot} style={{ backgroundColor: group.color ?? '#9e9e9e' }} />
        {group.label}
        <span className={styles.count}>{allItems.length}</span>
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
  stores,
  sortConfig,
  listType,
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
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  const handleToggleGroup = (groupKey) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const rsvpSummary = listType === 'guest_list' ? (() => {
    const counts = { invited: 0, confirmed: 0, declined: 0, maybe: 0, not_invited: 0 };
    let totalHeadCount = 0;
    for (const item of items) {
      const status = item.rsvpStatus ?? 'invited';
      counts[status] = (counts[status] ?? 0) + 1;
      totalHeadCount += item.quantity ?? 1;
    }
    return { counts, totalHeadCount };
  })() : null;

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
  const uncheckedResult = applySortPipeline(unchecked, config, stores, listType);
  const checkedResult = applySortPipeline(checkedItems, config, stores, listType);

  const itemProps = { stores, listType, restoredItemIds, onRestoreAnimationDone, onToggle, onRemove, onUpdateCategory, onUpdateStore, onUpdateItem };
  const groupProps = { collapsedGroups, onToggleGroup: handleToggleGroup, ...itemProps };

  return (
    <div className={styles.list}>
      {rsvpSummary && (
        <div className={styles.rsvpSummary}>
          <div className={styles.rsvpSummaryStats}>
            <span className={styles.rsvpSummaryStat} style={{ color: '#4caf50' }}>
              {rsvpSummary.counts.confirmed} Confirmed
            </span>
            <span className={styles.rsvpSummaryDivider}>·</span>
            <span className={styles.rsvpSummaryStat} style={{ color: '#ff9800' }}>
              {rsvpSummary.counts.maybe} Maybe
            </span>
            <span className={styles.rsvpSummaryDivider}>·</span>
            <span className={styles.rsvpSummaryStat} style={{ color: '#f44336' }}>
              {rsvpSummary.counts.declined} Declined
            </span>
            <span className={styles.rsvpSummaryDivider}>·</span>
            <span className={styles.rsvpSummaryStat} style={{ color: '#42a5f5' }}>
              {rsvpSummary.counts.invited} Invited
            </span>
            <span className={styles.rsvpSummaryDivider}>·</span>
            <span className={styles.rsvpSummaryStat} style={{ color: '#9e9e9e' }}>
              {rsvpSummary.counts.not_invited} Not Yet Invited
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

      {/* Checked items section */}
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
          {/* Checked items use the same pipeline */}
          {checkedResult.groups.map((group) => (
            <GroupRenderer key={group.key} group={group} depth={0} {...groupProps} />
          ))}
          {checkedResult.ungrouped?.length > 0 && (
            <ItemList items={checkedResult.ungrouped} {...itemProps} />
          )}
          {checkedResult.items?.length > 0 && (
            <ItemList items={checkedResult.items} {...itemProps} />
          )}
        </div>
      )}
    </div>
  );
};

ShoppingList.propTypes = {
  items: PropTypes.array.isRequired,
  stores: PropTypes.array,
  sortConfig: PropTypes.arrayOf(PropTypes.string),
  listType: PropTypes.string,
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
  sortConfig: null,
  listType: 'grocery',
  restoredItemIds: null,
  onRestoreAnimationDone: null,
};
