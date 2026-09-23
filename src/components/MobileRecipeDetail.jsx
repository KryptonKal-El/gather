import { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { CookMode } from './CookMode.jsx';
import {
  startCookSession,
  fetchActiveCookSession,
  fetchCookHistory,
  setCookStepCompleted,
  updateCookCurrentStep,
  completeCookSession,
  cancelCookSession,
} from '../services/cookSessionDatabase.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import styles from './MobileRecipeDetail.module.css';
import { RecipeAttributesSection } from './RecipeAttributesSection.jsx';

/**
 * Full-screen mobile recipe detail view.
 * Shows hero image, ingredients with checkboxes, numbered steps,
 * and action buttons for edit, delete, move to collection.
 */
export const MobileRecipeDetail = ({
  recipe,
  userId,
  isOwner,
  canEdit,
  collectionName,
  collections,
  activeCollectionId,
  onMoveRecipe,
  onBack,
  onEdit,
  onDelete,
  onAddToList,
}) => {
  // Collaborators on a write-shared collection can edit/delete without owning
  // the recipe; callers that don't pass canEdit keep the owner-only behavior.
  const allowEdit = canEdit ?? isOwner;
  const [checkedIngredients, setCheckedIngredients] = useState(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [activeCookSession, setActiveCookSession] = useState(null);
  const [activeCookSteps, setActiveCookSteps] = useState([]);
  const [cookHistory, setCookHistory] = useState([]);
  const [showCookMode, setShowCookMode] = useState(false);
  const [showCookHistoryPanel, setShowCookHistoryPanel] = useState(false);
  const [historyLoadedAt, setHistoryLoadedAt] = useState(null);
  const menuRef = useRef(null);
  const isMobile = useIsMobile();

  const loadCookState = useCallback(async () => {
    if (!userId) return;
    try {
      const [active, history] = await Promise.all([
        fetchActiveCookSession(recipe.id, userId),
        fetchCookHistory(recipe.id),
      ]);
      setActiveCookSession(active?.session ?? null);
      setActiveCookSteps(active?.steps ?? []);
      setCookHistory(history);
      setHistoryLoadedAt(Date.now());
    } catch (err) {
      console.error('Failed to load cook state:', err);
    }
  }, [recipe.id, userId]);

  useEffect(() => {
    // Defer so the effect body itself schedules no synchronous state updates.
    const timer = setTimeout(() => {
      loadCookState();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadCookState]);

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

  const handleToggleIngredient = (ingredientId) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) {
        next.delete(ingredientId);
      } else {
        next.add(ingredientId);
      }
      return next;
    });
  };

  const handleAddToListClick = () => {
    const selectedIngredients = recipe.ingredients
      .filter((ing) => checkedIngredients.has(ing.id))
      .map((ing) => ({ name: ing.name, quantity: ing.quantity }));
    onAddToList(selectedIngredients);
  };

  const sortedIngredients = [...(recipe.ingredients ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  const sortedSteps = [...(recipe.steps ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  const handleStartCooking = async () => {
    if (activeCookSession) {
      setShowCookMode(true);
      return;
    }
    try {
      const started = await startCookSession(recipe.id, userId, sortedSteps);
      setActiveCookSession(started.session);
      setActiveCookSteps(started.steps);
      setShowCookMode(true);
    } catch (err) {
      console.error('Failed to start cook:', err);
    }
  };

  const handleCookStepCompleted = (stepId, completed) => {
    setActiveCookSteps((prev) =>
      prev.map((step) =>
        step.id === stepId
          ? { ...step, completedAt: completed ? new Date().toISOString() : null }
          : step
      )
    );
    setCookStepCompleted(stepId, completed).catch((err) => {
      console.error('Failed to update cook step:', err);
    });
  };

  const handleCookCurrentStep = (index) => {
    setActiveCookSession((prev) =>
      prev ? { ...prev, currentStep: index } : prev
    );
    updateCookCurrentStep(activeCookSession.id, index).catch((err) => {
      console.error('Failed to save current step:', err);
    });
  };

  const handleFinishCook = async () => {
    try {
      await completeCookSession(activeCookSession.id);
      setActiveCookSession(null);
      setActiveCookSteps([]);
      setShowCookMode(false);
      await loadCookState();
    } catch (err) {
      console.error('Failed to finish cook:', err);
    }
  };

  const handleDiscardCook = async () => {
    try {
      await cancelCookSession(activeCookSession.id);
      setActiveCookSession(null);
      setActiveCookSteps([]);
      setShowCookMode(false);
    } catch (err) {
      console.error('Failed to discard cook:', err);
    }
  };

  const formatCookDuration = (session) => {
    const end = session.completedAt ?? session.startedAt;
    const minutes = Math.floor(
      (new Date(end) - new Date(session.startedAt)) / 60000
    );
    if (minutes < 1) return 'Under a minute';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
  };

  const formatLastCooked = (session) => {
    const days = Math.floor(
      ((historyLoadedAt ?? 0) - new Date(session.completedAt)) / 86400000
    );
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    return months === 1 ? 'a month ago' : `${months} months ago`;
  };

  const renderHeroImage = () => {
    if (recipe.imageUrl) {
      return (
        <img
          src={recipe.imageUrl}
          alt={recipe.name}
          className={styles.heroImage}
        />
      );
    }
    return (
      <div className={styles.heroPlaceholder}>
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
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

  const renderMenu = () => {
    if (!menuOpen) return null;

    if (isMobile) {
      return (
        <>
          <div
            className={styles.actionSheetBackdrop}
            onClick={() => setMenuOpen(false)}
          />
          <div className={styles.actionSheet}>
            <div className={styles.actionSheetGroup}>
              <div className={styles.actionSheetTitle}>{recipe.name}</div>
              {allowEdit && (
                <button
                  type="button"
                  className={styles.actionSheetItem}
                  onClick={() => {
                    onEdit(recipe.id);
                    setMenuOpen(false);
                  }}
                >
                  Edit
                </button>
              )}
              {!isOwner && (
                <button
                  type="button"
                  className={styles.actionSheetItem}
                  onClick={() => {
                    handleAddToListClick();
                    setMenuOpen(false);
                  }}
                >
                  Add to List
                </button>
              )}
              {isOwner && collections && collections.length > 1 && (
                <button
                  type="button"
                  className={styles.actionSheetItem}
                  onClick={() => {
                    setShowMovePicker(true);
                    setMenuOpen(false);
                  }}
                >
                  Move to Collection
                </button>
              )}
              {allowEdit && (
                <button
                  type="button"
                  className={`${styles.actionSheetItem} ${styles.actionSheetDanger}`}
                  onClick={() => {
                    setConfirmingDelete(true);
                    setMenuOpen(false);
                  }}
                >
                  Delete
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
      );
    }

    return (
      <div className={styles.menuDropdown} ref={menuRef}>
        {allowEdit && (
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onEdit(recipe.id);
              setMenuOpen(false);
            }}
          >
            <span className={styles.menuIcon}>✏️</span>
            Edit
          </button>
        )}
        {!isOwner && (
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              handleAddToListClick();
              setMenuOpen(false);
            }}
          >
            <span className={styles.menuIcon}>📝</span>
            Add to List
          </button>
        )}
        {isOwner && collections && collections.length > 1 && (
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setShowMovePicker(true);
              setMenuOpen(false);
            }}
          >
            <span className={styles.menuIcon}>📁</span>
            Move to Collection
          </button>
        )}
        {allowEdit && (
          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuDanger}`}
            onClick={() => {
              setConfirmingDelete(true);
              setMenuOpen(false);
            }}
          >
            <span className={styles.menuIcon}>🗑️</span>
            Delete
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <nav className={styles.navBar}>
        <button
          type="button"
          className={styles.backButton}
          onClick={onBack}
          aria-label="Back to recipes"
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

        <div className={styles.navTitleGroup}>
          <h1 className={styles.navTitle}>{recipe.name}</h1>
          {collectionName && (
            <span className={styles.navSubtitle}>in {collectionName}</span>
          )}
        </div>

        <div className={styles.navActions}>
          <div className={styles.menuWrap} ref={!isMobile && menuOpen ? menuRef : null}>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Recipe options"
            >
              &#x22EE;
            </button>
            {renderMenu()}
          </div>
        </div>
      </nav>

      <div className={styles.scrollContent}>
        {renderHeroImage()}

        {recipe.description && (
          <p className={styles.description}>{recipe.description}</p>
        )}

        {userId && (
          <button
            type="button"
            className={`${styles.cookButton} ${activeCookSession ? styles.cookButtonResume : ''}`}
            onClick={handleStartCooking}
          >
            {activeCookSession ? '↻ Continue Cooking' : '🍳 Start Cooking'}
          </button>
        )}

        {userId && (
          <RecipeAttributesSection
            recipeId={recipe.id}
            recipeName={recipe.name}
            canEdit={Boolean(allowEdit)}
            userId={userId}
          />
        )}

        <div className={styles.section}>
          <h2 className={styles.sectionHeader}>INGREDIENTS</h2>
          <div className={styles.ingredientsList}>
            {sortedIngredients.map((ingredient) => {
              const isChecked = checkedIngredients.has(ingredient.id);
              return (
                <label
                  key={ingredient.id}
                  className={`${styles.ingredientRow} ${isChecked ? styles.ingredientChecked : ''}`}
                >
                  <input
                    type="checkbox"
                    className={styles.ingredientCheckbox}
                    checked={isChecked}
                    onChange={() => handleToggleIngredient(ingredient.id)}
                  />
                  <span className={styles.ingredientContent}>
                    {ingredient.quantity && (
                      <span className={styles.ingredientQuantity}>
                        {ingredient.quantity}
                      </span>
                    )}
                    <span className={styles.ingredientName}>{ingredient.name}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <button
            type="button"
            className={styles.addToListBtn}
            disabled={checkedIngredients.size === 0}
            onClick={handleAddToListClick}
          >
            {checkedIngredients.size > 0
              ? `Add ${checkedIngredients.size} to List`
              : 'Select ingredients to add'}
          </button>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionHeader}>STEPS</h2>
          <div className={styles.stepsList}>
            {sortedSteps.map((step, index) => (
              <div key={step.id} className={styles.stepRow}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <span className={styles.stepInstruction}>{step.instruction}</span>
              </div>
            ))}
          </div>
        </div>

        {cookHistory.length > 0 && (
          <button
            type="button"
            className={styles.cookHistorySummary}
            onClick={() => setShowCookHistoryPanel(true)}
          >
            <span className={styles.cookHistoryCheck}>✓</span>
            <span className={styles.cookHistoryText}>
              <span className={styles.cookHistoryDate}>
                {cookHistory.length === 1
                  ? 'Cooked once'
                  : `Cooked ${cookHistory.length} times`}
              </span>
              <span className={styles.cookHistoryDuration}>
                Last cooked {formatLastCooked(cookHistory[0])}
              </span>
            </span>
            <span className={styles.cookHistoryChevron}>›</span>
          </button>
        )}
      </div>

      {showCookHistoryPanel && (
        <>
          <div
            className={styles.cookHistoryBackdrop}
            onClick={() => setShowCookHistoryPanel(false)}
          />
          <div className={styles.cookHistoryPanel}>
            <div className={styles.cookHistoryPanelHeader}>
              <h3 className={styles.cookHistoryPanelTitle}>Cook History</h3>
              <button
                type="button"
                className={styles.cookHistoryPanelClose}
                onClick={() => setShowCookHistoryPanel(false)}
                aria-label="Close cook history"
              >
                ✕
              </button>
            </div>
            <div className={styles.cookHistoryList}>
              {cookHistory.map((session) => (
                <div key={session.id} className={styles.cookHistoryRow}>
                  <span className={styles.cookHistoryCheck}>✓</span>
                  <span className={styles.cookHistoryText}>
                    <span className={styles.cookHistoryDate}>
                      {new Date(session.completedAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                    <span className={styles.cookHistoryDuration}>
                      {formatCookDuration(session)}
                    </span>
                  </span>
                  <span className={styles.cookHistoryRelative}>
                    {formatLastCooked(session)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {showMovePicker && (
        <>
          <div
            className={styles.movePickerBackdrop}
            onClick={() => setShowMovePicker(false)}
          />
          <div className={styles.movePickerModal}>
            <div className={styles.movePickerHeader}>
              <h3 className={styles.movePickerTitle}>Move to Collection</h3>
              <button
                type="button"
                className={styles.movePickerClose}
                onClick={() => setShowMovePicker(false)}
              >
                ✕
              </button>
            </div>
            <div className={styles.movePickerList}>
              {collections
                .filter((c) => c.id !== activeCollectionId)
                .map((collection) => (
                  <button
                    key={collection.id}
                    type="button"
                    className={styles.movePickerItem}
                    onClick={() => {
                      onMoveRecipe?.(recipe.id, collection.id);
                      setShowMovePicker(false);
                    }}
                  >
                    <span className={styles.movePickerEmoji}>{collection.emoji ?? '📁'}</span>
                    <span className={styles.movePickerName}>{collection.name}</span>
                  </button>
                ))}
            </div>
          </div>
        </>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          message={`Delete "${recipe.name}"?`}
          onConfirm={() => {
            onDelete(recipe.id);
            setConfirmingDelete(false);
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {showCookMode && activeCookSession && (
        <CookMode
          recipe={recipe}
          session={activeCookSession}
          steps={activeCookSteps}
          onSetStepCompleted={handleCookStepCompleted}
          onSetCurrentStep={handleCookCurrentStep}
          onFinish={handleFinishCook}
          onDiscard={handleDiscardCook}
          onClose={() => {
            setShowCookMode(false);
            loadCookState();
          }}
        />
      )}
    </div>
  );
};

MobileRecipeDetail.propTypes = {
  recipe: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    imageUrl: PropTypes.string,
    ownerId: PropTypes.string,
    ingredientCount: PropTypes.number,
    stepCount: PropTypes.number,
    createdAt: PropTypes.string,
    updatedAt: PropTypes.string,
    ingredients: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        quantity: PropTypes.string,
        sortOrder: PropTypes.number.isRequired,
      })
    ),
    steps: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        instruction: PropTypes.string.isRequired,
        sortOrder: PropTypes.number.isRequired,
      })
    ),
  }).isRequired,
  userId: PropTypes.string,
  isOwner: PropTypes.bool.isRequired,
  canEdit: PropTypes.bool,
  collectionName: PropTypes.string,
  collections: PropTypes.array,
  activeCollectionId: PropTypes.string,
  onMoveRecipe: PropTypes.func,
  onBack: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onAddToList: PropTypes.func.isRequired,
};
