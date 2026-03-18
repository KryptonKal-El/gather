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
import { ConfirmDialog } from './ConfirmDialog.jsx';
import styles from './CategoryEditor.module.css';

const CATEGORY_COLORS = [
  '#B5E8C8', '#A8D8EA', '#85BFA8', '#FFD6A5', '#FDCFE8', '#B4C7E7', '#D4E09B',
  '#F9A8C9', '#C5B3E6', '#F4C89E', '#A5D6D0', '#C1D5A4', '#F2B5B5', '#D0C4DF',
];

const generateKey = (name, existingKeys) => {
  const base = name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  if (!existingKeys.includes(base)) return base;
  let suffix = 2;
  while (existingKeys.includes(`${base}_${suffix}`)) {
    suffix++;
  }
  return `${base}_${suffix}`;
};

const SortableCategoryRow = ({
  category,
  isExpanded,
  onToggleExpand,
  onRename,
  onColorChange,
  onKeywordsChange,
  onDelete,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.key });

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [keywordInput, setKeywordInput] = useState(
    (category.keywords ?? []).join(', ')
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleNameSave = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== category.name) {
      onRename(category.key, trimmed);
    }
    setIsEditing(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') handleNameSave();
    if (e.key === 'Escape') {
      setEditName(category.name);
      setIsEditing(false);
    }
  };

  const handleKeywordsSave = () => {
    const keywords = keywordInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    onKeywordsChange(category.key, keywords);
  };

  const keywordCount = (category.keywords ?? []).length;

  return (
    <div ref={setNodeRef} style={style} className={styles.categoryItem}>
      <div className={styles.categoryRow}>
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

        <button
          type="button"
          className={styles.colorDot}
          style={{ backgroundColor: category.color }}
          onClick={() => setShowColorPicker(!showColorPicker)}
          aria-label="Change color"
        />

        {isEditing ? (
          <input
            type="text"
            className={styles.nameInput}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={handleNameKeyDown}
            autoFocus
          />
        ) : (
          <button
            type="button"
            className={styles.categoryName}
            onClick={() => {
              setEditName(category.name);
              setIsEditing(true);
            }}
          >
            {category.name}
          </button>
        )}

        {keywordCount > 0 && (
          <span className={styles.keywordCount}>{keywordCount}</span>
        )}

        <button
          type="button"
          className={styles.expandBtn}
          onClick={() => onToggleExpand(category.key)}
          aria-label={isExpanded ? 'Collapse keywords' : 'Expand keywords'}
        >
          {isExpanded ? '▲' : '▼'}
        </button>

        <button
          type="button"
          className={styles.deleteBtn}
          onClick={() => onDelete(category.key)}
          aria-label={`Delete ${category.name}`}
        >
          ×
        </button>
      </div>

      {showColorPicker && (
        <div className={styles.colorPickerDropdown}>
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.colorSwatch} ${category.color === c ? styles.colorSelected : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => {
                onColorChange(category.key, c);
                setShowColorPicker(false);
              }}
              aria-label={`Select color ${c}`}
            />
          ))}
        </div>
      )}

      {isExpanded && (
        <div className={styles.keywordEditor}>
          <label className={styles.keywordLabel}>Keywords (comma-separated)</label>
          <input
            type="text"
            className={styles.keywordInput}
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onBlur={handleKeywordsSave}
            placeholder="e.g. milk, cheese, yogurt"
          />
        </div>
      )}
    </div>
  );
};

/**
 * Category editor for managing list categories.
 * Supports adding, removing, renaming, reordering, color changing, and keyword editing.
 */
export const CategoryEditor = ({ categories, onSave, onClose }) => {
  const [localCategories, setLocalCategories] = useState(categories);
  const [expandedKey, setExpandedKey] = useState(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0]);
  const [confirmingDeleteKey, setConfirmingDeleteKey] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const saveCategories = (updated) => {
    setLocalCategories(updated);
    onSave(updated);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localCategories.findIndex((c) => c.key === active.id);
    const newIndex = localCategories.findIndex((c) => c.key === over.id);
    const reordered = arrayMove(localCategories, oldIndex, newIndex);
    saveCategories(reordered);
  };

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const existingKeys = localCategories.map((c) => c.key);
    const key = generateKey(trimmed, existingKeys);
    const newCategory = {
      key,
      name: trimmed,
      color: newColor,
      keywords: [],
    };
    saveCategories([...localCategories, newCategory]);
    setNewName('');
    setNewColor(CATEGORY_COLORS[0]);
  };

  const handleRename = (key, newNameValue) => {
    const updated = localCategories.map((c) =>
      c.key === key ? { ...c, name: newNameValue } : c
    );
    saveCategories(updated);
  };

  const handleColorChange = (key, color) => {
    const updated = localCategories.map((c) =>
      c.key === key ? { ...c, color } : c
    );
    saveCategories(updated);
  };

  const handleKeywordsChange = (key, keywords) => {
    const updated = localCategories.map((c) =>
      c.key === key ? { ...c, keywords } : c
    );
    saveCategories(updated);
  };

  const handleDelete = (key) => {
    setConfirmingDeleteKey(key);
  };

  const confirmDelete = () => {
    const updated = localCategories.filter((c) => c.key !== confirmingDeleteKey);
    saveCategories(updated);
    setConfirmingDeleteKey(null);
    if (expandedKey === confirmingDeleteKey) setExpandedKey(null);
  };

  const handleToggleExpand = (key) => {
    setExpandedKey(expandedKey === key ? null : key);
  };

  const categoryToDelete = localCategories.find((c) => c.key === confirmingDeleteKey);

  return (
    <div className={styles.editor}>
      <div className={styles.header}>
        <h3 className={styles.title}>Edit Categories</h3>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close editor"
        >
          ×
        </button>
      </div>

      <div className={styles.categoryList}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext
            items={localCategories.map((c) => c.key)}
            strategy={verticalListSortingStrategy}
          >
            {localCategories.map((cat) => (
              <SortableCategoryRow
                key={cat.key}
                category={cat}
                isExpanded={expandedKey === cat.key}
                onToggleExpand={handleToggleExpand}
                onRename={handleRename}
                onColorChange={handleColorChange}
                onKeywordsChange={handleKeywordsChange}
                onDelete={handleDelete}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className={styles.addRow}>
        <button
          type="button"
          className={styles.addColorBtn}
          style={{ backgroundColor: newColor }}
          onClick={() => {
            const currentIndex = CATEGORY_COLORS.indexOf(newColor);
            const nextIndex = (currentIndex + 1) % CATEGORY_COLORS.length;
            setNewColor(CATEGORY_COLORS[nextIndex]);
          }}
          aria-label="Cycle color"
        />
        <input
          type="text"
          className={styles.addInput}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="New category name..."
        />
        <button
          type="button"
          className={styles.addBtn}
          onClick={handleAdd}
          disabled={!newName.trim()}
        >
          Add
        </button>
      </div>

      {confirmingDeleteKey && categoryToDelete && (
        <ConfirmDialog
          message={`Delete "${categoryToDelete.name}" category?`}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmingDeleteKey(null)}
        />
      )}
    </div>
  );
};

CategoryEditor.propTypes = {
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      color: PropTypes.string,
      keywords: PropTypes.arrayOf(PropTypes.string),
    })
  ).isRequired,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
