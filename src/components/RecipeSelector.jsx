import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { RECIPE_TEMPLATES } from '../services/recipes.js';
import styles from './RecipeSelector.module.css';

/**
 * Recipe list screen for browsing and managing recipes.
 * Shows owned recipes and shared recipe refs with search, three-dot menu,
 * and iOS-style action sheets on mobile.
 */
export const RecipeSelector = ({
  recipes,
  sharedRecipes,
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
  const menuRef = useRef(null);
  const isMobile = useIsMobile();

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
  const filteredRecipes = query
    ? recipes.filter((r) => (r.name ?? '').toLowerCase().includes(query))
    : recipes;

  const filteredSharedRecipes = query
    ? sharedRecipes.filter((r) => (r.recipeName ?? '').toLowerCase().includes(query))
    : sharedRecipes;

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

  const renderMobileLayout = () => (
    <div className={styles.mobileLayout}>
      <div className={styles.mobileHeader}>
        <div className={styles.header}>
          <h2 className={styles.title}>My Recipes</h2>
          <button className={styles.newBtn} onClick={onCreate}>
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
            placeholder="Search recipes..."
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

  const renderDesktopLayout = () => (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>My Recipes</h2>
        <button className={styles.newBtn} onClick={onCreate}>
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
          placeholder="Search recipes..."
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

  return isMobile ? renderMobileLayout() : renderDesktopLayout();
};

RecipeSelector.propTypes = {
  recipes: PropTypes.array.isRequired,
  sharedRecipes: PropTypes.array.isRequired,
  onSelect: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onShareClick: PropTypes.func,
  onSaveTemplate: PropTypes.func,
  onAddTemplateToList: PropTypes.func,
};
