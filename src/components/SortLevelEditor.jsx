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
import styles from './SortLevelEditor.module.css';

const LEVEL_LABELS = {
  store: 'Store',
  category: 'Category',
  name: 'Name',
  date: 'Date Added',
  price: 'Price',
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
        disabled={!canRemove}
        aria-label={`Remove ${LEVEL_LABELS[id]}`}
      >
        ×
      </button>
    </div>
  );
};

/**
 * Inline drag-to-reorder sort level editor.
 * Allows adding, removing, and reordering up to 3 sort levels.
 */
export const SortLevelEditor = ({ config, onConfigChange, disabled = false, listType = 'grocery' }) => {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const typeConfig = getTypeConfig(listType);
  const availableLevels = typeConfig.sortLevels;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    if (disabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = config.indexOf(active.id);
    const newIndex = config.indexOf(over.id);
    const newConfig = arrayMove(config, oldIndex, newIndex);
    onConfigChange(newConfig);
  };

  const handleRemove = (level) => {
    if (disabled || config.length <= 1) return;
    const newConfig = config.filter((l) => l !== level);
    onConfigChange(newConfig);
  };

  const handleAdd = (level) => {
    if (disabled) return;
    const newConfig = [...config, level];
    onConfigChange(newConfig);
    setAddMenuOpen(false);
  };

  const unusedLevels = availableLevels.filter((l) => !config.includes(l));
  const canAddMore = config.length < 3 && unusedLevels.length > 0;
  const canRemove = config.length > 1;

  return (
    <div className={`${styles.editor} ${disabled ? styles.disabled : ''}`}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext
          items={config}
          strategy={verticalListSortingStrategy}
        >
          {config.map((level, index) => (
            <SortableLevelRow
              key={level}
              id={level}
              onRemove={handleRemove}
              canRemove={canRemove && !disabled}
              isLast={!canAddMore && index === config.length - 1}
            />
          ))}
        </SortableContext>
      </DndContext>

      {canAddMore && (
        <div className={styles.addSection}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setAddMenuOpen((o) => !o)}
            disabled={disabled}
          >
            + Add Level
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

SortLevelEditor.propTypes = {
  config: PropTypes.arrayOf(PropTypes.string).isRequired,
  onConfigChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  listType: PropTypes.string,
};
