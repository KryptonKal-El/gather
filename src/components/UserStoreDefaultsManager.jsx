import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import styles from './UserStoreDefaultsManager.module.css';

const PRESET_COLORS = [
  '#B5E8C8', '#A8D8EA', '#85BFA8', '#FFD6A5', '#FDCFE8', '#B4C7E7', '#D4E09B',
  '#F9A8C9', '#C5B3E6', '#F4C89E', '#A5D6D0', '#C1D5A4', '#F2B5B5', '#D0C4DF',
];

const SortableItem = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? styles.dragging : ''}>
      {children({ attributes, listeners })}
    </div>
  );
};

/**
 * Manages user store defaults for a given list type.
 * Allows CRUD operations and drag-to-reorder.
 */
export const UserStoreDefaultsManager = ({
  listType,
  userStoreDefaults,
  onCreateDefault,
  onUpdateDefault,
  onDeleteDefault,
  onReorderDefaults,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const menuRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { distance: 8 }),
    useSensor(TouchSensor, { delay: 250, tolerance: 5 }),
  );

  useEffect(() => {
    if (!menuOpenId) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenId]);

  const defaults = userStoreDefaults.filter((d) => d.listType === listType).sort((a, b) => a.sortOrder - b.sortOrder);
  const filteredDefaults = defaults.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const isSearching = searchQuery.trim() !== '';

  const handleCreate = (e) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreateDefault(listType, trimmed, newColor);
    setNewName('');
    setNewColor(PRESET_COLORS[0]);
    setIsCreating(false);
  };

  const handleUpdateDefault = useCallback((id, updates) => {
    onUpdateDefault(id, updates.name, updates.color);
  }, [onUpdateDefault]);

  const handleDeleteDefault = useCallback((id) => {
    onDeleteDefault(id);
    setConfirmingDeleteId(null);
  }, [onDeleteDefault]);

  const handleDeleteAll = () => {
    defaults.forEach((def) => onDeleteDefault(def.id));
    setConfirmingDeleteAll(false);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = defaults.findIndex((d) => d.id === active.id);
    const newIndex = defaults.findIndex((d) => d.id === over.id);
    const reordered = arrayMove(defaults, oldIndex, newIndex).map((d, i) => ({ ...d, sortOrder: i }));
    // Filter to only include persisted items (no temp IDs) for reorder
    const persistedOnly = reordered.filter(d => d.id && typeof d.id === 'string' && !d.id.startsWith('temp-'));
    onReorderDefaults(persistedOnly);
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h4 className={styles.sectionTitle}>Stores ({defaults.length})</h4>
        <button
          type="button"
          className={styles.newBtn}
          onClick={() => { setIsCreating(!isCreating); setNewName(''); }}
        >
          {isCreating ? 'Cancel' : '+ New'}
        </button>
      </div>

      <p className={styles.description}>These stores are added to every new {listType} list you create.</p>

      <div className={styles.searchBarWrapper}>
        <input
          type="text"
          className={styles.searchBar}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search stores..."
        />
      </div>

      {isCreating && (
        <form className={styles.createForm} onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Store name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            required
          />
          <div className={styles.colorPicker}>
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`${styles.colorOption} ${newColor === color ? styles.colorSelected : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setNewColor(color)}
                title={color}
              />
            ))}
          </div>
          <button type="submit" className={styles.createBtn} disabled={!newName.trim()}>
            Create
          </button>
        </form>
      )}

      {defaults.length === 0 && !isCreating && (
        <p className={styles.emptyMessage}>No default stores yet. Add one to have it appear on every new {listType} list.</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
        <SortableContext items={filteredDefaults.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          <ul className={styles.list}>
            {filteredDefaults.map((def) => (
              <SortableItem key={def.id} id={def.id}>
                {({ attributes, listeners }) => (
                  <li className={styles.item}>
                    {!isSearching && (
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
                    )}
                    <div className={styles.color} style={{ backgroundColor: def.color }} />
                    {editingId === def.id ? (
                      <div className={styles.editForm}>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                        />
                        <button
                          type="button"
                          className={styles.cancelBtn}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className={styles.saveBtn}
                          onClick={() => {
                            handleUpdateDefault(def.id, { name: editName.trim(), color: editColor });
                            setEditingId(null);
                          }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className={styles.name}>{def.name}</span>
                        <div className={styles.menuWrap} ref={menuOpenId === def.id ? menuRef : null}>
                          <button
                            type="button"
                            className={styles.menuBtn}
                            onClick={() => setMenuOpenId(menuOpenId === def.id ? null : def.id)}
                            aria-label="Store options"
                          >
                            ⋯
                          </button>
                          {menuOpenId === def.id && (
                            <div className={styles.menuDropdown}>
                              <button
                                type="button"
                                className={styles.menuItem}
                                onClick={() => {
                                  setEditingId(def.id);
                                  setEditName(def.name);
                                  setEditColor(def.color);
                                  setMenuOpenId(null);
                                }}
                              >
                                Edit Store
                              </button>
                              <button
                                type="button"
                                className={`${styles.menuItem} ${styles.menuDanger}`}
                                onClick={() => {
                                  setConfirmingDeleteId(def.id);
                                  setMenuOpenId(null);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                )}
              </SortableItem>
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {defaults.length > 0 && (
        <div className={styles.deleteAllSection}>
          <button
            type="button"
            className={styles.deleteAllButton}
            onClick={() => setConfirmingDeleteAll(true)}
          >
            Delete All
          </button>
        </div>
      )}

      {confirmingDeleteAll && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <p>Delete all store defaults for {listType} lists?</p>
            <div className={styles.confirmButtons}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setConfirmingDeleteAll(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={handleDeleteAll}
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmingDeleteId && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <p>Delete this store default?</p>
            <div className={styles.confirmButtons}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setConfirmingDeleteId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={() => handleDeleteDefault(confirmingDeleteId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

UserStoreDefaultsManager.propTypes = {
  listType: PropTypes.string.isRequired,
  userStoreDefaults: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      userId: PropTypes.string.isRequired,
      listType: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      color: PropTypes.string,
      sortOrder: PropTypes.number,
    })
  ).isRequired,
  onCreateDefault: PropTypes.func.isRequired,
  onUpdateDefault: PropTypes.func.isRequired,
  onDeleteDefault: PropTypes.func.isRequired,
  onReorderDefaults: PropTypes.func.isRequired,
};

SortableItem.propTypes = {
  id: PropTypes.string.isRequired,
  children: PropTypes.func.isRequired,
};
