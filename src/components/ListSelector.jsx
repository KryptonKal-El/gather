import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { EmojiPicker } from './EmojiPicker.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import styles from './ListSelector.module.css';

const LIST_PRESET_COLORS = [
  '#1565c0', '#2e7d32', '#c62828', '#ef6c00', '#6a1b9a',
  '#00838f', '#ad1457', '#f9a825', '#37474f', '#4e342e',
];

/**
 * Sidebar/dropdown for managing multiple shopping lists.
 * Shows all lists (owned + shared) with emoji icons, allows creating new ones,
 * and provides a three-dot menu with Name & Icon, Share Settings, and Delete List.
 */
export const ListSelector = ({
  lists,
  activeListId,
  currentUserId: _currentUserId,
  onSelect,
  onCreate,
  onUpdateDetails,
  onDelete,
  onShareClick,
}) => {
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState(null);
  const [newColor, setNewColor] = useState('#1565c0');
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState(null);
  const [editColor, setEditColor] = useState('#1565c0');
  const menuRef = useRef(null);
  const isMobile = useIsMobile();

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
    onCreate(trimmed, newEmoji, newColor);
    setNewName('');
    setNewEmoji(null);
    setNewColor('#1565c0');
    setIsCreating(false);
    setSearchQuery('');
  };

  const handleStartEdit = (list) => {
    setEditingId(list.id);
    setEditName(list.name);
    setEditEmoji(list.emoji ?? null);
    setEditColor(list.color ?? '#1565c0');
    setMenuOpenId(null);
  };

  const handleSaveEdit = (id) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    onUpdateDetails(id, { name: trimmed, emoji: editEmoji, color: editColor });
    setEditingId(null);
  };

  const handleEditKeyDown = (e, id) => {
    if (e.key === 'Enter') handleSaveEdit(id);
    if (e.key === 'Escape') setEditingId(null);
  };

  const query = searchQuery.toLowerCase().trim();
  const filteredLists = query
    ? lists.filter((l) => {
        const name = (l.name ?? '').toLowerCase();
        const emoji = l.emoji ?? '';
        return name.includes(query) || emoji.includes(query);
      })
    : lists;

  const ownedLists = filteredLists.filter((l) => !l._isShared);
  const sharedLists = filteredLists.filter((l) => l._isShared);

  const getRowTintStyle = (color) => {
    if (!color) return undefined;
    return { borderLeft: '4px solid ' + color };
  };

  const renderListItem = (list) => {
    const isOwned = !list._isShared;
    const isActive = list.id === activeListId;
    const isMenuOpen = menuOpenId === list.id;

    return (
      <div
        key={list.id}
        className={`${styles.listItem} ${isActive ? styles.active : ''}`}
        style={getRowTintStyle(list.color)}
      >
        {editingId === list.id ? (
          <div className={styles.editRow}>
            <div className={styles.editTop}>
              <EmojiPicker value={editEmoji} onSelect={setEditEmoji} />
              <input
                className={styles.editInput}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => handleEditKeyDown(e, list.id)}
                autoFocus
              />
            </div>
            <div className={styles.colorPicker}>
              {LIST_PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorSwatch} ${editColor === c ? styles.colorSelected : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setEditColor(c)}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
            <div className={styles.editActions}>
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
          </div>
        ) : (
          <>
            <button
              className={styles.listBtn}
              onClick={() => onSelect(list.id)}
            >
              {list.emoji && <span className={styles.listEmoji}>{list.emoji}</span>}
              <span className={styles.listText}>
                <span className={styles.listName}>
                  {list.name}
                  {!isOwned && <span className={styles.sharedBadge}>Shared</span>}
                </span>
                <span className={styles.listCount}>{list.itemCount ?? 0} items</span>
              </span>
              <span className={styles.chevron}>›</span>
            </button>

            <div className={styles.menuWrap} ref={isMenuOpen && !isMobile ? menuRef : null}>
              <button
                type="button"
                className={styles.menuBtn}
                onClick={() => setMenuOpenId(isMenuOpen ? null : list.id)}
                aria-label={`Options for ${list.name}`}
              >
                &#x22EE;
              </button>

              {isMenuOpen && !isMobile && (
                <div className={styles.menuDropdown}>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => handleStartEdit(list)}
                  >
                    <span className={styles.menuIcon}>✏️</span>
                    Name, Icon &amp; Color
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

            {isMenuOpen && isMobile && (
              <>
                <div
                  className={styles.actionSheetBackdrop}
                  onClick={() => setMenuOpenId(null)}
                />
                <div className={styles.actionSheet}>
                  <div className={styles.actionSheetGroup}>
                    <div className={styles.actionSheetTitle}>
                      {list.emoji && <span>{list.emoji} </span>}
                      {list.name}
                    </div>
                    <button
                      type="button"
                      className={styles.actionSheetItem}
                      onClick={() => handleStartEdit(list)}
                    >
                      Name, Icon &amp; Color
                    </button>
                    {isOwned && onShareClick && (
                      <button
                        type="button"
                        className={styles.actionSheetItem}
                        onClick={() => { onShareClick(list); setMenuOpenId(null); }}
                      >
                        Share Settings
                      </button>
                    )}
                    {isOwned && (
                      <button
                        type="button"
                        className={`${styles.actionSheetItem} ${styles.actionSheetDanger}`}
                        onClick={() => { setConfirmingDeleteId(list.id); setMenuOpenId(null); }}
                      >
                        Delete List
                      </button>
                    )}
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

  const renderMobileLayout = () => (
    <div className={styles.mobileLayout}>
      <div className={styles.mobileHeader}>
        <div className={styles.header}>
          <h2 className={styles.title}>My Lists</h2>
          <button
            className={styles.newBtn}
            onClick={() => setIsCreating(!isCreating)}
          >
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
            placeholder="Search lists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className={styles.scrollArea}>
        {isCreating && (
          <form className={styles.createForm} onSubmit={handleCreate}>
            <div className={styles.createRow}>
              <EmojiPicker value={newEmoji} onSelect={setNewEmoji} />
              <input
                className={styles.createInput}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="List name..."
                autoFocus
              />
            </div>
            <div className={styles.colorPicker}>
              {LIST_PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorSwatch} ${newColor === c ? styles.colorSelected : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewColor(c)}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
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
    </div>
  );

  const renderDesktopLayout = () => (
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
          <div className={styles.createRow}>
            <EmojiPicker value={newEmoji} onSelect={setNewEmoji} />
            <input
              className={styles.createInput}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="List name..."
              autoFocus
            />
          </div>
          <div className={styles.colorPicker}>
            {LIST_PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.colorSwatch} ${newColor === c ? styles.colorSelected : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setNewColor(c)}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
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

  return isMobile ? renderMobileLayout() : renderDesktopLayout();
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
