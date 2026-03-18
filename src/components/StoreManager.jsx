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
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import styles from './StoreManager.module.css';

const PRESET_COLORS = [
  '#B5E8C8', '#A8D8EA', '#85BFA8', '#FFD6A5', '#FDCFE8', '#B4C7E7', '#D4E09B',
  '#F9A8C9', '#C5B3E6', '#F4C89E', '#A5D6D0', '#C1D5A4', '#F2B5B5', '#D0C4DF',
];

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
 * Panel for managing stores: create, rename, delete, pick color, and reorder.
 * Renders mobile or desktop layout based on viewport.
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
          {...(dragProps && isMobile ? { ...dragProps.attributes, ...dragProps.listeners, style: { touchAction: 'none' } } : {})}
        >
          {!isMobile && dragProps && !store._isShared && (
            <button type="button" className={styles.dragHandle} {...dragProps.attributes} {...dragProps.listeners} aria-label="Drag to reorder">
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
            <div className={styles.menuWrap} ref={menuOpenId === store.id ? menuRef : null}>
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
    })
  ).isRequired,
  onAdd: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onReorder: PropTypes.func.isRequired,
};
