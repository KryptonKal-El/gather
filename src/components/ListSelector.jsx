import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { EmojiPicker } from './EmojiPicker.jsx';
import styles from './ListSelector.module.css';

/**
 * Sidebar/dropdown for managing multiple shopping lists.
 * Shows all lists (owned + shared) with emoji icons, allows creating new ones,
 * and provides a three-dot menu with Name & Icon, Share Settings, and Delete List.
 */
export const ListSelector = ({
  lists,
  activeListId,
  currentUserId,
  onSelect,
  onCreate,
  onUpdateDetails,
  onDelete,
  onShareClick,
}) => {
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState(null);
  const menuRef = useRef(null);

  // Close menu on outside click
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
    setEditEmoji(list.emoji ?? null);
    setMenuOpenId(null);
  };

  const handleSaveEdit = (id) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    onUpdateDetails(id, { name: trimmed, emoji: editEmoji });
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
    const isMenuOpen = menuOpenId === list.id;

    return (
      <div
        key={list.id}
        className={`${styles.listItem} ${isActive ? styles.active : ''}`}
      >
        {editingId === list.id ? (
          <div className={styles.editRow}>
            <EmojiPicker value={editEmoji} onSelect={setEditEmoji} />
            <input
              className={styles.editInput}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => handleEditKeyDown(e, list.id)}
              autoFocus
            />
            <button
              type="button"
              className={styles.saveBtn}
              onClick={() => handleSaveEdit(list.id)}
            >
              Save
            </button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setEditingId(null)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              className={styles.listBtn}
              onClick={() => onSelect(list.id)}
            >
              {list.emoji && <span className={styles.listEmoji}>{list.emoji}</span>}
              <span className={styles.listName}>
                {list.name}
                {!isOwned && <span className={styles.sharedBadge}>Shared</span>}
              </span>
              <span className={styles.listCount}>{list.itemCount ?? 0}</span>
            </button>

            <div className={styles.menuWrap} ref={isMenuOpen ? menuRef : null}>
              <button
                type="button"
                className={styles.menuBtn}
                onClick={() => setMenuOpenId(isMenuOpen ? null : list.id)}
                aria-label={`Options for ${list.name}`}
              >
                &#x22EE;
              </button>

              {isMenuOpen && (
                <div className={styles.menuDropdown}>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => handleStartEdit(list)}
                  >
                    <span className={styles.menuIcon}>✏️</span>
                    Name &amp; Icon
                  </button>
                  {isOwned && onShareClick && (
                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={() => { onShareClick(list); setMenuOpenId(null); }}
                    >
                      <span className={styles.menuIcon}>🔗</span>
                      Share Settings
                    </button>
                  )}
                  {isOwned && (
                    <button
                      type="button"
                      className={`${styles.menuItem} ${styles.menuDanger}`}
                      onClick={() => { setConfirmingDeleteId(list.id); setMenuOpenId(null); }}
                    >
                      <span className={styles.menuIcon}>🗑️</span>
                      Delete List
                    </button>
                  )}
                </div>
              )}
            </div>

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
  onUpdateDetails: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onShareClick: PropTypes.func,
};
