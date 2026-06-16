import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { DeleteCollectionDialog } from './DeleteCollectionDialog.jsx';
import { EmojiPicker } from './EmojiPicker.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import styles from './RecipeSelector.module.css';

const EXPANDED_KEY = 'gather_recipe_expanded_collections';

const readExpanded = () => {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    return raw ? new Set(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

/**
 * Recipe browsing screen. Collections are shown as collapsible accordions with
 * their recipes nested inline, so recipes are visible without leaving the
 * screen. A single "+" adds a recipe (via a method chooser) or a collection;
 * each collection header also has a "+" to add a recipe straight into it.
 */
export const RecipeSelector = ({
  collections,
  sharedCollections,
  sharedCollectionRecipes,
  activeCollectionId,
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
  currentUserId,
  onSearchOnline,
  onImportFromText,
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
  // null = "expand all by default"; a Set once the user has toggled anything.
  const [expanded, setExpanded] = useState(readExpanded);
  const [expandedSharedId, setExpandedSharedId] = useState(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  // { collectionId: string | null } when the new-recipe method chooser is open.
  const [methodChooser, setMethodChooser] = useState(null);

  const menuRef = useRef(null);
  const renameInputRef = useRef(null);
  const newCollectionInputRef = useRef(null);
  const isMobile = useIsMobile();

  const query = searchQuery.toLowerCase().trim();

  // Recipes grouped by collection (owned recipes are all loaded in allRecipes).
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

  const filteredCollections = useMemo(() => {
    if (!collections) return [];
    if (!query) return collections;
    // Keep a collection if its name matches, or any of its recipes match.
    return collections.filter((c) => {
      if ((c.name ?? '').toLowerCase().includes(query)) return true;
      return (recipesByCollection[c.id] ?? []).some((r) =>
        (r.name ?? '').toLowerCase().includes(query)
      );
    });
  }, [collections, query, recipesByCollection]);

  const filteredSharedCollections = useMemo(() => {
    if (!sharedCollections) return [];
    if (!query) return sharedCollections;
    return sharedCollections.filter((sc) =>
      (sc.collection?.name ?? '').toLowerCase().includes(query)
    );
  }, [sharedCollections, query]);

  const isExpanded = useCallback(
    (id) => (expanded === null ? true : expanded.has(id)),
    [expanded]
  );

  const toggleExpanded = useCallback((id) => {
    setExpanded((prev) => {
      const base = prev === null ? new Set((collections ?? []).map((c) => c.id)) : new Set(prev);
      if (base.has(id)) base.delete(id);
      else base.add(id);
      try {
        localStorage.setItem(EXPANDED_KEY, JSON.stringify([...base]));
      } catch {
        // Ignore localStorage errors.
      }
      return base;
    });
  }, [collections]);

  const toggleSharedExpanded = useCallback((collectionId) => {
    setExpandedSharedId((prev) => {
      const next = prev === collectionId ? null : collectionId;
      // Loading shared-collection recipes requires making it the active collection.
      if (next) onSelectCollection?.(next);
      return next;
    });
  }, [onSelectCollection]);

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
    setConfirmingDeleteId(null);
  }, [confirmingDeleteId, onDeleteCollection]);

  const handleConfirmDeleteAll = useCallback(async () => {
    if (!confirmingDeleteId) return;
    await onDeleteCollection?.(confirmingDeleteId, { deleteRecipes: true });
    setConfirmingDeleteId(null);
  }, [confirmingDeleteId, onDeleteCollection]);

  const handleConfirmLeave = useCallback(async () => {
    if (!confirmingLeaveId) return;
    await onLeaveCollection?.(confirmingLeaveId);
    setConfirmingLeaveId(null);
  }, [confirmingLeaveId, onLeaveCollection]);

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
    else if (method === 'import') onImportFromText?.(collectionId);
    else if (method === 'search') onSearchOnline?.();
  }, [methodChooser, onCreate, onImportFromText, onSearchOnline]);

  // -------------------------------------------------------------------------
  // Renderers
  // -------------------------------------------------------------------------

  const renderRecipeThumbnail = (imageUrl) => {
    if (imageUrl) {
      return <img src={imageUrl} alt="" className={styles.recipeThumbnail} />;
    }
    return (
      <div className={styles.recipePlaceholder}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </svg>
      </div>
    );
  };

  const renderRecipeRow = (recipe, { shared = false } = {}) => {
    const menuId = `recipe-${recipe.id}`;
    const isMenuOpen = menuOpenId === menuId;
    const isUsersRecipe = currentUserId && recipe.ownerId === currentUserId;
    const canEdit = !shared || isUsersRecipe;
    const canMove = !shared && onMoveRecipe;
    const canDelete = !shared || isUsersRecipe;
    const isViewOnly = shared && !isUsersRecipe;

    const menuActions = isViewOnly
      ? [{ label: 'View', onClick: () => onSelect(recipe.id) }]
      : [
          canEdit && { label: 'Edit', icon: '✏️', onClick: () => onEdit(recipe.id) },
          canMove && { label: 'Move to Collection', icon: '📂', onClick: () => setMovePickerRecipeId(recipe.id) },
          canDelete && { label: shared ? 'Remove' : 'Delete', icon: '🗑️', danger: true, onClick: () => setConfirmingDeleteId(recipe.id) },
        ].filter(Boolean);

    return (
      <div key={recipe.id} className={`${styles.listItem} ${styles.recipeSubRow}`}>
        <button className={styles.listBtn} onClick={() => onSelect(recipe.id)}>
          {renderRecipeThumbnail(recipe.imageUrl)}
          <span className={styles.listText}>
            <span className={styles.listName}>{recipe.name}</span>
            <span className={styles.listCount}>
              {recipe.ingredientCount ?? 0} ingredients · {recipe.stepCount ?? 0} steps
            </span>
          </span>
          <span className={styles.chevron}>›</span>
        </button>

        <div className={styles.menuWrap} ref={isMenuOpen && !isMobile ? menuRef : null}>
          <button
            type="button"
            className={styles.menuBtn}
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
            message={shared ? `Remove "${recipe.name}" from this collection?` : `Delete "${recipe.name}" and all its contents?`}
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
          </div>
        )}
        {isMenuOpen && isMobile && (
          <>
            <div className={styles.actionSheetBackdrop} onClick={() => setMenuOpenId(null)} />
            <div className={styles.actionSheet}>
              <div className={styles.actionSheetGroup}>
                <div className={styles.actionSheetTitle}>{collection.name}</div>
                <button type="button" className={styles.actionSheetItem} onClick={() => handleStartRename(collection)}>Rename</button>
                {onShareCollection && (
                  <button type="button" className={styles.actionSheetItem} onClick={() => { onShareCollection(collection.id); setMenuOpenId(null); }}>Share</button>
                )}
                {!collection.isDefault && (
                  <button type="button" className={`${styles.actionSheetItem} ${styles.actionSheetDanger}`} onClick={() => { setConfirmingDeleteId(collection.id); setMenuOpenId(null); }}>Delete</button>
                )}
              </div>
              <button type="button" className={styles.actionSheetCancel} onClick={() => setMenuOpenId(null)}>Cancel</button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderCollectionAccordion = (collection) => {
    const isRenaming = renamingId === collection.id;
    const open = isExpanded(collection.id);
    const count = recipeCounts[collection.id] ?? 0;
    const recipes = recipesByCollection[collection.id] ?? [];
    const visibleRecipes = query
      ? recipes.filter((r) => (r.name ?? '').toLowerCase().includes(query) || (collection.name ?? '').toLowerCase().includes(query))
      : recipes;

    return (
      <div key={collection.id} className={styles.accordion}>
        <div className={styles.accordionHeader}>
          {isRenaming ? (
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
          ) : (
            <>
              <button
                type="button"
                className={styles.accordionToggle}
                onClick={() => toggleExpanded(collection.id)}
                aria-expanded={open}
              >
                <span className={`${styles.accordionChevron} ${open ? styles.accordionChevronOpen : ''}`}>›</span>
                <span className={styles.collectionEmoji}>{collection.emoji ?? '📁'}</span>
                <span className={styles.accordionName}>{collection.name}</span>
                <span className={styles.collectionCount}>{count}</span>
              </button>
              <button
                type="button"
                className={styles.collectionAddBtn}
                onClick={() => openMethodChooser(collection.id)}
                aria-label={`Add recipe to ${collection.name}`}
              >
                +
              </button>
              {renderCollectionMenu(collection, `col-${collection.id}`)}
            </>
          )}
        </div>

        {open && !isRenaming && (
          <div className={styles.accordionBody}>
            {visibleRecipes.length === 0 ? (
              <button type="button" className={styles.accordionEmpty} onClick={() => openMethodChooser(collection.id)}>
                {query ? 'No matching recipes' : '+ Add a recipe'}
              </button>
            ) : (
              visibleRecipes.map((r) => renderRecipeRow(r, { shared: false }))
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSharedAccordion = (sc) => {
    const open = expandedSharedId === sc.collectionId;
    const count = sc.recipeCount ?? 0;
    const menuId = `shared-col-${sc.collectionId}`;
    const isMenuOpen = menuOpenId === menuId;
    const recipes = open ? (sharedCollectionRecipes ?? []) : [];

    return (
      <div key={sc.collectionId} className={styles.accordion}>
        <div className={styles.accordionHeader}>
          <button
            type="button"
            className={styles.accordionToggle}
            onClick={() => toggleSharedExpanded(sc.collectionId)}
            aria-expanded={open}
          >
            <span className={`${styles.accordionChevron} ${open ? styles.accordionChevronOpen : ''}`}>›</span>
            <span className={styles.collectionEmoji}>{sc.collection?.emoji ?? '📁'}</span>
            <span className={styles.accordionName}>
              {sc.collection?.name ?? 'Shared Collection'}
              <span className={styles.sharedBadge}>Shared</span>
            </span>
            <span className={styles.collectionCount}>{count}</span>
          </button>
          <div className={styles.menuWrap} ref={isMenuOpen && !isMobile ? menuRef : null}>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={(e) => { e.stopPropagation(); setMenuOpenId(isMenuOpen ? null : menuId); }}
              aria-label={`Options for ${sc.collection?.name ?? 'Shared Collection'}`}
            >
              &#x22EE;
            </button>
            {isMenuOpen && !isMobile && (
              <div className={styles.menuDropdown}>
                <button type="button" className={`${styles.menuItem} ${styles.menuDanger}`} onClick={() => { setConfirmingLeaveId(sc.collectionId); setMenuOpenId(null); }}>
                  <span className={styles.menuIcon}>🚪</span>Leave
                </button>
              </div>
            )}
            {isMenuOpen && isMobile && (
              <>
                <div className={styles.actionSheetBackdrop} onClick={() => setMenuOpenId(null)} />
                <div className={styles.actionSheet}>
                  <div className={styles.actionSheetGroup}>
                    <div className={styles.actionSheetTitle}>{sc.collection?.name ?? 'Shared Collection'}</div>
                    <button type="button" className={`${styles.actionSheetItem} ${styles.actionSheetDanger}`} onClick={() => { setConfirmingLeaveId(sc.collectionId); setMenuOpenId(null); }}>Leave</button>
                  </div>
                  <button type="button" className={styles.actionSheetCancel} onClick={() => setMenuOpenId(null)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>

        {open && (
          <div className={styles.accordionBody}>
            {recipes.length === 0 ? (
              <div className={styles.accordionEmptyText}>No recipes in this collection</div>
            ) : (
              recipes.map((r) => renderRecipeRow(r, { shared: true }))
            )}
          </div>
        )}
      </div>
    );
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
          <button type="button" className={styles.menuItem} onClick={() => openMethodChooser(null)}>
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
              <button type="button" className={styles.actionSheetItem} onClick={() => openMethodChooser(null)}>🍳  New Recipe</button>
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
    const target = collections?.find((c) => c.id === methodChooser.collectionId);
    return (
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
            <button type="button" className={styles.methodItem} onClick={() => chooseMethod('import')}>
              <span className={styles.methodIcon}>📋</span>
              <span className={styles.methodText}><span className={styles.methodName}>Import from text</span><span className={styles.methodHint}>Paste a recipe and auto-detect it</span></span>
            </button>
            <button type="button" className={styles.methodItem} onClick={() => chooseMethod('search')}>
              <span className={styles.methodIcon}>🌐</span>
              <span className={styles.methodText}><span className={styles.methodName}>Search online</span><span className={styles.methodHint}>Find a recipe on the web</span></span>
            </button>
          </div>
          <button type="button" className={styles.movePickerCancel} onClick={() => setMethodChooser(null)}>Cancel</button>
        </div>
      </>
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
    return (
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
      </>
    );
  };

  const hasNothing = filteredCollections.length === 0 && filteredSharedCollections.length === 0;

  const body = (
    <>
      {renderNewCollectionForm()}

      {hasNothing && !showNewCollectionForm && (
        <p className={styles.emptyMsg}>
          {query ? 'No recipes or collections match your search.' : 'No collections yet. Tap + to add a recipe or collection.'}
        </p>
      )}

      {filteredCollections.length > 0 && (
        <div className={styles.accordionList}>
          {filteredCollections.map(renderCollectionAccordion)}
        </div>
      )}

      {filteredSharedCollections.length > 0 && (
        <>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Shared with me</h3>
          </div>
          <div className={styles.accordionList}>
            {filteredSharedCollections.map(renderSharedAccordion)}
          </div>
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
  sharedCollectionRecipes: PropTypes.array,
  activeCollectionId: PropTypes.string,
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
  currentUserId: PropTypes.string,
  onSearchOnline: PropTypes.func,
  onImportFromText: PropTypes.func,
};
