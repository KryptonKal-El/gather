import { useState, useRef, useEffect } from 'react';
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
import { SORT_LEVELS } from '../utils/sortPipeline.js';
import styles from './SortPicker.module.css';

const LEVEL_LABELS = {
  store: 'Store',
  category: 'Category',
  name: 'Name',
  date: 'Date Added',
};

const SortableLevelRow = ({ id, onRemove, canRemove }) => {
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
    <div ref={setNodeRef} style={style} className={styles.levelRow}>
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
 * Drag-to-reorder sort level editor with popover UI.
 * Allows adding, removing, and reordering up to 3 sort levels.
 */
export const SortPicker = ({ currentConfig, hasOverride, onSelect }) => {
  const [open, setOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = currentConfig.indexOf(active.id);
    const newIndex = currentConfig.indexOf(over.id);
    const newConfig = arrayMove(currentConfig, oldIndex, newIndex);
    onSelect(newConfig);
  };

  const handleRemove = (level) => {
    if (currentConfig.length <= 1) return;
    const newConfig = currentConfig.filter((l) => l !== level);
    onSelect(newConfig);
  };

  const handleAdd = (level) => {
    const newConfig = [...currentConfig, level];
    onSelect(newConfig);
    setAddMenuOpen(false);
  };

  const handleUseDefault = () => {
    onSelect(null);
    setOpen(false);
    setAddMenuOpen(false);
  };

  const unusedLevels = SORT_LEVELS.filter((l) => !currentConfig.includes(l));
  const canAddMore = currentConfig.length < 3 && unusedLevels.length > 0;
  const canRemove = currentConfig.length > 1;

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-label="Sort items"
        aria-expanded={open}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 15l5 5 5-5" />
          <path d="M7 9l5-5 5 5" />
        </svg>
      </button>
      {open && (
        <div className={styles.popover}>
          <div className={styles.header}>Sort Levels</div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext
              items={currentConfig}
              strategy={verticalListSortingStrategy}
            >
              {currentConfig.map((level) => (
                <SortableLevelRow
                  key={level}
                  id={level}
                  onRemove={handleRemove}
                  canRemove={canRemove}
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
              >
                + Add Level
              </button>
              {addMenuOpen && (
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

          {hasOverride && (
            <>
              <div className={styles.divider} />
              <button
                type="button"
                className={styles.useDefault}
                onClick={handleUseDefault}
              >
                Use Default
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

SortPicker.propTypes = {
  currentConfig: PropTypes.arrayOf(PropTypes.string).isRequired,
  hasOverride: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
};
