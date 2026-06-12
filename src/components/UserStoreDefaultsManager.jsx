import { useState, useCallback } from 'react';
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

  const sensors = useSensors(
    useSensor(PointerSensor, { distance: 8 }),
    useSensor(TouchSensor, { delay: 250, tolerance: 5 }),
  );

  const defaults = userStoreDefaults.filter((d) => d.listType === listType).sort((a, b) => a.sortOrder - b.sortOrder);

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

  if (defaults.length === 0 && !isCreating) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyMessage}>No default stores yet. Add one to have it appear on every new {listType} list.</p>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setIsCreating(true)}
        >
          + Add Store Default
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <p className={styles.description}>These stores are added to every new {listType} list you create.</p>

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
          <div className={styles.formButtons}>
            <button type="submit" className={styles.saveBtn}>Save</button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => { setIsCreating(false); setNewName(''); }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
        <SortableContext items={defaults.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          <ul className={styles.list}>
            {defaults.map((def) => (
              <SortableItem key={def.id} id={def.id}>
                {({ attributes, listeners }) => (
                  <li className={styles.item}>
                    <div className={styles.dragHandle} {...attributes} {...listeners}>⋮</div>
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
                        <button
                          type="button"
                          className={styles.editBtn}
                          onClick={() => { setEditingId(def.id); setEditName(def.name); setEditColor(def.color); }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => setConfirmingDeleteId(def.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </li>
                )}
              </SortableItem>
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {!isCreating && (
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setIsCreating(true)}
        >
          + Add Store Default
        </button>
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
