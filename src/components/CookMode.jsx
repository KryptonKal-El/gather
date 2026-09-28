import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { ingredientsForStep } from '../utils/stepIngredients.js';
import styles from './CookMode.module.css';

/**
 * Full-screen guided cooking mode: an ingredient checklist first, then one
 * step per screen in large text with next/back controls and a progress bar.
 * Each step lists the ingredients it mentions, and an Ingredients panel shows
 * the full list at any time. Closing keeps the session in progress so it can
 * be resumed later.
 */
export const CookMode = ({
  recipe,
  session,
  steps,
  onSetStepCompleted,
  onSetCurrentStep,
  onFinish,
  onDiscard,
  onClose,
}) => {
  const ingredients = [...(recipe.ingredients ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  const hasProgress =
    (session.currentStep ?? 0) > 0 || steps.some((s) => s.completedAt);

  const [phase, setPhase] = useState(
    !hasProgress && ingredients.length > 0 ? 'ingredients' : 'steps'
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(
    Math.min(session.currentStep ?? 0, Math.max(steps.length - 1, 0))
  );
  const [gathered, setGathered] = useState(new Set());
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [durationLabel, setDurationLabel] = useState('under a minute');
  const [showIngredientsPanel, setShowIngredientsPanel] = useState(false);

  useEffect(() => {
    if (!showIngredientsPanel) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowIngredientsPanel(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showIngredientsPanel]);

  const completedCount = steps.filter((s) => s.completedAt).length;

  const handleToggleGathered = (ingredientId) => {
    setGathered((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) {
        next.delete(ingredientId);
      } else {
        next.add(ingredientId);
      }
      return next;
    });
  };

  const handleGoToStep = (index) => {
    setCurrentStepIndex(index);
    onSetCurrentStep(index);
  };

  const formatDuration = (startedAt) => {
    const minutes = Math.floor((Date.now() - new Date(startedAt)) / 60000);
    if (minutes < 1) return 'under a minute';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
  };

  const handleNext = () => {
    const step = steps[currentStepIndex];
    onSetStepCompleted(step.id, true);
    if (currentStepIndex < steps.length - 1) {
      handleGoToStep(currentStepIndex + 1);
    } else {
      setDurationLabel(formatDuration(session.startedAt));
      setPhase('finish');
    }
  };

  const renderIngredientChecklist = () => (
    <div className={styles.ingredientList}>
      {ingredients.map((ingredient) => {
        const isGathered = gathered.has(ingredient.id);
        return (
          <label
            key={ingredient.id}
            className={`${styles.ingredientRow} ${isGathered ? styles.ingredientGathered : ''}`}
          >
            <input
              type="checkbox"
              className={styles.ingredientCheckbox}
              checked={isGathered}
              onChange={() => handleToggleGathered(ingredient.id)}
            />
            <span className={styles.ingredientText}>
              <span className={styles.ingredientName}>{ingredient.name}</span>
              {ingredient.quantity && (
                <span className={styles.ingredientQuantity}>{ingredient.quantity}</span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );

  const renderIngredientPhase = () => (
    <>
      <div className={styles.scrollArea}>
        <h2 className={styles.phaseTitle}>Gather your ingredients</h2>
        {renderIngredientChecklist()}
      </div>
      <div className={styles.bottomBar}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => setPhase('steps')}
        >
          {gathered.size === ingredients.length
            ? 'Begin Cooking'
            : `Begin Cooking (${gathered.size}/${ingredients.length} gathered)`}
        </button>
      </div>
    </>
  );

  const renderStepPhase = () => {
    const step = steps[Math.min(currentStepIndex, steps.length - 1)];
    const stepIngredients = ingredientsForStep(step.instruction, ingredients);
    return (
      <>
        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
          <span className={styles.progressLabel}>
            Step {currentStepIndex + 1} of {steps.length}
          </span>
        </div>
        <div className={styles.scrollArea}>
          {step.completedAt && <span className={styles.stepDoneBadge}>✓ Done</span>}
          <p className={styles.stepInstruction}>{step.instruction}</p>
          {stepIngredients.length > 0 && (
            <section className={styles.stepIngredients} aria-label="Ingredients for this step">
              <h3 className={styles.stepIngredientsTitle}>For this step</h3>
              <ul className={styles.stepIngredientsList}>
                {stepIngredients.map((ingredient) => (
                  <li key={ingredient.id} className={styles.stepIngredientRow}>
                    <span className={styles.stepIngredientName}>{ingredient.name}</span>
                    {ingredient.quantity && (
                      <span className={styles.stepIngredientQuantity}>{ingredient.quantity}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className={styles.bottomBar}>
          {currentStepIndex > 0 && (
            <button
              type="button"
              className={styles.backStepButton}
              onClick={() => handleGoToStep(currentStepIndex - 1)}
              aria-label="Previous step"
            >
              ‹
            </button>
          )}
          {ingredients.length > 0 && (
            <button
              type="button"
              className={styles.backStepButton}
              onClick={() => setShowIngredientsPanel(true)}
            >
              Ingredients
            </button>
          )}
          <button type="button" className={styles.primaryButton} onClick={handleNext}>
            {currentStepIndex < steps.length - 1 ? 'Next Step' : 'All Steps Done'}
          </button>
        </div>
      </>
    );
  };

  const renderFinishPhase = () => (
    <>
      <div className={styles.finishArea}>
        <span className={styles.finishBadge}>✓</span>
        <h2 className={styles.finishTitle}>Nice cooking!</h2>
        <p className={styles.finishSubtitle}>Cooked in {durationLabel}</p>
      </div>
      <div className={styles.bottomBar}>
        {steps.length > 0 && (
          <button
            type="button"
            className={styles.backStepButton}
            onClick={() => setPhase('steps')}
          >
            Back
          </button>
        )}
        <button type="button" className={styles.primaryButton} onClick={onFinish}>
          Finish Cooking
        </button>
      </div>
    </>
  );

  return (
    <div className={styles.overlay}>
      <nav className={styles.navBar}>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close cooking mode"
        >
          ✕
        </button>
        <h1 className={styles.navTitle}>{recipe.name}</h1>
        <button
          type="button"
          className={styles.discardButton}
          onClick={() => setConfirmingDiscard(true)}
        >
          Discard
        </button>
      </nav>

      {phase === 'ingredients' && renderIngredientPhase()}
      {phase === 'steps' && steps.length > 0 && renderStepPhase()}
      {(phase === 'finish' || (phase === 'steps' && steps.length === 0)) &&
        renderFinishPhase()}

      {showIngredientsPanel && (
        <>
          <div className={styles.panelBackdrop} onClick={() => setShowIngredientsPanel(false)} />
          <div className={styles.ingredientsPanel} role="dialog" aria-label="Ingredients">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Ingredients</h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setShowIngredientsPanel(false)}
                aria-label="Close ingredients"
              >
                ✕
              </button>
            </div>
            <div className={styles.panelBody}>{renderIngredientChecklist()}</div>
          </div>
        </>
      )}

      {confirmingDiscard && (
        <ConfirmDialog
          message="Discard this cook? It won't be recorded in the recipe's history."
          onConfirm={() => {
            setConfirmingDiscard(false);
            onDiscard();
          }}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </div>
  );
};

CookMode.propTypes = {
  recipe: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    ingredients: PropTypes.array,
  }).isRequired,
  session: PropTypes.shape({
    id: PropTypes.string.isRequired,
    startedAt: PropTypes.string.isRequired,
    currentStep: PropTypes.number,
  }).isRequired,
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      instruction: PropTypes.string.isRequired,
      sortOrder: PropTypes.number.isRequired,
      completedAt: PropTypes.string,
    })
  ).isRequired,
  onSetStepCompleted: PropTypes.func.isRequired,
  onSetCurrentStep: PropTypes.func.isRequired,
  onFinish: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
