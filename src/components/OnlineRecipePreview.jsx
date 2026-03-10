import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getRecipeDetail } from '../services/recipeSearch.js';
import styles from './OnlineRecipePreview.module.css';

/**
 * Full recipe preview for online recipes.
 * Fetches detailed recipe data from the edge function and displays
 * hero image, ingredients, instructions, and action buttons.
 */
export const OnlineRecipePreview = ({ recipe, onSaveAsRecipe, onAddToList, onBack }) => {
  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchDetail = async () => {
      setIsLoading(true);
      setError(false);

      const data = await getRecipeDetail(recipe.id);

      if (cancelled) return;

      if (!data) {
        setError(true);
      } else {
        setDetail(data);
      }
      setIsLoading(false);
    };

    fetchDetail();

    return () => {
      cancelled = true;
    };
  }, [recipe.id]);

  const handleSaveAsRecipe = () => {
    if (detail) {
      onSaveAsRecipe(detail);
    }
  };

  const handleAddToList = () => {
    if (detail?.extendedIngredients) {
      const ingredients = detail.extendedIngredients.map((i) => ({
        name: i.name,
        quantity: i.original,
      }));
      onAddToList(ingredients);
    }
  };

  const renderLoading = () => (
    <div className={styles.loadingState}>
      <div className={styles.spinner} />
      <p className={styles.loadingText}>Loading recipe...</p>
    </div>
  );

  const renderError = () => (
    <div className={styles.errorState}>
      <span className={styles.errorIcon}>⚠️</span>
      <p className={styles.errorTitle}>Failed to load recipe</p>
      <p className={styles.errorSubtitle}>Please try again later</p>
    </div>
  );

  const instructions = detail?.analyzedInstructions?.[0]?.steps ?? [];

  const renderContent = () => (
    <div className={styles.scrollContent}>
      {detail.image && (
        <div className={styles.heroWrap}>
          <img src={detail.image} alt="" className={styles.heroImage} />
        </div>
      )}

      <div className={styles.body}>
        <h2 className={styles.title}>{detail.title}</h2>

        <div className={styles.metaRow}>
          {detail.readyInMinutes && (
            <span className={styles.metaItem}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {detail.readyInMinutes} min
            </span>
          )}
          {detail.servings && (
            <span className={styles.metaItem}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {detail.servings} servings
            </span>
          )}
        </div>

        {detail.sourceUrl && (
          <a
            href={detail.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.sourceLink}
          >
            View original →
          </a>
        )}

        {detail.extendedIngredients?.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Ingredients</h3>
            <ul className={styles.ingredientList}>
              {detail.extendedIngredients.map((ing, idx) => (
                <li key={ing.id ?? idx} className={styles.ingredientItem}>
                  <span className={styles.ingredientCheck}>✓</span>
                  <span>{ing.original}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {instructions.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Instructions</h3>
            <ol className={styles.stepList}>
              {instructions.map((step) => (
                <li key={step.number} className={styles.stepItem}>
                  <span className={styles.stepNumber}>{step.number}</span>
                  <p className={styles.stepText}>{step.step}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={onBack}
          aria-label="Back"
        >
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
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className={styles.headerTitle}>Recipe Preview</h1>
      </div>

      {isLoading && renderLoading()}
      {!isLoading && error && renderError()}
      {!isLoading && !error && detail && renderContent()}

      {!isLoading && !error && detail && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleSaveAsRecipe}
          >
            Save as Recipe
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={handleAddToList}
          >
            Add to List
          </button>
        </div>
      )}
    </div>
  );
};

OnlineRecipePreview.propTypes = {
  recipe: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string,
    image: PropTypes.string,
    readyInMinutes: PropTypes.number,
    servings: PropTypes.number,
  }).isRequired,
  onSaveAsRecipe: PropTypes.func.isRequired,
  onAddToList: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};
