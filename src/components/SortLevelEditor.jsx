import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { getTypeConfig } from '../utils/listTypes.js';
import {
  GROUPING_LEVELS,
  MAX_GROUP_LEVELS,
  MAX_SORT_ONLY_LEVELS,
  partitionSortConfig,
  combineSortConfig,
} from '../utils/sortPipeline.js';
import styles from './SortLevelEditor.module.css';

const LEVEL_LABELS = {
  store: 'Store',
  category: 'Category',
  name: 'Name',
  date: 'Date Added',
  price: 'Price',
  rsvp: 'RSVP Status',
  dueDate: 'Due Date',
};

const SortableLevelRow = ({ id, onRemove, canRemove, isLast }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.levelRow} ${isLast ? styles.levelRowLast : ''}`}
    >
      <button
        type="button"
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="5" r="1.5" />
          <circle cx="15" cy="5" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="19" r="1.5" />
          <circle cx="15" cy="19" r="1.5" />
        </svg>
      </button>
      <span className={styles.levelLabel}>{LEVEL_LABELS[id]}</span>
      <button
        type="button"
        className={styles.removeBtn}
        onClick={() => onRemove(id)}
        onPointerDown={(e) => e.stopPropagation()}
        disabled={!canRemove}
        aria-label={`Remove ${LEVEL_LABELS[id]}`}
      >
        ×
      </button>
    </div>
  );
};

/**
 * Section component for either Group By or Sort By.
 * Contains its own DndContext for isolated drag-and-drop.
 */
const SortSection = ({
  label,
  levels,
  availableLevels,
  maxLevels,
  canRemove,
  disabled,
  onReorder,
  onAdd,
  onRemove,
  emptyText,
}) => {
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    if (disabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = levels.indexOf(active.id);
    const newIndex = levels.indexOf(over.id);
    const newLevels = arrayMove(levels, oldIndex, newIndex);
    onReorder(newLevels);
  };

  const handleRemove = (level) => {
    if (disabled) return;
    onRemove(level);
  };

  const handleAdd = (level) => {
    if (disabled) return;
    onAdd(level);
    setAddMenuOpen(false);
  };

  const unusedLevels = availableLevels.filter((l) => !levels.includes(l));
  const canAddMore = levels.length < maxLevels && unusedLevels.length > 0;

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{label}</div>
      {levels.length === 0 && emptyText ? (
        <div className={styles.emptyState}>{emptyText}</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext
            items={levels}
            strategy={verticalListSortingStrategy}
          >
            {levels.map((level, index) => (
              <SortableLevelRow
                key={level}
                id={level}
                onRemove={handleRemove}
                canRemove={canRemove && !disabled}
                isLast={!canAddMore && index === levels.length - 1}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {canAddMore && (
        <div className={styles.addSection}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setAddMenuOpen((o) => !o)}
            disabled={disabled}
          >
            + Add
          </button>
          {addMenuOpen && !disabled && (
            <div className={styles.addMenu}>
              {unusedLevels.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={styles.addOption}
                  onClick={() => handleAdd(level)}
                >
                  {LEVEL_LABELS[level]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Two-section sort level editor with "Group By" and "Sort By" sections.
 * Groups create visual headers; sort-only levels order items within groups.
 */
export const SortLevelEditor = ({ config, onConfigChange, disabled = false, listType = 'grocery' }) => {
  const typeConfig = getTypeConfig(listType);
  const availableLevels = typeConfig.sortLevels;

  const availableGroupLevels = availableLevels.filter((l) => GROUPING_LEVELS.includes(l));
  const availableSortOnlyLevels = availableLevels.filter((l) => !GROUPING_LEVELS.includes(l));

  const { groupLevels, sortOnlyLevels } = partitionSortConfig(config);

  const hasGroupableOptions = availableGroupLevels.length > 0;

  const handleGroupReorder = (newGroupLevels) => {
    onConfigChange(combineSortConfig(newGroupLevels, sortOnlyLevels));
  };

  const handleSortReorder = (newSortOnlyLevels) => {
    onConfigChange(combineSortConfig(groupLevels, newSortOnlyLevels));
  };

  const handleGroupAdd = (level) => {
    const newGroupLevels = [...groupLevels, level];
    onConfigChange(combineSortConfig(newGroupLevels, sortOnlyLevels));
  };

  const handleSortAdd = (level) => {
    const newSortOnlyLevels = [...sortOnlyLevels, level];
    onConfigChange(combineSortConfig(groupLevels, newSortOnlyLevels));
  };

  const handleGroupRemove = (level) => {
    const newGroupLevels = groupLevels.filter((l) => l !== level);
    onConfigChange(combineSortConfig(newGroupLevels, sortOnlyLevels));
  };

  const handleSortRemove = (level) => {
    if (sortOnlyLevels.length <= 1) return;
    const newSortOnlyLevels = sortOnlyLevels.filter((l) => l !== level);
    onConfigChange(combineSortConfig(groupLevels, newSortOnlyLevels));
  };

  return (
    <div className={`${styles.editor} ${disabled ? styles.disabled : ''}`}>
      {hasGroupableOptions && (
        <SortSection
          label="Group By"
          levels={groupLevels}
          availableLevels={availableGroupLevels}
          maxLevels={MAX_GROUP_LEVELS}
          canRemove={true}
          disabled={disabled}
          onReorder={handleGroupReorder}
          onAdd={handleGroupAdd}
          onRemove={handleGroupRemove}
          emptyText="No grouping"
        />
      )}

      <SortSection
        label="Sort By"
        levels={sortOnlyLevels}
        availableLevels={availableSortOnlyLevels}
        maxLevels={MAX_SORT_ONLY_LEVELS}
        canRemove={sortOnlyLevels.length > 1}
        disabled={disabled}
        onReorder={handleSortReorder}
        onAdd={handleSortAdd}
        onRemove={handleSortRemove}
      />
    </div>
  );
};

SortLevelEditor.propTypes = {
  config: PropTypes.arrayOf(PropTypes.string).isRequired,
  onConfigChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  listType: PropTypes.string,
};
