import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { EmojiPicker } from './EmojiPicker.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { LIST_TYPES, LIST_TYPE_IDS } from '../utils/listTypes.js';
import { updateListSortConfig } from '../services/preferences.js';
import {
  GroceryIcon,
  TodoIcon,
  BasicIcon,
  PackingIcon,
  GuestListIcon,
  ProjectIcon,
} from './ListTypeIcons.jsx';
import styles from './ListSelector.module.css';

const LIST_PRESET_COLORS = [
  '#B5E8C8', '#A8D8EA', '#85BFA8', '#FFD6A5', '#FDCFE8', '#B4C7E7', '#D4E09B',
  '#F9A8C9', '#C5B3E6', '#F4C89E', '#A5D6D0', '#C1D5A4', '#F2B5B5', '#D0C4DF',
];

const TYPE_ICON_MAP = {
  grocery: GroceryIcon,
  todo: TodoIcon,
  basic: BasicIcon,
  packing: PackingIcon,
  guest_list: GuestListIcon,
  project: ProjectIcon,
};

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
  const [newType, setNewType] = useState('grocery');
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState(null);
  const [editColor, setEditColor] = useState('#1565c0');
  const [changingTypeForId, setChangingTypeForId] = useState(null);
  const [pendingTypeChange, setPendingTypeChange] = useState(null);
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
    if (e?.preventDefault) e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreate(trimmed, newEmoji, newColor, newType);
    setNewName('');
    setNewEmoji(null);
    setNewColor('#1565c0');
    setNewType('grocery');
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

  const renderTypeGrid = () => (
    <div className={styles.typeGrid}>
      {LIST_TYPE_IDS.map((typeId) => {
        const cfg = LIST_TYPES[typeId];
        const isSelected = newType === typeId;
        const IconComponent = TYPE_ICON_MAP[typeId];
        return (
          <button
            key={typeId}
            type="button"
            className={`${styles.typeCell} ${isSelected ? styles.typeCellSelected : ''}`}
            onClick={() => setNewType(typeId)}
          >
            <span className={styles.typeCellIcon}><IconComponent size={28} /></span>
            <span className={styles.typeCellLabel}>{cfg.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderChangeTypeGrid = (list) => {
    const currentType = list.type ?? 'grocery';
    return (
      <div className={styles.typeGrid}>
        {LIST_TYPE_IDS.map((typeId) => {
          const cfg = LIST_TYPES[typeId];
          const isCurrent = currentType === typeId;
          const IconComponent = TYPE_ICON_MAP[typeId];
          return (
            <button
              key={typeId}
              type="button"
              className={`${styles.typeCell} ${isCurrent ? styles.typeCellSelected : ''}`}
              onClick={() => {
                if (!isCurrent) {
                  setPendingTypeChange({ listId: list.id, newType: typeId, newLabel: cfg.label });
                }
                setChangingTypeForId(null);
              }}
            >
              <span className={styles.typeCellIcon}><IconComponent size={28} /></span>
              <span className={styles.typeCellLabel}>{cfg.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const query = searchQuery.toLowerCase().trim();
  const filteredLists = query
    ? lists.filter((l) => {
        const name = (l.name ?? '').toLowerCase();
        const emoji = l.emoji ?? '';
        return name.includes(query) || emoji.includes(query);
      })
    : lists;

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
              <span
                className={styles.listDot}
                style={{ backgroundColor: list.color || '#1565c0' }}
              />
              {list.emoji && <span className={styles.listEmoji}>{list.emoji}</span>}
              <span className={styles.listText}>
                <span className={styles.listName}>
                  {list.name}
                  {!isOwned && <span className={styles.sharedBadge}>Shared</span>}
                </span>
                <span className={styles.listMeta}>
                  <span className={styles.listCount}>{list.itemCount ?? 0} items</span>
                  {list.type && (
                    <span className={styles.typeBadge}>
                      {LIST_TYPES[list.type]?.label ?? list.type}
                    </span>
                  )}
                </span>
              </span>
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
                  {isOwned && (
                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={() => { setChangingTypeForId(list.id); setMenuOpenId(null); }}
                    >
                      <span className={styles.menuIcon}>🔄</span>
                      List Type
                    </button>
                  )}
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
                    {isOwned && (
                      <button
                        type="button"
                        className={styles.actionSheetItem}
                        onClick={() => { setChangingTypeForId(list.id); setMenuOpenId(null); }}
                      >
                        List Type
                      </button>
                    )}
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

            {changingTypeForId === list.id && (
              <div className={styles.changeTypeOverlay}>
                {renderChangeTypeGrid(list)}
              </div>
            )}

            {pendingTypeChange && pendingTypeChange.listId === list.id && (
              <ConfirmDialog
                message={`Change to ${pendingTypeChange.newLabel}? Some fields may be hidden but your data will be preserved.`}
                confirmLabel="Change"
                onConfirm={async () => {
                  const { listId, newType: selectedType } = pendingTypeChange;
                  onUpdateDetails(listId, { type: selectedType });
                  const currentList = lists.find((l) => l.id === listId);
                  if (currentList?.sortConfig) {
                    const newTypeConfig = LIST_TYPES[selectedType];
                    const hasInvalidLevels = currentList.sortConfig.some(
                      (level) => !newTypeConfig.sortLevels.includes(level)
                    );
                    if (hasInvalidLevels) {
                      await updateListSortConfig(listId, null);
                    }
                  }
                  setPendingTypeChange(null);
                  setChangingTypeForId(null);
                }}
                onCancel={() => setPendingTypeChange(null)}
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
          <h2 className={styles.title}>Lists</h2>
          <button
            className={`${styles.circleBtn} ${isCreating ? styles.circleBtnCancel : ''}`}
            onClick={() => { if (isCreating) setNewType('grocery'); setIsCreating(!isCreating); }}
            aria-label={isCreating ? 'Cancel' : 'New list'}
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
          <div className={styles.createForm}>
            {renderTypeGrid()}
            {newType !== null && (
              <>
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
                <button
                  className={styles.createBtn}
                  type="button"
                  disabled={!newName.trim()}
                  onClick={handleCreate}
                >
                  Create
                </button>
              </>
            )}
          </div>
        )}

        <div className={styles.lists}>
          {filteredLists.length === 0 && (
            <p className={styles.emptyMsg}>No lists yet. Create one to get started.</p>
          )}
          {filteredLists.map(renderListItem)}
        </div>
      </div>
    </div>
  );

  const renderDesktopLayout = () => (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Lists</h2>
        <button
          className={styles.newBtn}
          onClick={() => { if (isCreating) setNewType('grocery'); setIsCreating(!isCreating); }}
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

      {isCreating && (
        <div className={styles.createForm}>
          {renderTypeGrid()}
          {newType !== null && (
            <>
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
              <button
                className={styles.createBtn}
                type="button"
                disabled={!newName.trim()}
                onClick={handleCreate}
              >
                Create
              </button>
            </>
          )}
        </div>
      )}

      <div className={styles.lists}>
        {filteredLists.length === 0 && (
          <p className={styles.emptyMsg}>No lists yet. Create one to get started.</p>
        )}
        {filteredLists.map(renderListItem)}
      </div>
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
