import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { DeleteCollectionDialog } from './DeleteCollectionDialog.jsx';
import { EmojiPicker } from './EmojiPicker.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import styles from './RecipeSelector.module.css';

const SELECTED_KEY = 'gather_recipe_selected_collection';

const readSelected = () => {
  try {
    return localStorage.getItem(SELECTED_KEY) || null;
  } catch {
    return null;
  }
};

/**
 * Recipe browsing screen. Recipes render as photo cards in a two-column grid;
 * collections are a horizontal row of filter chips above it. "All" shows every
 * recipe (each card carries its collection's emoji marker), and selecting a
 * collection chip filters the grid and shows that collection's header with its
 * actions. A single "+" adds a recipe (via a method chooser) or a collection.
 */
export const RecipeSelector = ({
  collections,
  sharedCollections,
  sharedRecipesByCollection,
  allRecipes,
  onSelectCollection,
  onCreateCollection,
  onUpdateCollection,
  onDeleteCollection,
  onShareCollection,
  onLeaveCollection,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
  onMoveRecipe,
  onSearchOnline,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionEmoji, setNewCollectionEmoji] = useState('📁');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameEmoji, setRenameEmoji] = useState(null);
  const [confirmingLeaveId, setConfirmingLeaveId] = useState(null);
  const [movePickerRecipeId, setMovePickerRecipeId] = useState(null);
  // Chip selection (null = All). Persisted so a reload restores the filter.
  const [selectedCollectionId, setSelectedCollectionId] = useState(readSelected);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  // { collectionId: string | null } when the new-recipe method chooser is open.
  const [methodChooser, setMethodChooser] = useState(null);

  const menuRef = useRef(null);
  const renameInputRef = useRef(null);
  const newCollectionInputRef = useRef(null);
  const isMobile = useIsMobile();

  const query = searchQuery.toLowerCase().trim();
  const sharedByCollection = useMemo(() => sharedRecipesByCollection ?? {}, [sharedRecipesByCollection]);

  const recipesByCollection = useMemo(() => {
    const map = {};
    for (const recipe of allRecipes ?? []) {
      (map[recipe.collectionId] ??= []).push(recipe);
    }
    return map;
  }, [allRecipes]);

  const recipeCounts = useMemo(() => {
    const counts = {};
    for (const recipe of allRecipes ?? []) {
      counts[recipe.collectionId] = (counts[recipe.collectionId] || 0) + 1;
    }
    return counts;
  }, [allRecipes]);

  /// Owned + shared collections normalized to one shape for chips and headers.
  const chipCollections = useMemo(() => {
    const owned = (collections ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji ?? '📁',
      isDefault: c.isDefault,
      shared: false,
      canWrite: true,
    }));
    const shared = (sharedCollections ?? []).map((sc) => ({
      id: sc.collectionId,
      name: sc.collection?.name ?? 'Shared Collection',
      emoji: sc.collection?.emoji ?? '📁',
      isDefault: false,
      shared: true,
      canWrite: sc.permission === 'write',
    }));
    return [...owned, ...shared];
  }, [collections, sharedCollections]);

  const collectionById = useMemo(() => {
    const map = {};
    for (const c of chipCollections) map[c.id] = c;
    return map;
  }, [chipCollections]);

  const selectedCollection = selectedCollectionId ? collectionById[selectedCollectionId] ?? null : null;

  // Clear a stale selection (deleted collection, revoked share) once
  // collections have loaded.
  useEffect(() => {
    if (!selectedCollectionId || chipCollections.length === 0) return;
    if (!collectionById[selectedCollectionId]) {
      setSelectedCollectionId(null);
      try {
        localStorage.removeItem(SELECTED_KEY);
      } catch {
        // Ignore localStorage errors.
      }
    }
  }, [selectedCollectionId, chipCollections.length, collectionById]);

  const selectChip = useCallback((collectionId) => {
    setSelectedCollectionId(collectionId);
    try {
      if (collectionId) localStorage.setItem(SELECTED_KEY, collectionId);
      else localStorage.removeItem(SELECTED_KEY);
    } catch {
      // Ignore localStorage errors.
    }
    // Keep the context's active collection in sync so new recipes default
    // into the selected collection.
    if (collectionId) onSelectCollection?.(collectionId);
  }, [onSelectCollection]);

  const countFor = useCallback((c) => {
    if (c.shared) return (sharedByCollection[c.id] ?? []).length;
    return recipeCounts[c.id] ?? 0;
  }, [sharedByCollection, recipeCounts]);

  /// The cards currently in the grid: the selected collection's recipes, or
  /// every recipe (owned + shared) for "All" — filtered by the search query
  /// against recipe and collection names.
  const displayedRecipes = useMemo(() => {
    let result;
    if (selectedCollection) {
      result = selectedCollection.shared
        ? sharedByCollection[selectedCollection.id] ?? []
        : recipesByCollection[selectedCollection.id] ?? [];
    } else {
      const shared = (sharedCollections ?? []).flatMap((sc) => sharedByCollection[sc.collectionId] ?? []);
      result = [...(allRecipes ?? []), ...shared];
    }
    if (!query) return result;
    return result.filter((r) => {
      if ((r.name ?? '').toLowerCase().includes(query)) return true;
      const c = collectionById[r.collectionId];
      return (c?.name ?? '').toLowerCase().includes(query);
    });
  }, [selectedCollection, sharedByCollection, recipesByCollection, sharedCollections, allRecipes, query, collectionById]);

  // Focus management
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  useEffect(() => {
    if (showNewCollectionForm && newCollectionInputRef.current) {
      newCollectionInputRef.current.focus();
    }
  }, [showNewCollectionForm]);

  useEffect(() => {
    if (!menuOpenId && !addMenuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpenId(null);
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenId, addMenuOpen]);

  useEffect(() => {
    if (!movePickerRecipeId && !methodChooser && !addMenuOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMovePickerRecipeId(null);
        setMethodChooser(null);
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [movePickerRecipeId, methodChooser, addMenuOpen]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleCreateCollection = useCallback(async () => {
    if (!newCollectionName.trim()) return;
    await onCreateCollection?.({ name: newCollectionName.trim(), emoji: newCollectionEmoji || '📁' });
    setNewCollectionName('');
    setNewCollectionEmoji('📁');
    setShowNewCollectionForm(false);
  }, [newCollectionName, newCollectionEmoji, onCreateCollection]);

  const handleStartRename = useCallback((collection) => {
    setRenamingId(collection.id);
    setRenameValue(collection.name);
    setRenameEmoji(collection.emoji ?? '📁');
    setMenuOpenId(null);
  }, []);

  const handleConfirmRename = useCallback(async () => {
    if (!renameValue.trim() || !renamingId) return;
    await onUpdateCollection?.(renamingId, { name: renameValue.trim(), emoji: renameEmoji || '📁' });
    setRenamingId(null);
    setRenameValue('');
  }, [renamingId, renameValue, renameEmoji, onUpdateCollection]);

  const handleCancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  const handleRenameKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmRename();
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
  }, [handleConfirmRename, handleCancelRename]);

  const handleNewCollectionKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateCollection();
    } else if (e.key === 'Escape') {
      setShowNewCollectionForm(false);
      setNewCollectionName('');
    }
  }, [handleCreateCollection]);

  const handleConfirmMoveAndDelete = useCallback(async () => {
    if (!confirmingDeleteId) return;
    await onDeleteCollection?.(confirmingDeleteId, { deleteRecipes: false });
    if (selectedCollectionId === confirmingDeleteId) selectChip(null);
    setConfirmingDeleteId(null);
  }, [confirmingDeleteId, onDeleteCollection, selectedCollectionId, selectChip]);

  const handleConfirmDeleteAll = useCallback(async () => {
    if (!confirmingDeleteId) return;
    await onDeleteCollection?.(confirmingDeleteId, { deleteRecipes: true });
    if (selectedCollectionId === confirmingDeleteId) selectChip(null);
    setConfirmingDeleteId(null);
  }, [confirmingDeleteId, onDeleteCollection, selectedCollectionId, selectChip]);

  const handleConfirmLeave = useCallback(async () => {
    if (!confirmingLeaveId) return;
    await onLeaveCollection?.(confirmingLeaveId);
    if (selectedCollectionId === confirmingLeaveId) selectChip(null);
    setConfirmingLeaveId(null);
  }, [confirmingLeaveId, onLeaveCollection, selectedCollectionId, selectChip]);

  const handleMoveRecipe = useCallback((targetCollectionId) => {
    if (movePickerRecipeId && onMoveRecipe) {
      onMoveRecipe(movePickerRecipeId, targetCollectionId);
    }
    setMovePickerRecipeId(null);
  }, [movePickerRecipeId, onMoveRecipe]);

  // Open the new-recipe method chooser, optionally targeting a collection.
  const openMethodChooser = useCallback((collectionId = null) => {
    setAddMenuOpen(false);
    setMethodChooser({ collectionId });
  }, []);

  const chooseMethod = useCallback((method) => {
    const collectionId = methodChooser?.collectionId ?? null;
    setMethodChooser(null);
    if (method === 'scratch') onCreate?.(collectionId);
    else if (method === 'search') onSearchOnline?.();
  }, [methodChooser, onCreate, onSearchOnline]);

  // -------------------------------------------------------------------------
  // Renderers
  // -------------------------------------------------------------------------

  const renderCardImage = (recipe) => {
    const marker = !selectedCollection ? collectionById[recipe.collectionId] : null;
    return (
      <div className={styles.cardImageWrap}>
        {recipe.imageUrl ? (
          <img src={recipe.imageUrl} alt="" className={styles.cardImage} />
        ) : (
          <div className={styles.cardPlaceholder}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
              <path d="M7 2v20" />
              <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
            </svg>
          </div>
        )}
        {marker && (
          <span className={styles.cardMarker} title={marker.name}>{marker.emoji}</span>
        )}
        {collectionById[recipe.collectionId]?.shared && (
          <span className={styles.cardSharedBadge}>Shared</span>
        )}
      </div>
    );
  };

  // Collaborators on a write-shared collection can edit and delete any recipe
  // in it; moving stays owner-collection-only since it can pull a recipe out
  // of the shared collection.
  const renderRecipeCard = (recipe) => {
    const collection = collectionById[recipe.collectionId];
    const shared = collection?.shared ?? false;
    const canWrite = collection?.canWrite ?? true;
    const menuId = `recipe-${recipe.id}`;
    const isMenuOpen = menuOpenId === menuId;
    const canEdit = !shared || canWrite;
    const canMove = !shared && onMoveRecipe;
    const canDelete = !shared || canWrite;
    const isViewOnly = shared && !canWrite;

    const menuActions = isViewOnly
      ? [{ label: 'View', onClick: () => onSelect(recipe.id) }]
      : [
          canEdit && { label: 'Edit', icon: '✏️', onClick: () => onEdit(recipe.id) },
          canMove && { label: 'Move to Collection', icon: '📂', onClick: () => setMovePickerRecipeId(recipe.id) },
          canDelete && { label: 'Delete', icon: '🗑️', danger: true, onClick: () => setConfirmingDeleteId(recipe.id) },
        ].filter(Boolean);

    return (
      <div key={recipe.id} className={styles.recipeCard}>
        <button type="button" className={styles.cardMainBtn} onClick={() => onSelect(recipe.id)}>
          {renderCardImage(recipe)}
          <span className={styles.cardBody}>
            <span className={styles.cardName}>{recipe.name}</span>
            <span className={styles.cardMeta}>
              {recipe.ingredientCount ?? 0} ingredients · {recipe.stepCount ?? 0} steps
            </span>
          </span>
        </button>

        <div className={`${styles.menuWrap} ${styles.cardMenuWrap}`} ref={isMenuOpen && !isMobile ? menuRef : null}>
          <button
            type="button"
            className={styles.cardMenuBtn}
            onClick={() => setMenuOpenId(isMenuOpen ? null : menuId)}
            aria-label={`Options for ${recipe.name}`}
          >
            &#x22EE;
          </button>
          {isMenuOpen && !isMobile && (
            <div className={styles.menuDropdown}>
              {menuActions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  className={`${styles.menuItem} ${a.danger ? styles.menuDanger : ''}`}
                  onClick={() => { a.onClick(); setMenuOpenId(null); }}
                >
                  {a.icon && <span className={styles.menuIcon}>{a.icon}</span>}
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {isMenuOpen && isMobile && (
          <>
            <div className={styles.actionSheetBackdrop} onClick={() => setMenuOpenId(null)} />
            <div className={styles.actionSheet}>
              <div className={styles.actionSheetGroup}>
                <div className={styles.actionSheetTitle}>{recipe.name}</div>
                {menuActions.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    className={`${styles.actionSheetItem} ${a.danger ? styles.actionSheetDanger : ''}`}
                    onClick={() => { a.onClick(); setMenuOpenId(null); }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <button type="button" className={styles.actionSheetCancel} onClick={() => setMenuOpenId(null)}>
                Cancel
              </button>
            </div>
          </>
        )}

        {confirmingDeleteId === recipe.id && (
          <ConfirmDialog
            message={`Delete "${recipe.name}" and all its contents?`}
            onConfirm={() => { onDelete(recipe.id); setConfirmingDeleteId(null); }}
            onCancel={() => setConfirmingDeleteId(null)}
          />
        )}
      </div>
    );
  };

  const renderCollectionMenu = (collection, menuId) => {
    const isMenuOpen = menuOpenId === menuId;
    return (
      <div className={styles.menuWrap} ref={isMenuOpen && !isMobile ? menuRef : null}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={(e) => { e.stopPropagation(); setMenuOpenId(isMenuOpen ? null : menuId); }}
          aria-label={`Options for ${collection.name}`}
        >
          &#x22EE;
        </button>
        {isMenuOpen && !isMobile && (
          <div className={styles.menuDropdown}>
            {collection.shared ? (
              <button type="button" className={`${styles.menuItem} ${styles.menuDanger}`} onClick={() => { setConfirmingLeaveId(collection.id); setMenuOpenId(null); }}>
                <span className={styles.menuIcon}>🚪</span>Leave
              </button>
            ) : (
              <>
                <button type="button" className={styles.menuItem} onClick={() => handleStartRename(collection)}>
                  <span className={styles.menuIcon}>✏️</span>Rename
                </button>
                {onShareCollection && (
                  <button type="button" className={styles.menuItem} onClick={() => { onShareCollection(collection.id); setMenuOpenId(null); }}>
                    <span className={styles.menuIcon}>🔗</span>Share
                  </button>
                )}
                {!collection.isDefault && (
                  <button type="button" className={`${styles.menuItem} ${styles.menuDanger}`} onClick={() => { setConfirmingDeleteId(collection.id); setMenuOpenId(null); }}>
                    <span className={styles.menuIcon}>🗑️</span>Delete
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {isMenuOpen && isMobile && (
          <>
            <div className={styles.actionSheetBackdrop} onClick={() => setMenuOpenId(null)} />
            <div className={styles.actionSheet}>
              <div className={styles.actionSheetGroup}>
                <div className={styles.actionSheetTitle}>{collection.name}</div>
                {collection.shared ? (
                  <button type="button" className={`${styles.actionSheetItem} ${styles.actionSheetDanger}`} onClick={() => { setConfirmingLeaveId(collection.id); setMenuOpenId(null); }}>Leave</button>
                ) : (
                  <>
                    <button type="button" className={styles.actionSheetItem} onClick={() => handleStartRename(collection)}>Rename</button>
                    {onShareCollection && (
                      <button type="button" className={styles.actionSheetItem} onClick={() => { onShareCollection(collection.id); setMenuOpenId(null); }}>Share</button>
                    )}
                    {!collection.isDefault && (
                      <button type="button" className={`${styles.actionSheetItem} ${styles.actionSheetDanger}`} onClick={() => { setConfirmingDeleteId(collection.id); setMenuOpenId(null); }}>Delete</button>
                    )}
                  </>
                )}
              </div>
              <button type="button" className={styles.actionSheetCancel} onClick={() => setMenuOpenId(null)}>Cancel</button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderChipRow = () => (
    <div className={styles.chipRow}>
      <button
        type="button"
        className={`${styles.chip} ${!selectedCollectionId ? styles.chipActive : ''}`}
        onClick={() => selectChip(null)}
      >
        All
      </button>
      {chipCollections.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`${styles.chip} ${selectedCollectionId === c.id ? styles.chipActive : ''}`}
          onClick={() => selectChip(c.id)}
        >
          <span className={styles.chipEmoji}>{c.emoji}</span>
          {c.name}
        </button>
      ))}
    </div>
  );

  const renderCollectionHeader = (collection) => {
    const isRenaming = renamingId === collection.id;
    if (isRenaming) {
      return (
        <div className={styles.collectionHeaderCard}>
          <div className={styles.accordionRenameRow}>
            <EmojiPicker value={renameEmoji} onSelect={setRenameEmoji} />
            <input
              ref={renameInputRef}
              type="text"
              className={styles.inlineRenameInput}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={handleConfirmRename}
            />
          </div>
        </div>
      );
    }
    return (
      <div className={styles.collectionHeaderCard}>
        <span className={styles.collectionEmoji}>{collection.emoji}</span>
        <span className={styles.collectionHeaderName}>
          {collection.name}
          {collection.shared && <span className={styles.sharedBadge}>Shared</span>}
        </span>
        <span className={styles.collectionCount}>{countFor(collection)}</span>
        <span className={styles.collectionHeaderSpacer} />
        {collection.canWrite && (
          <button
            type="button"
            className={styles.collectionAddBtn}
            onClick={() => openMethodChooser(collection.id)}
            aria-label={`Add recipe to ${collection.name}`}
          >
            +
          </button>
        )}
        {renderCollectionMenu(collection, `col-${collection.id}`)}
      </div>
    );
  };

  const renderGrid = () => {
    if (displayedRecipes.length === 0) {
      if (query) {
        return <p className={styles.emptyMsg}>No recipes match your search.</p>;
      }
      const canAdd = !selectedCollection || selectedCollection.canWrite;
      return (
        <div className={styles.gridEmpty}>
          <p className={styles.emptyMsg}>
            {selectedCollection ? 'Nothing in this collection yet.' : 'No recipes yet.'}
          </p>
          {canAdd && (
            <button type="button" className={styles.gridEmptyBtn} onClick={() => openMethodChooser(selectedCollectionId)}>
              + Add a recipe
            </button>
          )}
        </div>
      );
    }
    return <div className={styles.recipeGrid}>{displayedRecipes.map(renderRecipeCard)}</div>;
  };

  const renderSearchBar = () => (
    <div className={styles.searchBar}>
      <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        className={styles.searchInput}
        placeholder="Search recipes & collections..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      {searchQuery && (
        <button type="button" className={styles.clearBtn} onClick={() => setSearchQuery('')} aria-label="Clear search">×</button>
      )}
    </div>
  );

  const renderAddMenu = () => (
    <div className={styles.menuWrap} ref={addMenuOpen && !isMobile ? menuRef : null}>
      <button
        type="button"
        className={isMobile ? styles.circleBtn : styles.newBtn}
        onClick={() => setAddMenuOpen((v) => !v)}
        aria-label="Add"
      >
        {isMobile ? '+' : '+ Add'}
      </button>
      {addMenuOpen && !isMobile && (
        <div className={styles.menuDropdown}>
          <button type="button" className={styles.menuItem} onClick={() => openMethodChooser(selectedCollectionId)}>
            <span className={styles.menuIcon}>🍳</span>New Recipe
          </button>
          <button type="button" className={styles.menuItem} onClick={() => { setAddMenuOpen(false); setShowNewCollectionForm(true); }}>
            <span className={styles.menuIcon}>📁</span>New Collection
          </button>
        </div>
      )}
      {addMenuOpen && isMobile && (
        <>
          <div className={styles.actionSheetBackdrop} onClick={() => setAddMenuOpen(false)} />
          <div className={styles.actionSheet}>
            <div className={styles.actionSheetGroup}>
              <button type="button" className={styles.actionSheetItem} onClick={() => openMethodChooser(selectedCollectionId)}>🍳  New Recipe</button>
              <button type="button" className={styles.actionSheetItem} onClick={() => { setAddMenuOpen(false); setShowNewCollectionForm(true); }}>📁  New Collection</button>
            </div>
            <button type="button" className={styles.actionSheetCancel} onClick={() => setAddMenuOpen(false)}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );

  const renderMethodChooser = () => {
    if (!methodChooser) return null;
    const target = chipCollections.find((c) => c.id === methodChooser.collectionId);
    // Portal to body so the centered modal escapes the sticky sidebar's stacking
    // context and overlays the right content panel.
    return createPortal(
      <>
        <div className={styles.movePickerBackdrop} onClick={() => setMethodChooser(null)} />
        <div className={styles.movePickerPanel}>
          <div className={styles.movePickerHeader}>
            <span className={styles.movePickerTitle}>
              New Recipe{target ? ` in ${target.name}` : ''}
            </span>
            <button type="button" className={styles.movePickerClose} onClick={() => setMethodChooser(null)} aria-label="Close">×</button>
          </div>
          <div className={styles.movePickerList}>
            <button type="button" className={styles.methodItem} onClick={() => chooseMethod('scratch')}>
              <span className={styles.methodIcon}>✏️</span>
              <span className={styles.methodText}><span className={styles.methodName}>Start from scratch</span><span className={styles.methodHint}>Build it ingredient by ingredient</span></span>
            </button>
            <button type="button" className={styles.methodItem} onClick={() => chooseMethod('search')}>
              <span className={styles.methodIcon}>🌐</span>
              <span className={styles.methodText}><span className={styles.methodName}>Search online</span><span className={styles.methodHint}>Find a recipe on the web</span></span>
            </button>
          </div>
          <button type="button" className={styles.movePickerCancel} onClick={() => setMethodChooser(null)}>Cancel</button>
        </div>
      </>,
      document.body,
    );
  };

  const renderNewCollectionForm = () => {
    if (!showNewCollectionForm) return null;
    return (
      <div className={styles.inlineForm}>
        <EmojiPicker value={newCollectionEmoji} onSelect={setNewCollectionEmoji} />
        <input
          ref={newCollectionInputRef}
          type="text"
          className={styles.inlineInput}
          placeholder="Collection name..."
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          onKeyDown={handleNewCollectionKeyDown}
        />
        <button type="button" className={`${styles.inlineBtn} ${styles.inlineCancelBtn}`} onClick={() => { setShowNewCollectionForm(false); setNewCollectionName(''); setNewCollectionEmoji('📁'); }}>Cancel</button>
        <button type="button" className={`${styles.inlineBtn} ${styles.inlineSaveBtn}`} onClick={handleCreateCollection}>Create</button>
      </div>
    );
  };

  const renderMovePicker = () => {
    if (!movePickerRecipeId) return null;
    const current = allRecipes?.find((r) => r.id === movePickerRecipeId);
    const targetCollections = collections?.filter((c) => c.id !== current?.collectionId) ?? [];
    return createPortal(
      <>
        <div className={styles.movePickerBackdrop} onClick={() => setMovePickerRecipeId(null)} />
        <div className={styles.movePickerPanel}>
          <div className={styles.movePickerHeader}>
            <span className={styles.movePickerTitle}>Move to Collection</span>
            <button type="button" className={styles.movePickerClose} onClick={() => setMovePickerRecipeId(null)} aria-label="Close">×</button>
          </div>
          <div className={styles.movePickerList}>
            {targetCollections.length === 0 ? (
              <p className={styles.emptyMsg}>No other collections available.</p>
            ) : (
              targetCollections.map((col) => (
                <button key={col.id} type="button" className={styles.movePickerItem} onClick={() => handleMoveRecipe(col.id)}>
                  <span className={styles.collectionEmoji}>{col.emoji ?? '📁'}</span>
                  <span className={styles.movePickerItemName}>{col.name}</span>
                </button>
              ))
            )}
          </div>
          <button type="button" className={styles.movePickerCancel} onClick={() => setMovePickerRecipeId(null)}>Cancel</button>
        </div>
      </>,
      document.body,
    );
  };

  const hasNothing = chipCollections.length === 0;

  const body = (
    <>
      {renderNewCollectionForm()}

      {hasNothing && !showNewCollectionForm ? (
        <p className={styles.emptyMsg}>No collections yet. Tap + to add a recipe or collection.</p>
      ) : (
        <>
          {renderChipRow()}
          {selectedCollection && renderCollectionHeader(selectedCollection)}
          {renderGrid()}
        </>
      )}
    </>
  );

  const dialogs = (
    <>
      {renderMethodChooser()}
      {renderMovePicker()}
      {confirmingDeleteId && collections?.some((c) => c.id === confirmingDeleteId) && (
        <DeleteCollectionDialog
          collectionName={collections.find((c) => c.id === confirmingDeleteId)?.name ?? ''}
          recipeCount={recipeCounts[confirmingDeleteId] ?? 0}
          defaultCollectionName={collections.find((c) => c.isDefault)?.name ?? 'My Recipes'}
          onMoveAndDelete={handleConfirmMoveAndDelete}
          onDeleteAll={handleConfirmDeleteAll}
          onCancel={() => setConfirmingDeleteId(null)}
        />
      )}
      {confirmingLeaveId && (
        <ConfirmDialog
          message={`Leave "${sharedCollections?.find((sc) => sc.collectionId === confirmingLeaveId)?.collection?.name}"? You will lose access to this collection.`}
          onConfirm={handleConfirmLeave}
          onCancel={() => setConfirmingLeaveId(null)}
        />
      )}
    </>
  );

  if (isMobile) {
    return (
      <div className={styles.mobileLayout}>
        <div className={styles.mobileHeader}>
          <div className={styles.header}>
            <h2 className={styles.title}>Recipes</h2>
            <div className={styles.headerActions}>{renderAddMenu()}</div>
          </div>
          {renderSearchBar()}
        </div>
        <div className={styles.scrollArea}>{body}</div>
        {dialogs}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Recipes</h2>
        <div className={styles.headerActions}>{renderAddMenu()}</div>
      </div>
      {renderSearchBar()}
      {body}
      {dialogs}
    </div>
  );
};

RecipeSelector.propTypes = {
  collections: PropTypes.array,
  sharedCollections: PropTypes.array,
  sharedRecipesByCollection: PropTypes.object,
  allRecipes: PropTypes.array,
  onSelectCollection: PropTypes.func,
  onCreateCollection: PropTypes.func,
  onUpdateCollection: PropTypes.func,
  onDeleteCollection: PropTypes.func,
  onShareCollection: PropTypes.func,
  onLeaveCollection: PropTypes.func,
  onSelect: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onMoveRecipe: PropTypes.func,
  onSearchOnline: PropTypes.func,
};
