import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { EmojiPicker } from './EmojiPicker.jsx';
import { CategoryEditor } from './CategoryEditor.jsx';
import { StoreManager } from './StoreManager.jsx';
import { AvatarGroup } from './AvatarGroup.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { useShoppingList } from '../hooks/useShoppingList.js';
import { LIST_TYPES, LIST_TYPE_IDS } from '../utils/listTypes.js';
import { getEffectiveCategories, getSystemDefaultCategories } from '../utils/categories.js';
import { updateListSortConfig } from '../services/preferences.js';
import { saveListOrder } from '../services/database.js';
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

const SortableListItem = ({ id, children, isMobile }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? styles.dragging : ''}>
      {typeof children === 'function' ? children({ attributes, listeners, isDragging, isMobile }) : children}
    </div>
  );
};

const CATEGORY_SUPPORTED_TYPES = ['grocery', 'packing', 'todo', 'project'];

/**
 * Sidebar/dropdown for managing multiple shopping lists.
 * Shows all lists (owned + shared) with emoji icons, allows creating new ones,
 * and provides a three-dot menu with Name, Icon & Color (including list type),
 * Manage Stores, Manage Categories, Share Settings, Duplicate, and Delete List.
 */
export const ListSelector = ({
  lists,
  activeListId,
  currentUserId,
  onSelect,
  onCreate,
  onUpdateDetails,
  onDelete,
  onDuplicate,
  onResetItems,
  onShareClick,
  onManageStores,
  onNavigateToSettings: _onNavigateToSettings,
}) => {
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState(null);
  const [newColor, setNewColor] = useState('#1565c0');
  const [newType, setNewType] = useState('grocery');
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [duplicatingListId, setDuplicatingListId] = useState(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [resetRsvpOnDuplicate, setResetRsvpOnDuplicate] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState(null);
  const [editColor, setEditColor] = useState('#1565c0');
  const [editType, setEditType] = useState('grocery');
  const [pendingEditSave, setPendingEditSave] = useState(null);
  const [editingCategoriesForId, setEditingCategoriesForId] = useState(null);
  const [showCategoryPreview, setShowCategoryPreview] = useState(false);
  const [customCategories, setCustomCategories] = useState(null);
  const [showStorePreview, setShowStorePreview] = useState(false);
  const [customStores, setCustomStores] = useState(null);
  const menuRef = useRef(null);
  const isMobile = useIsMobile();
  const { state, actions } = useShoppingList();
  const reorderLists = actions.reorderLists;
  const userCategoryDefaults = useMemo(() => state.userCategoryDefaults ?? [], [state.userCategoryDefaults]);


  const resolvedPreviewCategories = useMemo(() => {
    if (!CATEGORY_SUPPORTED_TYPES.includes(newType)) return null;
    if (customCategories) return customCategories;
    const userDefault = userCategoryDefaults.find(d => d.listType === newType);
    if (userDefault?.categories?.length > 0) return userDefault.categories;
    return getSystemDefaultCategories(newType);
  }, [newType, customCategories, userCategoryDefaults]);

  const userStoreDefaults = useMemo(() => state.userStoreDefaults ?? [], [state.userStoreDefaults]);
  const newTypeSupportsStores = !!LIST_TYPES[newType]?.fields?.store;

  const resolvedPreviewStores = useMemo(() => {
    if (!newTypeSupportsStores) return null;
    if (customStores) return customStores;
    return userStoreDefaults
      .filter((d) => d.listType === newType)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((d) => ({ id: `default-${d.id}`, name: d.name, color: d.color ?? LIST_PRESET_COLORS[0] }));
  }, [newTypeSupportsStores, customStores, userStoreDefaults, newType]);

  const updatePreviewStores = (stores) => setCustomStores(stores);

  const handlePreviewStoreAdd = (name, color) => {
    const current = customStores ?? resolvedPreviewStores ?? [];
    updatePreviewStores([...current, { id: `preview-${crypto.randomUUID()}`, name, color }]);
  };

  const handlePreviewStoreUpdate = (id, updates) => {
    const current = customStores ?? resolvedPreviewStores ?? [];
    updatePreviewStores(current.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handlePreviewStoreDelete = (id) => {
    const current = customStores ?? resolvedPreviewStores ?? [];
    updatePreviewStores(current.filter((s) => s.id !== id));
  };

  // Sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filteredLists.findIndex((l) => l.id === active.id);
    const newIndex = filteredLists.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(filteredLists, oldIndex, newIndex);
    const orderedIds = reordered.map((l) => l.id);

    // Save unified order via context (updates localStorage + triggers re-render)
    if (reorderLists) {
      await reorderLists(orderedIds);
    }

    // Also sync owned-list order to server
    const ownedInOrder = reordered.filter((l) => !l._isShared);
    if (currentUserId && ownedInOrder.length > 0) {
      try {
        await saveListOrder(currentUserId, ownedInOrder);
      } catch (error) {
        console.error('Failed to save list order to server:', error);
      }
    }
  };

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
    const categoriesToPass = showCategoryPreview ? customCategories : null;
    const storesToPass = showStorePreview ? customStores : null;
    onCreate(trimmed, newEmoji, newColor, newType, categoriesToPass, storesToPass);
    setNewName('');
    setNewEmoji(null);
    setNewColor('#1565c0');
    setNewType('grocery');
    setIsCreating(false);
    setSearchQuery('');
    setShowCategoryPreview(false);
    setCustomCategories(null);
    setShowStorePreview(false);
    setCustomStores(null);
  };

  const handleStartEdit = (list) => {
    setEditingId(list.id);
    setEditName(list.name);
    setEditEmoji(list.emoji ?? null);
    setEditColor(list.color ?? '#1565c0');
    setEditType(list.type ?? 'grocery');
    setMenuOpenId(null);
  };

  const handleSaveEdit = (id) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    const baseUpdates = { name: trimmed, emoji: editEmoji, color: editColor };
    const list = lists.find((l) => l.id === id);
    const currentType = list?.type ?? 'grocery';
    const isOwned = list && !list._isShared;
    if (!isOwned || editType === currentType) {
      onUpdateDetails(id, baseUpdates);
      setEditingId(null);
      return;
    }

    const cfg = LIST_TYPES[editType];
    const fromCategoryType = CATEGORY_SUPPORTED_TYPES.includes(currentType);
    const toCategoryType = CATEGORY_SUPPORTED_TYPES.includes(editType);
    const updates = { ...baseUpdates, type: editType };
    let message;
    if (fromCategoryType && toCategoryType) {
      updates.categories = resolveNewCategories(editType);
      message = `Changing to ${cfg.label} will reset this list's categories to your ${cfg.label} defaults. Save anyway?`;
    } else if (fromCategoryType) {
      updates.categories = null;
      message = `Changing to ${cfg.label} will remove all categories from this list. Save anyway?`;
    } else if (toCategoryType) {
      updates.categories = resolveNewCategories(editType);
      message = `Changing to ${cfg.label} will add default ${cfg.label} categories. Save anyway?`;
    } else {
      message = `Change list type to ${cfg.label}? Save anyway?`;
    }
    setPendingEditSave({ id, updates, message });
  };

  const applyPendingEditSave = async () => {
    if (!pendingEditSave) return;
    const { id, updates } = pendingEditSave;
    onUpdateDetails(id, updates);
    const currentList = lists.find((l) => l.id === id);
    if (currentList?.sortConfig) {
      const newTypeConfig = LIST_TYPES[updates.type];
      const hasInvalidLevels = currentList.sortConfig.some(
        (level) => !newTypeConfig.sortLevels.includes(level)
      );
      if (hasInvalidLevels) {
        await updateListSortConfig(id, null);
      }
    }
    setPendingEditSave(null);
    setEditingId(null);
  };

  const handleEditKeyDown = (e, id) => {
    if (e.key === 'Enter') handleSaveEdit(id);
    if (e.key === 'Escape') setEditingId(null);
  };

  const renderTypeGrid = (selectedType, onSelectType) => (
    <div className={styles.typeGrid}>
      {LIST_TYPE_IDS.map((typeId) => {
        const cfg = LIST_TYPES[typeId];
        const isSelected = selectedType === typeId;
        const IconComponent = TYPE_ICON_MAP[typeId];
        return (
          <button
            key={typeId}
            type="button"
            className={`${styles.typeCell} ${isSelected ? styles.typeCellSelected : ''}`}
            onClick={() => onSelectType(typeId)}
          >
            <span className={styles.typeCellIcon}><IconComponent size={28} /></span>
            <span className={styles.typeCellLabel}>{cfg.label}</span>
          </button>
        );
      })}
    </div>
  );

  const resolveNewCategories = (newType) => {
    const userDefault = userCategoryDefaults.find(d => d.listType === newType);
    if (userDefault?.categories?.length > 0) return userDefault.categories;
    return getSystemDefaultCategories(newType);
  };

  const query = searchQuery.toLowerCase().trim();
  const filteredLists = query
    ? lists.filter((l) => {
        const name = (l.name ?? '').toLowerCase();
        const emoji = l.emoji ?? '';
        return name.includes(query) || emoji.includes(query);
      })
    : lists;

  const renderListItem = (list, dragProps = null) => {
    const isOwned = !list._isShared;
    const isActive = list.id === activeListId;
    const isMenuOpen = menuOpenId === list.id;

    return (
      <div
        key={list.id}
        className={`${styles.listItem} ${isActive ? styles.active : ''}`}
        {...(dragProps && isMobile ? { ...dragProps.attributes, ...dragProps.listeners, style: { touchAction: 'none' } } : {})}
      >
        {!isMobile && dragProps && (
          <button
            type="button"
            className={styles.dragHandle}
            {...dragProps.attributes}
            {...dragProps.listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag to reorder"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
              <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
              <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
            </svg>
          </button>
        )}
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
          {list._collaborators?.length > 0 && (
            <AvatarGroup
              collaborators={list._collaborators}
              size={28}
              color={list.color || '#1565c0'}
            />
          )}
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
               {LIST_TYPES[list.type]?.fields?.store && onManageStores && (
                 <button
                   type="button"
                   className={styles.menuItem}
                   onClick={() => { onManageStores(list); setMenuOpenId(null); }}
                 >
                   <span className={styles.menuIcon}>🏪</span>
                   Manage Stores
                 </button>
               )}
               {CATEGORY_SUPPORTED_TYPES.includes(list.type) && (
                 <button
                   type="button"
                   className={styles.menuItem}
                   onClick={() => { setEditingCategoriesForId(list.id); setMenuOpenId(null); }}
                 >
                   <span className={styles.menuIcon}>🏷️</span>
                   Manage Categories
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
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setDuplicatingListId(list.id);
                  setDuplicateName(`${list.name} (2)`);
                  setResetRsvpOnDuplicate(false);
                  setMenuOpenId(null);
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
                  disabled={(list.itemCount ?? 0) === 0}
                  onClick={() => {
                    if ((list.itemCount ?? 0) === 0) return;
                    onResetItems?.(list);
                    setMenuOpenId(null);
                  }}
                >
                  <span className={styles.menuIcon}>🔄</span>
                  Reset items
                </button>
              )}
              {isOwned && (
                <>
                  <div className={styles.menuSeparator} role="separator" />
                  <button
                    type="button"
                    className={`${styles.menuItem} ${styles.menuDanger}`}
                    onClick={() => { setConfirmingDeleteId(list.id); setMenuOpenId(null); }}
                  >
                    <span className={styles.menuIcon}>🗑️</span>
                    Delete List
                  </button>
                </>
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
                 {LIST_TYPES[list.type]?.fields?.store && onManageStores && (
                   <button
                     type="button"
                     className={styles.actionSheetItem}
                     onClick={() => { onManageStores(list); setMenuOpenId(null); }}
                   >
                     Manage Stores
                   </button>
                 )}
                  {CATEGORY_SUPPORTED_TYPES.includes(list.type) && (
                    <button
                      type="button"
                      className={styles.actionSheetItem}
                      onClick={() => { setEditingCategoriesForId(list.id); setMenuOpenId(null); }}
                    >
                      Manage Categories
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
                <button
                  type="button"
                  className={styles.actionSheetItem}
                  onClick={() => {
                    setDuplicatingListId(list.id);
                    setDuplicateName(`${list.name} (2)`);
                    setResetRsvpOnDuplicate(false);
                    setMenuOpenId(null);
                  }}
                >
                  Duplicate
                </button>
                {isOwned && list.type === 'guest_list' && onResetItems && (
                  <button
                    type="button"
                    className={styles.actionSheetItem}
                    title="List has no items to reset"
                    disabled={(list.itemCount ?? 0) === 0}
                    onClick={() => {
                      if ((list.itemCount ?? 0) === 0) return;
                      onResetItems?.(list);
                      setMenuOpenId(null);
                    }}
                  >
                    <span className={styles.menuIcon}>🔄</span>
                    Reset items
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

      </div>
    );
  };

  const renderMobileLayout = () => (
    <div className={styles.mobileLayout}>
      <div className={styles.mobileHeader}>
        <div className={styles.header}>
          <h2 className={styles.title}>Lists</h2>
          <button
            className={styles.circleBtn}
            onClick={() => setIsCreating(true)}
            aria-label="New list"
          >
            +
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
        <div className={styles.lists}>
          {filteredLists.length === 0 && (
            <p className={styles.emptyMsg}>No lists yet. Create one to get started.</p>
          )}
          {!query ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext items={filteredLists.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                {filteredLists.map((list) => (
                  <SortableListItem key={list.id} id={list.id} isMobile={isMobile}>
                    {(dragProps) => renderListItem(list, dragProps)}
                  </SortableListItem>
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            filteredLists.map((list) => renderListItem(list, null))
          )}
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
          onClick={() => setIsCreating(true)}
        >
          + New
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

      <div className={styles.lists}>
        {filteredLists.length === 0 && (
          <p className={styles.emptyMsg}>No lists yet. Create one to get started.</p>
        )}
        {!query ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext items={filteredLists.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              {filteredLists.map((list) => (
                <SortableListItem key={list.id} id={list.id} isMobile={isMobile}>
                  {(dragProps) => renderListItem(list, dragProps)}
                </SortableListItem>
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          filteredLists.map((list) => renderListItem(list, null))
        )}
      </div>
    </div>
  );

  const closeCreateModal = () => {
    setIsCreating(false);
    setNewName('');
    setNewEmoji(null);
    setNewColor('#1565c0');
    setNewType('grocery');
    setShowCategoryPreview(false);
    setCustomCategories(null);
    setShowStorePreview(false);
    setCustomStores(null);
  };

  const handleEditModalKeyDown = (e) => {
    if (e.key === 'Escape') setEditingId(null);
  };

  const handleEditModalBackdropClick = (e) => {
    if (e.target === e.currentTarget) setEditingId(null);
  };

  const closeDuplicateModal = () => {
    setDuplicatingListId(null);
    setResetRsvpOnDuplicate(false);
  };

  const handleDuplicateConfirm = async () => {
    if (!duplicatingListId || !duplicateName.trim()) return;

    const result = await onDuplicate(duplicatingListId, duplicateName.trim(), { resetRsvp: resetRsvpOnDuplicate });
    if (result) {
      closeDuplicateModal();
    }
  };

  const editingList = editingId ? lists.find((l) => l.id === editingId) : null;
  const editingCategoriesList = editingCategoriesForId ? lists.find((l) => l.id === editingCategoriesForId) : null;
  const duplicatingList = duplicatingListId ? lists.find((l) => l.id === duplicatingListId) : null;
  const shouldShowDuplicateReset = duplicatingList?.type === 'guest_list';

  return (
    <>
      {isMobile ? renderMobileLayout() : renderDesktopLayout()}

      {isCreating && createPortal(
        <div
          className={styles.modalBackdrop}
          onClick={(e) => { if (e.target === e.currentTarget) closeCreateModal(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') closeCreateModal(); }}
          role="dialog"
          aria-modal="true"
          aria-label="New List"
        >
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>New List</h3>
              <button
                className={styles.modalCloseBtn}
                onClick={closeCreateModal}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.createRow}>
                <EmojiPicker value={newEmoji} onSelect={setNewEmoji} />
                <input
                  className={styles.createInput}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) handleCreate(e); }}
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
              <div className={styles.editTypeSection}>
                <div className={styles.editSectionLabel}>List Type</div>
                {renderTypeGrid(newType, (typeId) => { setNewType(typeId); setCustomCategories(null); setShowCategoryPreview(false); setCustomStores(null); setShowStorePreview(false); })}
              </div>
              {newTypeSupportsStores && (
                <div className={styles.categoryPreviewSection}>
                  <button
                    type="button"
                    className={styles.categoryPreviewToggle}
                    onClick={() => setShowStorePreview(!showStorePreview)}
                  >
                    <span className={styles.categoryPreviewLabel}>Customize Stores</span>
                    <span className={`${styles.categoryPreviewChevron} ${showStorePreview ? styles.categoryPreviewChevronOpen : ''}`}>
                      &#x276F;
                    </span>
                  </button>
                  {showStorePreview && resolvedPreviewStores && (
                    <div className={styles.categoryPreviewEditor}>
                      <StoreManager
                        stores={customStores ?? resolvedPreviewStores}
                        onAdd={handlePreviewStoreAdd}
                        onUpdate={handlePreviewStoreUpdate}
                        onDelete={handlePreviewStoreDelete}
                        onReorder={updatePreviewStores}
                      />
                    </div>
                  )}
                </div>
              )}
              {CATEGORY_SUPPORTED_TYPES.includes(newType) && (
                <div className={styles.categoryPreviewSection}>
                  <button
                    type="button"
                    className={styles.categoryPreviewToggle}
                    onClick={() => setShowCategoryPreview(!showCategoryPreview)}
                  >
                    <span className={styles.categoryPreviewLabel}>Customize Categories</span>
                    <span className={`${styles.categoryPreviewChevron} ${showCategoryPreview ? styles.categoryPreviewChevronOpen : ''}`}>
                      &#x276F;
                    </span>
                  </button>
                  {showCategoryPreview && resolvedPreviewCategories && (
                    <div className={styles.categoryPreviewEditor}>
                      <CategoryEditor
                        categories={customCategories ?? resolvedPreviewCategories}
                        listType={newType}
                        onSave={setCustomCategories}
                        showHeader={false}
                        embedded
                      />
                    </div>
                  )}
                </div>
              )}
              <div className={styles.editActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={closeCreateModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.saveBtn}
                  disabled={!newName.trim()}
                  onClick={handleCreate}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {editingId && editingList && createPortal(
        <div
          className={styles.modalBackdrop}
          onClick={handleEditModalBackdropClick}
          onKeyDown={handleEditModalKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label="Edit List"
        >
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit List</h3>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setEditingId(null)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.editTop}>
                <EmojiPicker value={editEmoji} onSelect={setEditEmoji} />
                <input
                  className={styles.editInput}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => handleEditKeyDown(e, editingId)}
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
              {!editingList._isShared && (
                <div className={styles.editTypeSection}>
                  <div className={styles.editSectionLabel}>List Type</div>
                  {renderTypeGrid(editType, setEditType)}
                </div>
              )}
              <div className={styles.editActions}>
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
                  onClick={() => handleSaveEdit(editingId)}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {pendingEditSave && (
        <ConfirmDialog
          message={pendingEditSave.message}
          confirmLabel="Save"
          onConfirm={applyPendingEditSave}
          onCancel={() => setPendingEditSave(null)}
        />
      )}

      {editingCategoriesForId && editingCategoriesList && createPortal(
        <div
          className={styles.modalBackdrop}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingCategoriesForId(null); }}
          onKeyDown={(e) => { if (e.key === 'Escape') setEditingCategoriesForId(null); }}
          role="dialog"
          aria-modal="true"
          aria-label="Manage Categories"
        >
          <div className={styles.modalCardTransparent}>
            <CategoryEditor
              categories={getEffectiveCategories(editingCategoriesList, userCategoryDefaults) ?? []}
              listType={editingCategoriesList.type}
              onSave={(cats) => onUpdateDetails(editingCategoriesList.id, { categories: cats })}
              onSaveAsDefault={(listType, cats) => actions.saveUserCategoryDefault(listType, cats)}
              onClose={() => setEditingCategoriesForId(null)}
            />
          </div>
        </div>,
        document.body,
      )}

      {duplicatingListId && createPortal(
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
              {shouldShowDuplicateReset && (
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
                  className={styles.cancelBtn}
                  onClick={closeDuplicateModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.saveBtn}
                  disabled={!duplicateName.trim()}
                  onClick={handleDuplicateConfirm}
                >
                  Duplicate
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
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
  onDuplicate: PropTypes.func.isRequired,
  onResetItems: PropTypes.func,
  onShareClick: PropTypes.func,
  onManageStores: PropTypes.func,
  onNavigateToSettings: PropTypes.func,
};
