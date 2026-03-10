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
import { DEFAULT_CATEGORIES } from '../utils/categories.js';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import styles from './StoreManager.module.css';

const PRESET_COLORS = [
  '#1565c0', '#6a1b9a', '#00838f', '#2e7d32', '#ef6c00',
  '#c62828', '#4527a0', '#00695c', '#ad1457', '#37474f',
  '#f9a825', '#4e342e', '#1b5e20', '#283593', '#bf360c',
  '#0277bd', '#558b2f', '#7b1fa2',
];

const CATEGORY_PRESET_COLORS = [
  '#4caf50', '#2196f3', '#e53935', '#ff9800', '#00bcd4',
  '#795548', '#9c27b0', '#ffc107', '#ff5722', '#607d8b',
  '#e91e63', '#9e9e9e', '#1565c0', '#6a1b9a', '#00838f',
  '#2e7d32', '#ef6c00', '#4527a0',
];

/**
 * Inline category editor for a single store.
 * Supports add, remove (with confirm), rename, reorder, color picker,
 * keyword editing, and copying categories from defaults or another store.
 * All changes persist to the database immediately via onSave.
 */
const StoreCategoryEditor = ({ categories, otherStores, onSave }) => {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(CATEGORY_PRESET_COLORS[0]);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [confirmingDeleteIndex, setConfirmingDeleteIndex] = useState(-1);
  const [isCopyMenuOpen, setIsCopyMenuOpen] = useState(false);

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return;
    const key = `custom_${Date.now()}`;
    onSave([...categories, { key, name: trimmed, color: newColor, keywords: [] }]);
    setNewName('');
    setNewColor(CATEGORY_PRESET_COLORS[0]);
  };

  const handleAddKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleDelete = (index) => {
    onSave(categories.filter((_, i) => i !== index));
    setConfirmingDeleteIndex(-1);
  };

  const handleStartEdit = (index) => {
    const cat = categories[index];
    setEditingIndex(index);
    setEditName(cat.name);
    setEditColor(cat.color);
    setEditKeywords(cat.keywords.join(', '));
  };

  const handleSaveEdit = () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingIndex(-1);
      return;
    }
    const updated = [...categories];
    updated[editingIndex] = {
      ...updated[editingIndex],
      name: trimmed,
      color: editColor,
      keywords: editKeywords
        .split(',')
        .map((kw) => kw.trim())
        .filter(Boolean),
    };
    onSave(updated);
    setEditingIndex(-1);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') handleSaveEdit();
    if (e.key === 'Escape') setEditingIndex(-1);
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const reordered = [...categories];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    onSave(reordered);
  };

  const handleMoveDown = (index) => {
    if (index === categories.length - 1) return;
    const reordered = [...categories];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    onSave(reordered);
  };

  const handleCopyDefaults = () => {
    onSave(DEFAULT_CATEGORIES.map((c) => ({ ...c })));
    setIsCopyMenuOpen(false);
  };

  const handleCopyFromStore = (store) => {
    const copied = (store.categories ?? []).map((c) => ({ ...c, keywords: [...c.keywords] }));
    onSave(copied);
    setIsCopyMenuOpen(false);
  };

  return (
    <div className={styles.catEditor}>
      <div className={styles.catHeader}>
        <h5 className={styles.catTitle}>Categories ({categories.length})</h5>
        <button
          type="button"
          className={styles.copyBtn}
          onClick={() => setIsCopyMenuOpen(!isCopyMenuOpen)}
        >
          {isCopyMenuOpen ? 'Cancel' : 'Copy from\u2026'}
        </button>
      </div>

      {isCopyMenuOpen && (
        <div className={styles.copyMenu}>
          <button
            type="button"
            className={styles.copyMenuOption}
            onClick={handleCopyDefaults}
          >
            Default categories ({DEFAULT_CATEGORIES.length})
          </button>
          {otherStores.map((s) => (
            <button
              key={s.id}
              type="button"
              className={styles.copyMenuOption}
              onClick={() => handleCopyFromStore(s)}
            >
              <span
                className={styles.copyMenuDot}
                style={{ backgroundColor: s.color }}
              />
              {s.name} ({s.categories?.length ?? 0})
            </button>
          ))}
        </div>
      )}

      {categories.length === 0 && (
        <p className={styles.catEmpty}>No categories. Add one below.</p>
      )}

      <div className={styles.catList}>
        {categories.map((cat, index) => (
          <div key={`${cat.key}-${index}`} className={styles.catRow}>
            {editingIndex === index ? (
              <div className={styles.catEditForm}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className={styles.catRenameInput}
                  placeholder="Category name"
                  autoFocus
                />
                <div className={styles.catEditColorPicker}>
                  {CATEGORY_PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`${styles.catColorSwatch} ${editColor === c ? styles.catColorSelected : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setEditColor(c)}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
                <input
                  type="text"
                  value={editKeywords}
                  onChange={(e) => setEditKeywords(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className={styles.catRenameInput}
                  placeholder="Keywords (comma-separated)"
                />
                <div className={styles.catEditActions}>
                  <button
                    type="button"
                    className={styles.catEditSaveBtn}
                    onClick={handleSaveEdit}
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    className={styles.catEditCancelBtn}
                    onClick={() => setEditingIndex(-1)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span
                  className={styles.catBadge}
                  style={{ backgroundColor: cat.color }}
                >
                  {cat.name}
                </span>
                <span className={styles.catKeywordCount}>
                  {cat.keywords.length} keywords
                </span>
                <div className={styles.catActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    aria-label="Move up"
                    title="Move up"
                  >
                    &uarr;
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => handleMoveDown(index)}
                    disabled={index === categories.length - 1}
                    aria-label="Move down"
                    title="Move down"
                  >
                    &darr;
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => handleStartEdit(index)}
                    aria-label="Edit"
                    title="Edit"
                  >
                    &#9998;
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.deleteIcon}`}
                    onClick={() => setConfirmingDeleteIndex(index)}
                    aria-label={`Delete ${cat.name}`}
                    title="Delete"
                  >
                    &times;
                  </button>
                  {confirmingDeleteIndex === index && (
                    <ConfirmDialog
                      message={`Delete category "${cat.name}"?`}
                      onConfirm={() => handleDelete(index)}
                      onCancel={() => setConfirmingDeleteIndex(-1)}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className={styles.catAddRow}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleAddKeyDown}
          className={styles.catAddInput}
          placeholder="New category name..."
        />
        <div className={styles.catAddColorPicker}>
          {CATEGORY_PRESET_COLORS.slice(0, 6).map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.catColorSwatch} ${newColor === c ? styles.catColorSelected : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setNewColor(c)}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <button
          type="button"
          className={styles.catAddBtn}
          onClick={handleAdd}
          disabled={!newName.trim()}
        >
          Add
        </button>
      </div>
    </div>
  );
};

const SortableStoreItem = ({ id, children, isMobile }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {typeof children === 'function' ? children({ attributes, listeners, isDragging, isMobile }) : children}
    </div>
  );
};

/**
 * Panel for managing stores: create, rename, delete, pick color, reorder,
 * and manage categories per store. Renders mobile or desktop layout based on viewport.
 * @param {Object} props
 * @param {Array} props.stores - List of store objects.
 * @param {Function} props.onAdd - Callback to add a new store.
 * @param {Function} props.onUpdate - Callback to update a store.
 * @param {Function} props.onDelete - Callback to delete a store.
 * @param {Function} props.onReorder - Callback to reorder stores.
 */
export const StoreManager = ({
  stores,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [catExpandedId, setCatExpandedId] = useState(null);
  const isMobile = useIsMobile();
  const menuRef = useRef(null);
  const actionSheetRef = useRef(null);

  useEffect(() => {
    if (!menuOpenId) return;
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        (!actionSheetRef.current || !actionSheetRef.current.contains(e.target))
      ) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenId]);

  const filteredStores = searchQuery.trim()
    ? stores.filter((s) => s.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : stores;

  const ownStores = stores.filter((s) => !s._isShared);
  const sharedStores = stores.filter((s) => s._isShared);
  const filteredOwnStores = filteredStores.filter((s) => !s._isShared);
  const filteredSharedStores = filteredStores.filter((s) => s._isShared);

  const handleCreate = (e) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAdd(trimmed, newColor);
    setNewName('');
    setNewColor(PRESET_COLORS[0]);
    setIsCreating(false);
    setSearchQuery('');
  };

  const handleStartEdit = (store) => {
    setEditingId(store.id);
    setEditName(store.name);
    setEditColor(store.color);
    setMenuOpenId(null);
  };

  const handleSaveEdit = (id) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    onUpdate(id, { name: trimmed, color: editColor });
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ownStores.findIndex((s) => s.id === active.id);
    const newIndex = ownStores.findIndex((s) => s.id === over.id);
    onReorder(arrayMove(ownStores, oldIndex, newIndex));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleSaveCategories = (storeId, categories) => {
    onUpdate(storeId, { categories });
  };

  const toggleCatExpanded = (storeId) => {
    setCatExpandedId((prev) => (prev === storeId ? null : storeId));
  };

  const renderCreateForm = () => (
    <form className={styles.createForm} onSubmit={handleCreate}>
      <input
        type="text"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className={styles.createInput}
        placeholder="Store name (e.g. Walmart, Costco)"
        autoFocus
      />
      <div className={styles.colorPicker}>
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.colorSwatch} ${newColor === c ? styles.colorSelected : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => setNewColor(c)}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>
      <button type="submit" className={styles.createBtn} disabled={!newName.trim()}>
        Create
      </button>
    </form>
  );

  const renderStoreItem = (store, index, dragProps) => {
    if (editingId === store.id) {
      return (
        <div className={styles.storeItem}>
          <div className={styles.editForm}>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className={styles.input}
              placeholder="Store name"
              autoFocus
            />
            <div className={styles.colorPicker}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorSwatch} ${editColor === c ? styles.colorSelected : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setEditColor(c)}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
            <div className={styles.editActions}>
              <button type="button" className={styles.saveBtn} onClick={() => handleSaveEdit(store.id)}>
                Save
              </button>
              <button type="button" className={styles.cancelBtn} onClick={handleCancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.storeItem}>
        <div
          className={`${styles.storeItemRow} ${store._isShared ? styles.sharedStoreRow : ''}`}
          onClick={() => !store._isShared && toggleCatExpanded(store.id)}
          {...(dragProps && isMobile ? { ...dragProps.attributes, ...dragProps.listeners, style: { touchAction: 'none' } } : {})}
        >
          {!isMobile && dragProps && !store._isShared && (
            <button type="button" className={styles.dragHandle} {...dragProps.attributes} {...dragProps.listeners} onClick={(e) => e.stopPropagation()} aria-label="Drag to reorder">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
              </svg>
            </button>
          )}
          <span className={styles.storeDot} style={{ backgroundColor: store.color }} />
          <span className={styles.storeName}>{store.name}</span>
          {store._isShared && <span className={styles.sharedBadge}>shared</span>}
          {!store._isShared && (
            <>
              <span className={styles.catCount}>{store.categories?.length ?? 0} categories</span>
              <svg
                className={`${styles.expandChevron} ${catExpandedId === store.id ? styles.expandChevronOpen : ''}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </>
          )}
          {!store._isShared && (
            <div className={styles.menuWrap} ref={menuOpenId === store.id ? menuRef : null} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={styles.menuBtn}
                onClick={() => setMenuOpenId(menuOpenId === store.id ? null : store.id)}
                aria-label="Store options"
              >
                ⋯
              </button>
              {menuOpenId === store.id && !isMobile && (
                <div className={styles.menuDropdown}>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => handleStartEdit(store)}
                  >
                    Edit Name &amp; Color
                  </button>
                  <button
                    type="button"
                    className={`${styles.menuItem} ${styles.menuDanger}`}
                    onClick={() => { setConfirmingDeleteId(store.id); setMenuOpenId(null); }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {!store._isShared && menuOpenId === store.id && isMobile && (
          <>
            <div className={styles.actionSheetBackdrop} onClick={() => setMenuOpenId(null)} />
            <div className={styles.actionSheet} ref={actionSheetRef}>
              <div className={styles.actionSheetGroup}>
                <div className={styles.actionSheetTitle}>{store.name}</div>
                <button
                  type="button"
                  className={styles.actionSheetItem}
                  onClick={() => handleStartEdit(store)}
                >
                  Edit Name &amp; Color
                </button>
                <button
                  type="button"
                  className={`${styles.actionSheetItem} ${styles.actionSheetDanger}`}
                  onClick={() => { setConfirmingDeleteId(store.id); setMenuOpenId(null); }}
                >
                  Delete Store
                </button>
              </div>
              <button
                type="button"
                className={styles.actionSheetCancel}
                onClick={() => setMenuOpenId(null)}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {!store._isShared && catExpandedId === store.id && (
          <StoreCategoryEditor
            categories={store.categories ?? []}
            otherStores={stores.filter((s) => s.id !== store.id)}
            onSave={(cats) => handleSaveCategories(store.id, cats)}
          />
        )}

        {!store._isShared && confirmingDeleteId === store.id && (
          <ConfirmDialog
            message={`Delete store "${store.name}"?`}
            onConfirm={() => { onDelete(store.id); setConfirmingDeleteId(null); }}
            onCancel={() => setConfirmingDeleteId(null)}
          />
        )}
      </div>
    );
  };

  const renderMobileLayout = () => (
    <div className={styles.mobileLayout}>
      <div className={styles.mobileHeader}>
        <div className={styles.headerRow}>
          <h2 className={styles.title}>Stores</h2>
          <button
            className={`${styles.circleBtn} ${isCreating ? styles.circleBtnCancel : ''}`}
            onClick={() => setIsCreating(!isCreating)}
            aria-label={isCreating ? 'Cancel' : 'New store'}
          >
            {isCreating ? '×' : '+'}
          </button>
        </div>
        <div className={styles.searchBar}>
          <svg
            className={styles.searchIcon}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search stores..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.searchClearBtn}
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <div className={styles.scrollArea}>
        {isCreating && renderCreateForm()}
        <div className={styles.storeList}>
          {filteredStores.length === 0 && (
            <p className={styles.emptyHint}>
              {searchQuery ? 'No stores match your search.' : 'No stores yet. Add a store to organize items by where you shop.'}
            </p>
          )}
          {!searchQuery.trim() ? (
            <>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
                <SortableContext items={ownStores.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  {ownStores.map((store, index) => (
                    <SortableStoreItem key={store.id} id={store.id} isMobile={isMobile}>
                      {(dragProps) => renderStoreItem(store, index, dragProps)}
                    </SortableStoreItem>
                  ))}
                </SortableContext>
              </DndContext>
              {sharedStores.length > 0 && (
                <>
                  <div className={styles.sharedDivider}>
                    <span className={styles.sharedDividerText}>Shared with you</span>
                  </div>
                  {sharedStores.map((store, index) => renderStoreItem(store, index, null))}
                </>
              )}
            </>
          ) : (
            <>
              {filteredOwnStores.map((store, index) => renderStoreItem(store, index, null))}
              {filteredSharedStores.length > 0 && (
                <>
                  <div className={styles.sharedDivider}>
                    <span className={styles.sharedDividerText}>Shared with you</span>
                  </div>
                  {filteredSharedStores.map((store, index) => renderStoreItem(store, index, null))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderDesktopLayout = () => (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h4 className={styles.sectionTitle}>Your Stores ({ownStores.length})</h4>
        <button className={styles.newBtn} onClick={() => setIsCreating(!isCreating)}>
          {isCreating ? 'Cancel' : '+ New'}
        </button>
      </div>
      <div className={styles.searchBar}>
        <svg
          className={styles.searchIcon}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search stores..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            type="button"
            className={styles.searchClearBtn}
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
      {isCreating && renderCreateForm()}
      <div className={styles.storeList}>
        {filteredStores.length === 0 && (
          <p className={styles.emptyHint}>
            {searchQuery ? 'No stores match your search.' : 'No stores yet. Add a store to organize items by where you shop.'}
          </p>
        )}
        {!searchQuery.trim() ? (
          <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
              <SortableContext items={ownStores.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {ownStores.map((store, index) => (
                  <SortableStoreItem key={store.id} id={store.id} isMobile={isMobile}>
                    {(dragProps) => renderStoreItem(store, index, dragProps)}
                  </SortableStoreItem>
                ))}
              </SortableContext>
            </DndContext>
            {sharedStores.length > 0 && (
              <>
                <div className={styles.sharedDivider}>
                  <span className={styles.sharedDividerText}>Shared with you</span>
                </div>
                {sharedStores.map((store, index) => renderStoreItem(store, index, null))}
              </>
            )}
          </>
        ) : (
          <>
            {filteredOwnStores.map((store, index) => renderStoreItem(store, index, null))}
            {filteredSharedStores.length > 0 && (
              <>
                <div className={styles.sharedDivider}>
                  <span className={styles.sharedDividerText}>Shared with you</span>
                </div>
                {filteredSharedStores.map((store, index) => renderStoreItem(store, index, null))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  return isMobile ? renderMobileLayout() : renderDesktopLayout();
};

StoreManager.propTypes = {
  stores: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
      categories: PropTypes.arrayOf(
        PropTypes.shape({
          key: PropTypes.string.isRequired,
          name: PropTypes.string.isRequired,
          color: PropTypes.string.isRequired,
          keywords: PropTypes.arrayOf(PropTypes.string).isRequired,
        })
      ),
    })
  ).isRequired,
  onAdd: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onReorder: PropTypes.func.isRequired,
};
