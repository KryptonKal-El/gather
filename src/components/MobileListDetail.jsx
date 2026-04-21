import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { AddItemForm } from './AddItemForm.jsx';
import { ShoppingList } from './ShoppingList.jsx';
import { Suggestions } from './Suggestions.jsx';
import { SortPicker } from './SortPicker.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import styles from './MobileListDetail.module.css';

/**
 * Full-screen mobile list detail view with iOS-style navigation.
 * Shows a top nav bar with back arrow, list name, and 3-dot menu.
 */
export const MobileListDetail = ({
  list,
  stores,
  history,
  suggestions,
  sortConfig,
  listSortConfig,
  listCategories,
  isGuest,
  onBack,
  onAddItem,
  onToggle,
  onRemove,
  onUpdateCategory,
  onUpdateStore,
  onUpdateItem,
  onClearChecked,
  onShareClick,
  onDuplicate,
  onResetItems,
  onSortSelect,
  restoredItemIds,
  onRestoreAnimationDone,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [duplicatingList, setDuplicatingList] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [resetRsvpOnDuplicate, setResetRsvpOnDuplicate] = useState(false);
  const menuRef = useRef(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const listType = list.type ?? 'grocery';
  const isOwned = !list._isShared;
  const hasItems = (list.items?.length ?? 0) > 0;

  const closeDuplicateModal = () => {
    setDuplicatingList(false);
    setResetRsvpOnDuplicate(false);
  };

  const handleDuplicateConfirm = async () => {
    if (!duplicateName.trim()) return;

    const result = await onDuplicate(list.id, duplicateName.trim(), { resetRsvp: resetRsvpOnDuplicate });
    if (result) {
      closeDuplicateModal();
    }
  };

  return (
    <div className={styles.container}>
      <nav className={styles.navBar}>
        <button
          type="button"
          className={styles.backButton}
          onClick={onBack}
          aria-label="Back to My Lists"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className={styles.navTitle}>
          {list.emoji && <span>{list.emoji} </span>}
          {list.name}
        </h1>
        <SortPicker
          currentConfig={sortConfig}
          hasOverride={listSortConfig != null}
          onSelect={onSortSelect}
          listType={list.type ?? 'grocery'}
        />
        <div className={styles.menuWrap} ref={!isMobile && menuOpen ? menuRef : null}>
          <button
            type="button"
            className={styles.menuBtn}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="List options"
          >
            &#x22EE;
          </button>
          {menuOpen && !isMobile && (
            <div className={styles.menuDropdown}>
              {!isGuest && onShareClick && (
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => { onShareClick(list); setMenuOpen(false); }}
                >
                  <span className={styles.menuIcon}>🔗</span>
                  Share Settings
                </button>
              )}
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setDuplicatingList(true);
                  setDuplicateName(`${list.name} (2)`);
                  setResetRsvpOnDuplicate(false);
                  setMenuOpen(false);
                }}
              >
                <span className={styles.menuIcon}>📋</span>
                Duplicate
              </button>
              {isOwned && list.type === 'guest_list' && onResetItems && (
                <button
                  type="button"
                  className={styles.menuItem}
                  title="List has no items to reset"
                  disabled={!hasItems}
                  onClick={() => {
                    if (!hasItems) return;
                    onResetItems?.(list);
                    setMenuOpen(false);
                  }}
                >
                  <span className={styles.menuIcon}>🔄</span>
                  Reset items
                </button>
              )}
            </div>
          )}
        </div>
        {menuOpen && isMobile && (
          <>
            <div
              className={styles.actionSheetBackdrop}
              onClick={() => setMenuOpen(false)}
            />
            <div className={styles.actionSheet}>
              <div className={styles.actionSheetGroup}>
                <div className={styles.actionSheetTitle}>
                  {list.emoji && <span>{list.emoji} </span>}
                  {list.name}
                </div>
                {!isGuest && onShareClick && (
                  <button
                    type="button"
                    className={styles.actionSheetItem}
                    onClick={() => { onShareClick(list); setMenuOpen(false); }}
                  >
                    Share Settings
                  </button>
                )}
                <button
                  type="button"
                  className={styles.actionSheetItem}
                  onClick={() => {
                    setDuplicatingList(true);
                    setDuplicateName(`${list.name} (2)`);
                    setResetRsvpOnDuplicate(false);
                    setMenuOpen(false);
                  }}
                >
                  Duplicate
                </button>
                {isOwned && list.type === 'guest_list' && onResetItems && (
                  <button
                    type="button"
                    className={styles.actionSheetItem}
                    title="List has no items to reset"
                    disabled={!hasItems}
                    onClick={() => {
                      if (!hasItems) return;
                      onResetItems?.(list);
                      setMenuOpen(false);
                    }}
                  >
                    <span className={styles.menuIcon}>🔄</span>
                    Reset items
                  </button>
                )}
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
      </nav>

      <div className={styles.scrollContent}>
        <AddItemForm stores={stores} history={history} listType={listType} onAdd={onAddItem} />
        <ShoppingList
          items={list.items}
          stores={stores}
          sortConfig={sortConfig}
          listType={listType}
          listCategories={listCategories}
          onToggle={onToggle}
          onRemove={onRemove}
          onUpdateCategory={onUpdateCategory}
          onUpdateStore={onUpdateStore}
          onUpdateItem={onUpdateItem}
          onClearChecked={onClearChecked}
          restoredItemIds={restoredItemIds}
          onRestoreAnimationDone={onRestoreAnimationDone}
        />
        <Suggestions suggestions={suggestions} onAdd={onAddItem} collapsible />
      </div>

      {duplicatingList && createPortal(
        <div
          className={styles.modalBackdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeDuplicateModal();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              closeDuplicateModal();
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Duplicate List"
        >
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Duplicate List</h3>
              <button
                className={styles.modalCloseBtn}
                onClick={closeDuplicateModal}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className={styles.modalBody}>
              <input
                className={styles.editInput}
                type="text"
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && duplicateName.trim()) {
                    await handleDuplicateConfirm();
                  }
                  if (e.key === 'Escape') {
                    closeDuplicateModal();
                  }
                }}
                placeholder="New list name..."
                autoFocus
              />
              {list.type === 'guest_list' && (
                <label className={styles.checkboxField}>
                  <span className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={resetRsvpOnDuplicate}
                      onChange={(e) => setResetRsvpOnDuplicate(e.target.checked)}
                    />
                    <span>Reset RSVP statuses</span>
                  </span>
                  <span className={styles.checkboxHelp}>Mark all guests as Not Yet Invited in the new list</span>
                </label>
              )}
              <div className={styles.editActions}>
                <button
                  type="button"
                  className={styles.saveBtn}
                  disabled={!duplicateName.trim()}
                  onClick={handleDuplicateConfirm}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={closeDuplicateModal}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

MobileListDetail.propTypes = {
  list: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    emoji: PropTypes.string,
    type: PropTypes.string,
    items: PropTypes.array.isRequired,
  }).isRequired,
  stores: PropTypes.array.isRequired,
  history: PropTypes.array.isRequired,
  suggestions: PropTypes.array.isRequired,
  sortConfig: PropTypes.arrayOf(PropTypes.string),
  listSortConfig: PropTypes.arrayOf(PropTypes.string),
  listCategories: PropTypes.array,
  isGuest: PropTypes.bool,
  onBack: PropTypes.func.isRequired,
  onAddItem: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  onUpdateCategory: PropTypes.func.isRequired,
  onUpdateStore: PropTypes.func.isRequired,
  onUpdateItem: PropTypes.func.isRequired,
  onClearChecked: PropTypes.func.isRequired,
  onShareClick: PropTypes.func,
  onDuplicate: PropTypes.func.isRequired,
  onResetItems: PropTypes.func,
  onSortSelect: PropTypes.func.isRequired,
  restoredItemIds: PropTypes.instanceOf(Set),
  onRestoreAnimationDone: PropTypes.func,
};

MobileListDetail.defaultProps = {
  sortConfig: null,
  listSortConfig: null,
  listCategories: null,
  isGuest: false,
  onResetItems: null,
  restoredItemIds: null,
  onRestoreAnimationDone: null,
};
