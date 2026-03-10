import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { searchRecipes } from '../services/recipeSearch.js';
import styles from './OnlineRecipeSearch.module.css';

/**
 * Full search UI component for online recipe search.
 * Allows searching recipes via Spoonacular API with debounced input,
 * list/grid view toggle, and loading/error/empty states.
 */
export const OnlineRecipeSearch = ({ onSelectRecipe, onBack }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      return;
    }

    setIsLoading(true);
    setError(false);

    const { results: searchResults, source } = await searchRecipes(searchQuery.trim(), 12);

    setIsLoading(false);
    setHasSearched(true);

    if (source === 'error') {
      setError(true);
      setResults([]);
    } else {
      setResults(searchResults);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setError(false);
    inputRef.current?.focus();
  }, []);

  const handleInputChange = useCallback((e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    if (!newQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      setError(false);
    }
  }, []);

  const handleSelect = useCallback((recipe) => {
    onSelectRecipe(recipe);
  }, [onSelectRecipe]);

  const renderInitialState = () => (
    <div className={styles.stateMessage}>
      <span className={styles.stateIcon}>🔍</span>
      <p className={styles.stateTitle}>Search for recipes to get started</p>
      <p className={styles.stateSubtitle}>Find inspiration from thousands of recipes online</p>
    </div>
  );

  const renderEmptyState = () => (
    <div className={styles.stateMessage}>
      <span className={styles.stateIcon}>🍽️</span>
      <p className={styles.stateTitle}>No recipes found for &quot;{query}&quot;</p>
      <p className={styles.stateSubtitle}>Try a different search term</p>
    </div>
  );

  const renderErrorState = () => (
    <div className={styles.stateMessage}>
      <span className={styles.stateIcon}>⚠️</span>
      <p className={styles.stateTitle}>Search unavailable</p>
      <p className={styles.stateSubtitle}>Try again later</p>
    </div>
  );

  const renderSkeletonList = () => (
    <div className={styles.skeletonList}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={styles.skeletonRow}>
          <div className={`${styles.skeletonThumbnail} ${styles.shimmer}`} />
          <div className={styles.skeletonContent}>
            <div className={`${styles.skeletonLine} ${styles.skeletonLineLong} ${styles.shimmer}`} />
            <div className={`${styles.skeletonLine} ${styles.skeletonLineShort} ${styles.shimmer}`} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderSkeletonGrid = () => (
    <div className={styles.skeletonGrid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`${styles.skeletonCard} ${styles.shimmer}`} />
      ))}
    </div>
  );

  const renderListView = () => (
    <div className={styles.listView}>
      {results.map((recipe) => (
        <button
          key={recipe.id}
          type="button"
          className={styles.listRow}
          onClick={() => handleSelect(recipe)}
        >
          {recipe.image ? (
            <img
              src={recipe.image}
              alt=""
              className={styles.listThumbnail}
            />
          ) : (
            <div className={styles.listThumbnailPlaceholder}>
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
          )}
          <div className={styles.listContent}>
            <span className={styles.listTitle}>{recipe.title}</span>
            {(recipe.readyInMinutes || recipe.servings) && (
              <span className={styles.listMeta}>
                {recipe.readyInMinutes && `${recipe.readyInMinutes} min`}
                {recipe.readyInMinutes && recipe.servings && ' · '}
                {recipe.servings && `${recipe.servings} servings`}
              </span>
            )}
          </div>
          <span className={styles.listChevron}>›</span>
        </button>
      ))}
    </div>
  );

  const renderGridView = () => (
    <div className={styles.gridView}>
      {results.map((recipe) => (
        <button
          key={recipe.id}
          type="button"
          className={styles.gridCard}
          onClick={() => handleSelect(recipe)}
        >
          <div className={styles.gridImageWrap}>
            {recipe.image ? (
              <img
                src={recipe.image}
                alt=""
                className={styles.gridImage}
              />
            ) : (
              <div className={styles.gridImagePlaceholder}>
                <svg
                  width="32"
                  height="32"
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
            )}
          </div>
          <div className={styles.gridOverlay}>
            <p className={styles.gridTitle}>{recipe.title}</p>
          </div>
        </button>
      ))}
    </div>
  );

  const renderResults = () => {
    if (isLoading) {
      return viewMode === 'list' ? renderSkeletonList() : renderSkeletonGrid();
    }

    if (error) {
      return renderErrorState();
    }

    if (!hasSearched) {
      return renderInitialState();
    }

    if (results.length === 0) {
      return renderEmptyState();
    }

    return viewMode === 'list' ? renderListView() : renderGridView();
  };

  const showViewToggle = hasSearched && results.length > 0 && !isLoading && !error;

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
        <h1 className={styles.headerTitle}>Search Online</h1>
      </div>

      <div className={styles.searchSection}>
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
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Search recipes..."
            value={query}
            onChange={handleInputChange}
          />
          {query && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={handleClear}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {showViewToggle && (
        <div className={styles.viewToggle}>
          <button
            type="button"
            className={`${styles.viewTab} ${viewMode === 'list' ? styles.viewTabActive : ''}`}
            onClick={() => setViewMode('list')}
          >
            List
          </button>
          <button
            type="button"
            className={`${styles.viewTab} ${viewMode === 'grid' ? styles.viewTabActive : ''}`}
            onClick={() => setViewMode('grid')}
          >
            Grid
          </button>
        </div>
      )}

      <div className={styles.resultsArea}>
        {renderResults()}
      </div>
    </div>
  );
};

OnlineRecipeSearch.propTypes = {
  onSelectRecipe: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};
