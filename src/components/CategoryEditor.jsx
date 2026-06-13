import { useState, useEffect, useRef } from 'react';
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
  onEdit,
  onDelete,
  disableDrag,
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
  const [editColor, setEditColor] = useState(category.color);
  const [menuOpen, setMenuOpen] = useState(false);
  const [keywordInput, setKeywordInput] = useState(
    (category.keywords ?? []).join(', ')
  );
  const customColorRef = useRef(null);
  const menuRef = useRef(null);
  const actionSheetRef = useRef(null);

  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartRef = useRef(null);
  const swipeDirectionRef = useRef(null);
  const swipeContentRef = useRef(null);
  const dragHandleRef = useRef(null);
  const swipeXRef = useRef(0);
  const isSwipingRef = useRef(false);

  const [isMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        (!actionSheetRef.current || !actionSheetRef.current.contains(e.target))
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleStartEdit = () => {
    setEditName(category.name);
    setEditColor(category.color);
    setKeywordInput((category.keywords ?? []).join(', '));
    setIsEditing(true);
    setMenuOpen(false);
  };

  const handleSaveEdit = () => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    const keywords = keywordInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    onEdit(category.key, { name: trimmed, color: editColor, keywords });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') handleSaveEdit();
    if (e.key === 'Escape') handleCancelEdit();
  };

  useEffect(() => {
    if (!isMobile) return;
    const el = swipeContentRef.current;
    if (!el) return;

    const handleTouchStart = (e) => {
      if (dragHandleRef.current?.contains(e.target)) return;
      const touch = e.touches[0];
      const EDGE_THRESHOLD = 20;
      if (touch.clientX <= EDGE_THRESHOLD || touch.clientX >= window.innerWidth - EDGE_THRESHOLD) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      swipeDirectionRef.current = null;
    };

    const handleTouchMove = (e) => {
      if (!touchStartRef.current) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      if (swipeDirectionRef.current === null) {
        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          swipeDirectionRef.current = 'vertical';
          return;
        }
        swipeDirectionRef.current = 'horizontal';
      }

      if (swipeDirectionRef.current === 'vertical') return;

      const clampedDeltaX = Math.min(0, deltaX);
      swipeXRef.current = clampedDeltaX;
      setSwipeX(clampedDeltaX);
      isSwipingRef.current = true;
      setIsSwiping(true);
      e.preventDefault();
    };

    const handleTouchEnd = () => {
      if (!isSwipingRef.current || !touchStartRef.current) {
        touchStartRef.current = null;
        swipeDirectionRef.current = null;
        return;
      }

      const SWIPE_THRESHOLD = 80;
      if (Math.abs(swipeXRef.current) >= SWIPE_THRESHOLD) {
        swipeXRef.current = 0;
        setSwipeX(0);
        isSwipingRef.current = false;
        setIsSwiping(false);
        onDelete(category.key);
      } else {
        swipeXRef.current = 0;
        setSwipeX(0);
        isSwipingRef.current = false;
        setIsSwiping(false);
      }
      touchStartRef.current = null;
      swipeDirectionRef.current = null;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, category.key, onDelete, isEditing]);

  const getSwipeStyle = () => {
    if (isSwiping || swipeX !== 0) {
      return {
        transform: `translateX(${swipeX}px)`,
        transition: isSwiping ? 'none' : 'transform 0.2s ease-out',
      };
    }
    return undefined;
  };

  const keywordCount = (category.keywords ?? []).length;

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className={styles.categoryItem}>
        <div className={styles.editForm}>
          <input
            type="text"
            className={styles.nameInput}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleEditKeyDown}
            placeholder="Category name"
            autoFocus
          />
          <div className={styles.editColorPicker}>
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.colorSwatch} ${editColor === c ? styles.colorSelected : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setEditColor(c)}
                aria-label={`Select color ${c}`}
              />
            ))}
            <div className={styles.customColorWrapper}>
              <input
                ref={customColorRef}
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className={styles.customColorInput}
              />
              <button
                type="button"
                className={styles.customColorBtn}
                onClick={() => customColorRef.current?.click()}
                aria-label="Choose custom color"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </button>
            </div>
          </div>
          <div>
            <label className={styles.keywordLabel}>Keywords (comma-separated)</label>
            <input
              type="text"
              className={styles.keywordInput}
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={handleEditKeyDown}
              placeholder="e.g. milk, cheese, yogurt"
            />
          </div>
          <div className={styles.editActions}>
            <button type="button" className={styles.cancelBtn} onClick={handleCancelEdit}>
              Cancel
            </button>
            <button type="button" className={styles.saveBtn} onClick={handleSaveEdit} disabled={!editName.trim()}>
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className={`${styles.categoryItem} ${menuOpen ? styles.menuOpenItem : ''}`}>
      <div className={styles.swipeContainer}>
        {isMobile && (isSwiping || swipeX !== 0) && (
          <div className={`${styles.swipeBehind} ${Math.abs(swipeX) >= 80 ? styles.swipeBehindActive : ''}`}>
            <span className={styles.swipeDeleteText}>Delete</span>
          </div>
        )}
        <div
          ref={swipeContentRef}
          className={`${styles.swipeContent} ${isSwiping ? styles.swipeSwiping : ''}`}
          style={getSwipeStyle()}
        >
          <div className={styles.categoryRow}>
            {!disableDrag && (
              <button
                ref={dragHandleRef}
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
            )}

            <span
              className={styles.colorDot}
              style={{ backgroundColor: category.color }}
            />

            <span className={styles.categoryName}>{category.name}</span>

            {keywordCount > 0 && (
              <span className={styles.keywordCount}>{keywordCount}</span>
            )}

            <div className={styles.menuWrap} ref={menuOpen ? menuRef : null}>
              <button
                type="button"
                className={styles.menuBtn}
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Category options"
              >
                ⋯
              </button>
              {menuOpen && !isMobile && (
                <div className={styles.menuDropdown}>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={handleStartEdit}
                  >
                    Edit Category
                  </button>
                  <button
                    type="button"
                    className={`${styles.menuItem} ${styles.menuDanger}`}
                    onClick={() => { onDelete(category.key); setMenuOpen(false); }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {menuOpen && isMobile && (
        <>
          <div className={styles.actionSheetBackdrop} onClick={() => setMenuOpen(false)} />
          <div className={styles.actionSheet} ref={actionSheetRef}>
            <div className={styles.actionSheetGroup}>
              <div className={styles.actionSheetTitle}>{category.name}</div>
              <button
                type="button"
                className={styles.actionSheetItem}
                onClick={handleStartEdit}
              >
                Edit Category
              </button>
              <button
                type="button"
                className={`${styles.actionSheetItem} ${styles.actionSheetDanger}`}
                onClick={() => { onDelete(category.key); setMenuOpen(false); }}
              >
                Delete Category
              </button>
            </div>
            <button
              type="button"
              className={styles.actionSheetCancel}
              onClick={() => setMenuOpen(false)}
            >
              Cancel
            </button>
          </div>
        </>
      )}

    </div>
  );
};

/**
 * Category editor for managing list categories.
 * Supports adding, removing, renaming, reordering, color changing, and keyword editing.
 * Changes apply immediately - every edit calls onSave right away.
 * @param {Object} props
 * @param {Array} props.categories - Array of category objects
 * @param {string} [props.listType] - List type for "Save as Default" feature
 * @param {Function} props.onSave - Called with the updated categories after every change
 * @param {Function} [props.onSaveAsDefault] - Called when "Save as Default" is clicked
 * @param {Function} [props.onClose] - Called when the close button is clicked
 * @param {boolean} [props.showHeader=true] - Whether to show the header bar
 * @param {boolean} [props.embedded=false] - Strips the card chrome when hosted inside another container
 * @param {string} [props.title='Your Categories'] - Label shown in the section header row
 * @param {string} [props.description] - Optional subtext shown under the section header row
 */
export const CategoryEditor = ({ categories, listType, onSave, onSaveAsDefault, onClose, showHeader = true, embedded = false, title = 'Your Categories', description }) => {
  const [localCategories, setLocalCategories] = useState(categories);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0]);
  const [confirmingDeleteKey, setConfirmingDeleteKey] = useState(null);
  const [showSaveDefaultConfirm, setShowSaveDefaultConfirm] = useState(false);
  const [saveDefaultSuccess, setSaveDefaultSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const newCustomColorRef = useRef(null);

  const categoriesJson = JSON.stringify(categories);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalCategories(categories);
  }, [categoriesJson]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!saveDefaultSuccess) return;
    const timeout = setTimeout(() => setSaveDefaultSuccess(false), 2000);
    return () => clearTimeout(timeout);
  }, [saveDefaultSuccess]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const updateLocal = (updated) => {
    setLocalCategories(updated);
    onSave(updated);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localCategories.findIndex((c) => c.key === active.id);
    const newIndex = localCategories.findIndex((c) => c.key === over.id);
    const reordered = arrayMove(localCategories, oldIndex, newIndex);
    updateLocal(reordered);
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
    updateLocal([...localCategories, newCategory]);
    setNewName('');
    setNewColor(CATEGORY_COLORS[0]);
    setSearchQuery('');
    setIsCreating(false);
  };

  const handleEdit = (key, updates) => {
    const updated = localCategories.map((c) =>
      c.key === key ? { ...c, ...updates } : c
    );
    updateLocal(updated);
  };

  const handleDelete = (key) => {
    setConfirmingDeleteKey(key);
  };

  const confirmDelete = () => {
    const updated = localCategories.filter((c) => c.key !== confirmingDeleteKey);
    updateLocal(updated);
    setConfirmingDeleteKey(null);
  };

  const handleSaveAsDefault = async () => {
    if (onSaveAsDefault && listType) {
      await onSaveAsDefault(listType, localCategories);
      setShowSaveDefaultConfirm(false);
      setSaveDefaultSuccess(true);
    }
  };

  const categoryToDelete = localCategories.find((c) => c.key === confirmingDeleteKey);
  const listTypeDisplay = listType ? listType.charAt(0).toUpperCase() + listType.slice(1) : '';

  const filteredCategories = localCategories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const isSearching = searchQuery.trim() !== '';

  const handleDeleteAll = () => {
    updateLocal([]);
    setShowDeleteAllConfirm(false);
  };

  return (
    <div className={`${styles.editor} ${embedded ? styles.editorEmbedded : ''}`}>
      {showHeader && (
        <div className={styles.header}>
          <h3 className={styles.title}>Manage Categories</h3>
          {onClose && (
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close"
            >
              &times;
            </button>
          )}
        </div>
      )}

      <div className={styles.headerRow}>
        <h4 className={styles.sectionTitle}>{title} ({localCategories.length})</h4>
        <button
          type="button"
          className={styles.newBtn}
          onClick={() => setIsCreating(!isCreating)}
        >
          {isCreating ? 'Cancel' : '+ New'}
        </button>
      </div>

      {description && <p className={styles.description}>{description}</p>}

      <div className={styles.searchBarWrapper}>
        <input
          type="text"
          className={styles.searchBar}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search categories..."
        />
      </div>

      {isCreating && (
        <div className={styles.createForm}>
          <input
            type="text"
            className={styles.nameInput}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Category name (e.g. Produce, Snacks)"
            autoFocus
          />
          <div className={styles.editColorPicker}>
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.colorSwatch} ${newColor === c ? styles.colorSelected : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setNewColor(c)}
                aria-label={`Select color ${c}`}
              />
            ))}
            <div className={styles.customColorWrapper}>
              <input
                ref={newCustomColorRef}
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className={styles.customColorInput}
              />
              <button
                type="button"
                className={styles.customColorBtn}
                onClick={() => newCustomColorRef.current?.click()}
                aria-label="Choose custom color"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </button>
            </div>
          </div>
          <button
            type="button"
            className={styles.createBtn}
            onClick={handleAdd}
            disabled={!newName.trim()}
          >
            Create
          </button>
        </div>
      )}

      <div className={styles.categoryList}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext
            items={filteredCategories.map((c) => c.key)}
            strategy={verticalListSortingStrategy}
          >
            {filteredCategories.map((cat) => (
              <SortableCategoryRow
                key={cat.key}
                category={cat}
                onEdit={handleEdit}
                onDelete={handleDelete}
                disableDrag={isSearching}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {localCategories.length > 0 && (
        <div className={styles.deleteAllSection}>
          <button
            type="button"
            className={styles.deleteAllButton}
            onClick={() => setShowDeleteAllConfirm(true)}
          >
            Delete All
          </button>
        </div>
      )}

      {listType && onSaveAsDefault && (
        <div className={styles.saveDefaultSection}>
          <button
            type="button"
            className={styles.saveDefaultButton}
            onClick={() => setShowSaveDefaultConfirm(true)}
          >
            Save as Default for {listTypeDisplay}
          </button>
          {saveDefaultSuccess && (
            <div className={styles.saveDefaultSuccess}>Saved as default!</div>
          )}
        </div>
      )}

      {showSaveDefaultConfirm && (
        <ConfirmDialog
          message={`This will replace your default ${listTypeDisplay} categories with this list's categories. Continue?`}
          confirmLabel="Save"
          destructive={false}
          onConfirm={handleSaveAsDefault}
          onCancel={() => setShowSaveDefaultConfirm(false)}
        />
      )}

      {confirmingDeleteKey && categoryToDelete && (
        <ConfirmDialog
          message={`Delete "${categoryToDelete.name}" category?`}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmingDeleteKey(null)}
        />
      )}

      {showDeleteAllConfirm && (
        <ConfirmDialog
          message="Delete all categories? This will remove all categories from this list."
          onConfirm={handleDeleteAll}
          onCancel={() => setShowDeleteAllConfirm(false)}
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
  listType: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onSaveAsDefault: PropTypes.func,
  onClose: PropTypes.func,
  showHeader: PropTypes.bool,
  embedded: PropTypes.bool,
  title: PropTypes.string,
  description: PropTypes.string,
};
