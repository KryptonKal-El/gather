import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { RECIPE_TEMPLATES } from '../services/recipes.js';
import styles from './RecipeSelector.module.css';

/**
 * Recipe and Collection list screen for browsing and managing recipes.
 * Two-state component: collection list (default) ↔ recipe list.
 * Shows owned recipes/collections and shared ones with search, three-dot menu,
 * and iOS-style action sheets on mobile.
 */
export const RecipeSelector = ({
  // Collection props (new)
  collections,
  sharedCollections,
  activeCollectionId,
  allRecipes,
  onSelectCollection,
  onCreateCollection,
  onUpdateCollection,
  onDeleteCollection,
  onShareCollection,
  onLeaveCollection,
  // Recipe props (existing — keep for US-007)
  recipes,
  sharedRecipes = [],
  onSelect,
  onCreate,
  onEdit,
  onDelete,
  onShareClick,
  onSaveTemplate,
  onAddTemplateToList,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [expandedTemplateId, setExpandedTemplateId] = useState(null);
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmingLeaveId, setConfirmingLeaveId] = useState(null);
  const menuRef = useRef(null);
  const renameInputRef = useRef(null);
  const newCollectionInputRef = useRef(null);
  const isMobile = useIsMobile();

  // Determine if we're in collection mode (new) or legacy mode (backwards compat)
  const isCollectionMode = Array.isArray(collections);

  // Recipe counts per collection
  const recipeCounts = useMemo(() => {
    if (!allRecipes) return {};
    const counts = {};
    for (const recipe of allRecipes) {
      counts[recipe.collectionId] = (counts[recipe.collectionId] || 0) + 1;
    }
    return counts;
  }, [allRecipes]);

  // Focus rename input when editing starts
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Focus new collection input when form opens
  useEffect(() => {
    if (showNewCollectionForm && newCollectionInputRef.current) {
      newCollectionInputRef.current.focus();
    }
  }, [showNewCollectionForm]);

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

  const query = searchQuery.toLowerCase().trim();

  // Filtered collections for search
  const filteredCollections = useMemo(() => {
    if (!collections) return [];
    if (!query) return collections;
    return collections.filter((c) => (c.name ?? '').toLowerCase().includes(query));
  }, [collections, query]);

  const filteredSharedCollections = useMemo(() => {
    if (!sharedCollections) return [];
    if (!query) return sharedCollections;
    return sharedCollections.filter((sc) =>
      (sc.collection?.name ?? '').toLowerCase().includes(query)
    );
  }, [sharedCollections, query]);

  // Legacy recipe filtering
  const filteredRecipes = query
    ? recipes.filter((r) => (r.name ?? '').toLowerCase().includes(query))
    : recipes;

  const filteredSharedRecipes = query
    ? sharedRecipes.filter((r) => (r.recipeName ?? '').toLowerCase().includes(query))
    : sharedRecipes;

  // Collection handlers
  const handleCollectionClick = useCallback((collectionId) => {
    onSelectCollection?.(collectionId);
  }, [onSelectCollection]);

  const handleCreateCollection = useCallback(async () => {
    if (!newCollectionName.trim()) return;
    await onCreateCollection?.({ name: newCollectionName.trim(), emoji: '📁' });
    setNewCollectionName('');
    setShowNewCollectionForm(false);
  }, [newCollectionName, onCreateCollection]);

  const handleStartRename = useCallback((collection) => {
    setRenamingId(collection.id);
    setRenameValue(collection.name);
    setMenuOpenId(null);
  }, []);

  const handleConfirmRename = useCallback(async () => {
    if (!renameValue.trim() || !renamingId) return;
    await onUpdateCollection?.(renamingId, { name: renameValue.trim() });
    setRenamingId(null);
    setRenameValue('');
  }, [renamingId, renameValue, onUpdateCollection]);

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

  const handleDeleteCollection = useCallback((collection) => {
    setConfirmingDeleteId(collection.id);
    setMenuOpenId(null);
  }, []);

  const handleConfirmDeleteCollection = useCallback(async () => {
    if (!confirmingDeleteId) return;
    await onDeleteCollection?.(confirmingDeleteId, { deleteRecipes: false });
    setConfirmingDeleteId(null);
  }, [confirmingDeleteId, onDeleteCollection]);

  const handleShareCollection = useCallback((collection) => {
    onShareCollection?.(collection.id);
    setMenuOpenId(null);
  }, [onShareCollection]);

  const handleLeaveCollection = useCallback((sc) => {
    setConfirmingLeaveId(sc.collectionId);
    setMenuOpenId(null);
  }, []);

  const handleConfirmLeave = useCallback(async () => {
    if (!confirmingLeaveId) return;
    await onLeaveCollection?.(confirmingLeaveId);
    setConfirmingLeaveId(null);
  }, [confirmingLeaveId, onLeaveCollection]);

  const renderRecipeThumbnail = (imageUrl) => {
    if (imageUrl) {
      return (
        <img
          src={imageUrl}
          alt=""
          className={styles.recipeThumbnail}
        />
      );
    }
    return (
      <div className={styles.recipePlaceholder}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </svg>
      </div>
    );
  };

  const renderRecipeItem = (recipe) => {
    const isMenuOpen = menuOpenId === recipe.id;

    return (
      <div key={recipe.id} className={styles.listItem}>
        <button
          className={styles.listBtn}
          onClick={() => onSelect(recipe.id)}
        >
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
            onClick={() => setMenuOpenId(isMenuOpen ? null : recipe.id)}
            aria-label={`Options for ${recipe.name}`}
          >
            &#x22EE;
          </button>

          {isMenuOpen && !isMobile && (
            <div className={styles.menuDropdown}>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => { onEdit(recipe.id); setMenuOpenId(null); }}
              >
                <span className={styles.menuIcon}>✏️</span>
                Edit
              </button>
              {onShareClick && (
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => { onShareClick(recipe); setMenuOpenId(null); }}
                >
                  <span className={styles.menuIcon}>🔗</span>
                  Share
                </button>
              )}
              <button
                type="button"
                className={`${styles.menuItem} ${styles.menuDanger}`}
                onClick={() => { setConfirmingDeleteId(recipe.id); setMenuOpenId(null); }}
              >
                <span className={styles.menuIcon}>🗑️</span>
                Delete
              </button>
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
                <div className={styles.actionSheetTitle}>{recipe.name}</div>
                <button
                  type="button"
                  className={styles.actionSheetItem}
                  onClick={() => { onEdit(recipe.id); setMenuOpenId(null); }}
                >
                  Edit
                </button>
                {onShareClick && (
                  <button
                    type="button"
                    className={styles.actionSheetItem}
                    onClick={() => { onShareClick(recipe); setMenuOpenId(null); }}
                  >
                    Share
                  </button>
                )}
                <button
                  type="button"
                  className={`${styles.actionSheetItem} ${styles.actionSheetDanger}`}
                  onClick={() => { setConfirmingDeleteId(recipe.id); setMenuOpenId(null); }}
                >
                  Delete
                </button>
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

        {confirmingDeleteId === recipe.id && (
          <ConfirmDialog
            message={`Delete "${recipe.name}" and all its contents?`}
            onConfirm={() => {
              onDelete(recipe.id);
              setConfirmingDeleteId(null);
            }}
            onCancel={() => setConfirmingDeleteId(null)}
          />
        )}
      </div>
    );
  };

  const renderSharedRecipeItem = (ref) => {
    const isMenuOpen = menuOpenId === ref.id;

    return (
      <div key={ref.id} className={styles.listItem}>
        <button
          className={styles.listBtn}
          onClick={() => onSelect(ref.recipeId)}
        >
          <div className={styles.recipePlaceholder}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
              <path d="M7 2v20" />
              <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
            </svg>
          </div>
          <span className={styles.listText}>
            <span className={styles.listName}>
              {ref.recipeName}
              <span className={styles.sharedBadge}>Shared</span>
            </span>
          </span>
          <span className={styles.chevron}>›</span>
        </button>

        <div className={styles.menuWrap} ref={isMenuOpen && !isMobile ? menuRef : null}>
          <button
            type="button"
            className={styles.menuBtn}
            onClick={() => setMenuOpenId(isMenuOpen ? null : ref.id)}
            aria-label={`Options for ${ref.recipeName}`}
          >
            &#x22EE;
          </button>

          {isMenuOpen && !isMobile && (
            <div className={styles.menuDropdown}>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => { onEdit(ref.recipeId); setMenuOpenId(null); }}
              >
                <span className={styles.menuIcon}>👁️</span>
                View
              </button>
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
                <div className={styles.actionSheetTitle}>{ref.recipeName}</div>
                <button
                  type="button"
                  className={styles.actionSheetItem}
                  onClick={() => { onEdit(ref.recipeId); setMenuOpenId(null); }}
                >
                  View
                </button>
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
      </div>
    );
  };

  const handleTemplateClick = (templateId) => {
    setExpandedTemplateId(expandedTemplateId === templateId ? null : templateId);
  };

  const renderTemplatesSection = () => (
    <>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Browse Templates</h3>
      </div>
      <div className={styles.templatesSection}>
        <div className={styles.templateCards}>
          {RECIPE_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className={`${styles.templateCard} ${expandedTemplateId === template.id ? styles.templateCardActive : ''}`}
              onClick={() => handleTemplateClick(template.id)}
            >
              <span className={styles.templateName}>{template.name}</span>
              <span className={styles.templateDesc}>{template.description}</span>
              <span className={styles.templateCount}>{template.ingredients.length} ingredients</span>
            </button>
          ))}
        </div>
        {expandedTemplateId && (() => {
          const template = RECIPE_TEMPLATES.find((t) => t.id === expandedTemplateId);
          if (!template) return null;
          return (
            <div className={styles.templateDetail}>
              <div className={styles.templateDetailHeader}>
                <span className={styles.templateName}>{template.name}</span>
                <span className={styles.templateDesc}>{template.description}</span>
              </div>
              <div className={styles.templateIngredients}>
                {template.ingredients.map((ingredient) => (
                  <span key={ingredient} className={styles.templateIngredient}>
                    {ingredient.charAt(0).toUpperCase() + ingredient.slice(1)}
                  </span>
                ))}
              </div>
              <div className={styles.templateActions}>
                <button
                  type="button"
                  className={styles.templateSaveBtn}
                  onClick={() => {
                    onSaveTemplate?.(template);
                    setExpandedTemplateId(null);
                  }}
                >
                  Save as Recipe
                </button>
                <button
                  type="button"
                  className={styles.templateAddBtn}
                  onClick={() => {
                    onAddTemplateToList?.(template);
                    setExpandedTemplateId(null);
                  }}
                >
                  Add to List
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );

  // -------------------------------------------------------------------------
  // Collection List Rendering (New)
  // -------------------------------------------------------------------------

  const renderNewCollectionForm = () => {
    if (!showNewCollectionForm) return null;
    return (
      <div className={styles.inlineForm}>
        <span className={styles.collectionEmoji}>📁</span>
        <input
          ref={newCollectionInputRef}
          type="text"
          className={styles.inlineInput}
          placeholder="Collection name..."
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          onKeyDown={handleNewCollectionKeyDown}
        />
        <button
          type="button"
          className={`${styles.inlineBtn} ${styles.inlineSaveBtn}`}
          onClick={handleCreateCollection}
        >
          Create
        </button>
        <button
          type="button"
          className={`${styles.inlineBtn} ${styles.inlineCancelBtn}`}
          onClick={() => { setShowNewCollectionForm(false); setNewCollectionName(''); }}
        >
          Cancel
        </button>
      </div>
    );
  };

  const renderCollectionItem = (collection) => {
    const isMenuOpen = menuOpenId === `col-${collection.id}`;
    const isRenaming = renamingId === collection.id;
    const isActive = activeCollectionId === collection.id;
    const count = recipeCounts[collection.id] ?? 0;

    return (
      <div
        key={collection.id}
        className={`${styles.listItem} ${isActive ? styles.listItemActive : ''}`}
      >
        <button
          className={styles.listBtn}
          onClick={() => !isRenaming && handleCollectionClick(collection.id)}
          disabled={isRenaming}
        >
          <span className={styles.collectionEmoji}>{collection.emoji ?? '📁'}</span>
          <span className={styles.listText}>
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                className={styles.inlineRenameInput}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={handleConfirmRename}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className={styles.listName}>{collection.name}</span>
            )}
          </span>
          <span className={styles.collectionCount}>({count})</span>
          <span className={styles.chevron}>›</span>
        </button>

        {!isRenaming && (
          <div className={styles.menuWrap} ref={isMenuOpen && !isMobile ? menuRef : null}>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={() => setMenuOpenId(isMenuOpen ? null : `col-${collection.id}`)}
              aria-label={`Options for ${collection.name}`}
            >
              &#x22EE;
            </button>

            {isMenuOpen && !isMobile && (
              <div className={styles.menuDropdown}>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => handleStartRename(collection)}
                >
                  <span className={styles.menuIcon}>✏️</span>
                  Rename
                </button>
                {onShareCollection && (
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => handleShareCollection(collection)}
                  >
                    <span className={styles.menuIcon}>🔗</span>
                    Share
                  </button>
                )}
                {!collection.isDefault && (
                  <button
                    type="button"
                    className={`${styles.menuItem} ${styles.menuDanger}`}
                    onClick={() => handleDeleteCollection(collection)}
                  >
                    <span className={styles.menuIcon}>🗑️</span>
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {isMenuOpen && isMobile && (
          <>
            <div
              className={styles.actionSheetBackdrop}
              onClick={() => setMenuOpenId(null)}
            />
            <div className={styles.actionSheet}>
              <div className={styles.actionSheetGroup}>
                <div className={styles.actionSheetTitle}>{collection.name}</div>
                <button
                  type="button"
                  className={styles.actionSheetItem}
                  onClick={() => handleStartRename(collection)}
                >
                  Rename
                </button>
                {onShareCollection && (
                  <button
                    type="button"
                    className={styles.actionSheetItem}
                    onClick={() => handleShareCollection(collection)}
                  >
                    Share
                  </button>
                )}
                {!collection.isDefault && (
                  <button
                    type="button"
                    className={`${styles.actionSheetItem} ${styles.actionSheetDanger}`}
                    onClick={() => handleDeleteCollection(collection)}
                  >
                    Delete
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
      </div>
    );
  };

  const renderSharedCollectionItem = (sc) => {
    const isMenuOpen = menuOpenId === `shared-col-${sc.collectionId}`;
    const isActive = activeCollectionId === sc.collectionId;
    const count = sc.recipeCount ?? 0;

    return (
      <div
        key={sc.collectionId}
        className={`${styles.listItem} ${isActive ? styles.listItemActive : ''}`}
      >
        <button
          className={styles.listBtn}
          onClick={() => handleCollectionClick(sc.collectionId)}
        >
          <span className={styles.collectionEmoji}>{sc.collection?.emoji ?? '📁'}</span>
          <span className={styles.listText}>
            <span className={styles.listName}>
              {sc.collection?.name ?? 'Shared Collection'}
              <span className={styles.sharedBadge}>Shared</span>
            </span>
          </span>
          <span className={styles.collectionCount}>({count})</span>
          <span className={styles.chevron}>›</span>
        </button>

        <div className={styles.menuWrap} ref={isMenuOpen && !isMobile ? menuRef : null}>
          <button
            type="button"
            className={styles.menuBtn}
            onClick={() => setMenuOpenId(isMenuOpen ? null : `shared-col-${sc.collectionId}`)}
            aria-label={`Options for ${sc.collection?.name ?? 'Shared Collection'}`}
          >
            &#x22EE;
          </button>

          {isMenuOpen && !isMobile && (
            <div className={styles.menuDropdown}>
              <button
                type="button"
                className={`${styles.menuItem} ${styles.menuDanger}`}
                onClick={() => handleLeaveCollection(sc)}
              >
                <span className={styles.menuIcon}>🚪</span>
                Leave
              </button>
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
                <div className={styles.actionSheetTitle}>{sc.collection?.name ?? 'Shared Collection'}</div>
                <button
                  type="button"
                  className={`${styles.actionSheetItem} ${styles.actionSheetDanger}`}
                  onClick={() => handleLeaveCollection(sc)}
                >
                  Leave
                </button>
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
      </div>
    );
  };

  const renderCollectionEmptyState = () => (
    <p className={styles.emptyMsg}>
      No collections found. Tap + to create one.
    </p>
  );

  const renderSearchBar = (placeholder) => (
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
        placeholder={placeholder}
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
  );

  // -------------------------------------------------------------------------
  // Collection Mode Layouts
  // -------------------------------------------------------------------------

  const renderCollectionMobileLayout = () => (
    <div className={styles.mobileLayout}>
      <div className={styles.mobileHeader}>
        <div className={styles.header}>
          <h2 className={styles.title}>Collections</h2>
          <button
            className={styles.newBtn}
            onClick={() => setShowNewCollectionForm(true)}
          >
            + New
          </button>
        </div>
        {renderSearchBar('Search collections...')}
      </div>

      <div className={styles.scrollArea}>
        {renderNewCollectionForm()}

        {filteredCollections.length === 0 && filteredSharedCollections.length === 0 && !showNewCollectionForm && (
          renderCollectionEmptyState()
        )}

        {filteredCollections.length > 0 && (
          <>
            <div className={styles.sectionHeader} style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
              <h3 className={styles.sectionTitle}>My Collections</h3>
            </div>
            <div className={styles.lists}>
              {filteredCollections.map(renderCollectionItem)}
            </div>
          </>
        )}

        {filteredSharedCollections.length > 0 && (
          <>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Shared with me</h3>
            </div>
            <div className={styles.lists}>
              {filteredSharedCollections.map(renderSharedCollectionItem)}
            </div>
          </>
        )}

        {renderTemplatesSection()}
      </div>

      {/* Delete collection confirmation */}
      {confirmingDeleteId && collections?.some((c) => c.id === confirmingDeleteId) && (
        <ConfirmDialog
          message={`Delete "${collections.find((c) => c.id === confirmingDeleteId)?.name}"? Recipes will be moved to your default collection.`}
          onConfirm={handleConfirmDeleteCollection}
          onCancel={() => setConfirmingDeleteId(null)}
        />
      )}

      {/* Leave shared collection confirmation */}
      {confirmingLeaveId && (
        <ConfirmDialog
          message={`Leave "${sharedCollections?.find((sc) => sc.collectionId === confirmingLeaveId)?.collection?.name}"? You will lose access to this collection.`}
          onConfirm={handleConfirmLeave}
          onCancel={() => setConfirmingLeaveId(null)}
        />
      )}
    </div>
  );

  const renderCollectionDesktopLayout = () => (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Collections</h2>
        <button
          className={styles.newBtn}
          onClick={() => setShowNewCollectionForm(true)}
        >
          + New
        </button>
      </div>

      {renderSearchBar('Search collections...')}
      {renderNewCollectionForm()}

      {filteredCollections.length === 0 && filteredSharedCollections.length === 0 && !showNewCollectionForm && (
        renderCollectionEmptyState()
      )}

      {filteredCollections.length > 0 && (
        <>
          <div className={styles.sectionHeader} style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
            <h3 className={styles.sectionTitle}>My Collections</h3>
          </div>
          <div className={styles.lists}>
            {filteredCollections.map(renderCollectionItem)}
          </div>
        </>
      )}

      {filteredSharedCollections.length > 0 && (
        <>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Shared with me</h3>
          </div>
          <div className={styles.lists}>
            {filteredSharedCollections.map(renderSharedCollectionItem)}
          </div>
        </>
      )}

      {renderTemplatesSection()}

      {/* Delete collection confirmation */}
      {confirmingDeleteId && collections?.some((c) => c.id === confirmingDeleteId) && (
        <ConfirmDialog
          message={`Delete "${collections.find((c) => c.id === confirmingDeleteId)?.name}"? Recipes will be moved to your default collection.`}
          onConfirm={handleConfirmDeleteCollection}
          onCancel={() => setConfirmingDeleteId(null)}
        />
      )}

      {/* Leave shared collection confirmation */}
      {confirmingLeaveId && (
        <ConfirmDialog
          message={`Leave "${sharedCollections?.find((sc) => sc.collectionId === confirmingLeaveId)?.collection?.name}"? You will lose access to this collection.`}
          onConfirm={handleConfirmLeave}
          onCancel={() => setConfirmingLeaveId(null)}
        />
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Legacy Recipe Layouts (Backwards compatibility)
  // -------------------------------------------------------------------------

  const renderLegacyMobileLayout = () => (
    <div className={styles.mobileLayout}>
      <div className={styles.mobileHeader}>
        <div className={styles.header}>
          <h2 className={styles.title}>My Recipes</h2>
          <button className={styles.newBtn} onClick={onCreate}>
            + New
          </button>
        </div>

        {renderSearchBar('Search recipes...')}
      </div>

      <div className={styles.scrollArea}>
        <div className={styles.lists}>
          {filteredRecipes.length === 0 && filteredSharedRecipes.length === 0 && (
            <p className={styles.emptyMsg}>No recipes yet. Tap + to create one.</p>
          )}
          {filteredRecipes.map(renderRecipeItem)}
        </div>

        {filteredSharedRecipes.length > 0 && (
          <>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Shared with me</h3>
            </div>
            <div className={styles.lists}>
              {filteredSharedRecipes.map(renderSharedRecipeItem)}
            </div>
          </>
        )}

        {renderTemplatesSection()}
      </div>
    </div>
  );

  const renderLegacyDesktopLayout = () => (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>My Recipes</h2>
        <button className={styles.newBtn} onClick={onCreate}>
          + New
        </button>
      </div>

      {renderSearchBar('Search recipes...')}

      <div className={styles.lists}>
        {filteredRecipes.length === 0 && filteredSharedRecipes.length === 0 && (
          <p className={styles.emptyMsg}>No recipes yet. Tap + to create one.</p>
        )}
        {filteredRecipes.map(renderRecipeItem)}
      </div>

      {filteredSharedRecipes.length > 0 && (
        <>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Shared with me</h3>
          </div>
          <div className={styles.lists}>
            {filteredSharedRecipes.map(renderSharedRecipeItem)}
          </div>
        </>
      )}

      {renderTemplatesSection()}
    </div>
  );

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------

  // Legacy mode: collections prop not provided
  if (!isCollectionMode) {
    return isMobile ? renderLegacyMobileLayout() : renderLegacyDesktopLayout();
  }

  // Collection mode: show collection list
  return isMobile ? renderCollectionMobileLayout() : renderCollectionDesktopLayout();
};

RecipeSelector.propTypes = {
  // Collection data (new)
  collections: PropTypes.array,
  sharedCollections: PropTypes.array,
  activeCollectionId: PropTypes.string,
  allRecipes: PropTypes.array,
  onSelectCollection: PropTypes.func,
  onCreateCollection: PropTypes.func,
  onUpdateCollection: PropTypes.func,
  onDeleteCollection: PropTypes.func,
  onShareCollection: PropTypes.func,
  onLeaveCollection: PropTypes.func,
  // Recipe data (existing — keep for US-007)
  recipes: PropTypes.array.isRequired,
  sharedRecipes: PropTypes.array,
  onSelect: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onShareClick: PropTypes.func,
  onSaveTemplate: PropTypes.func,
  onAddTemplateToList: PropTypes.func,
};
