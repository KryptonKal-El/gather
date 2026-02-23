import { useState } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import styles from './ListSelector.module.css';

/**
 * Sidebar/dropdown for managing multiple shopping lists.
 * Shows all lists (owned + shared), allows creating new ones,
 * renaming, switching, and sharing.
 */
export const ListSelector = ({
  lists,
  activeListId,
  currentUserId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onShareClick,
}) => {
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setNewName('');
    setIsCreating(false);
  };

  const handleStartEdit = (list) => {
    setEditingId(list.id);
    setEditName(list.name);
  };

  const handleSaveEdit = (id) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    onRename(id, trimmed);
    setEditingId(null);
  };

  const handleEditKeyDown = (e, id) => {
    if (e.key === 'Enter') handleSaveEdit(id);
    if (e.key === 'Escape') setEditingId(null);
  };

  const ownedLists = lists.filter((l) => !l._isShared);
  const sharedLists = lists.filter((l) => l._isShared);

  const renderListItem = (list) => {
    const isOwned = !list._isShared;
    const isActive = list.id === activeListId;

    return (
      <div
        key={list.id}
        className={`${styles.listItem} ${isActive ? styles.active : ''}`}
      >
        {editingId === list.id ? (
          <div className={styles.editRow}>
            <input
              className={styles.editInput}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => handleEditKeyDown(e, list.id)}
              onBlur={() => handleSaveEdit(list.id)}
              autoFocus
            />
          </div>
        ) : (
          <>
            <button
              className={styles.listBtn}
              onClick={() => onSelect(list.id)}
              onDoubleClick={() => handleStartEdit(list)}
            >
              <span className={styles.listName}>
                {list.name}
                {!isOwned && <span className={styles.sharedBadge}>Shared</span>}
              </span>
              <span className={styles.listCount}>{list.itemCount ?? 0} items</span>
            </button>
            {isOwned && onShareClick && (
              <button
                className={styles.shareBtn}
                onClick={() => onShareClick(list)}
                aria-label={`Share ${list.name}`}
                title="Share"
              >
                &#x1f517;
              </button>
            )}
            <button
              className={styles.editBtn}
              onClick={() => handleStartEdit(list)}
              aria-label={`Rename ${list.name}`}
              title="Rename"
            >
              &#x270E;
            </button>
            {isOwned && (
              <>
                <button
                  className={styles.deleteBtn}
                  onClick={() => setConfirmingDeleteId(list.id)}
                  aria-label={`Delete ${list.name}`}
                >
                  x
                </button>
                {confirmingDeleteId === list.id && (
                  <ConfirmDialog
                    message={`Delete "${list.name}" and all its items?`}
                    onConfirm={() => {
                      onDelete(list.id);
                      setConfirmingDeleteId(null);
                    }}
                    onCancel={() => setConfirmingDeleteId(null)}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>My Lists</h2>
        <button
          className={styles.newBtn}
          onClick={() => setIsCreating(!isCreating)}
        >
          {isCreating ? 'Cancel' : '+ New'}
        </button>
      </div>

      {isCreating && (
        <form className={styles.createForm} onSubmit={handleCreate}>
          <input
            className={styles.createInput}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="List name..."
            autoFocus
          />
          <button className={styles.createBtn} type="submit" disabled={!newName.trim()}>
            Create
          </button>
        </form>
      )}

      <div className={styles.lists}>
        {ownedLists.length === 0 && sharedLists.length === 0 && (
          <p className={styles.emptyMsg}>No lists yet. Create one to get started.</p>
        )}
        {ownedLists.map(renderListItem)}
      </div>

      {sharedLists.length > 0 && (
        <>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Shared with me</h3>
          </div>
          <div className={styles.lists}>
            {sharedLists.map(renderListItem)}
          </div>
        </>
      )}
    </div>
  );
};

ListSelector.propTypes = {
  lists: PropTypes.array.isRequired,
  activeListId: PropTypes.string,
  currentUserId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onShareClick: PropTypes.func,
};
