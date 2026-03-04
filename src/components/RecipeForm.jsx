import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import styles from './RecipeForm.module.css';
import { parseRecipeText } from '../services/recipes.js';

/**
 * Full-screen form view for creating or editing a recipe.
 * Handles recipe name, image, ingredients list, and steps list.
 */
export const RecipeForm = ({
  recipe,
  onSave,
  onBack,
}) => {
  const isEditMode = Boolean(recipe);

  const [name, setName] = useState(recipe?.name ?? '');
  const [imageUrl, setImageUrl] = useState(recipe?.imageUrl ?? '');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(recipe?.imageUrl ?? '');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');

  const [ingredients, setIngredients] = useState(() => {
    if (recipe?.ingredients?.length) {
      return recipe.ingredients.map((ing) => ({
        id: ing.id ?? crypto.randomUUID(),
        quantity: ing.quantity ?? '',
        name: ing.name ?? '',
      }));
    }
    return [{ id: crypto.randomUUID(), quantity: '', name: '' }];
  });

  const [steps, setSteps] = useState(() => {
    if (recipe?.steps?.length) {
      return recipe.steps.map((step) => ({
        id: step.id ?? crypto.randomUUID(),
        instruction: step.instruction ?? '',
      }));
    }
    return [{ id: crypto.randomUUID(), instruction: '' }];
  });

  const [nameError, setNameError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [showImportOverlay, setShowImportOverlay] = useState(false);
  const [importText, setImportText] = useState('');

  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImageUrl('');
    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);
    setShowUrlInput(false);
  };

  const handleUrlConfirm = () => {
    const trimmedUrl = urlInputValue.trim();
    if (trimmedUrl) {
      setImageUrl(trimmedUrl);
      setImageFile(null);
      setImagePreviewUrl(trimmedUrl);
    }
    setShowUrlInput(false);
    setUrlInputValue('');
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    setImageFile(null);
    setImagePreviewUrl('');
  };

  const handleAddIngredient = () => {
    setIngredients((prev) => [
      ...prev,
      { id: crypto.randomUUID(), quantity: '', name: '' },
    ]);
  };

  const handleUpdateIngredient = (id, field, value) => {
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, [field]: value } : ing))
    );
  };

  const handleRemoveIngredient = (id) => {
    setIngredients((prev) => prev.filter((ing) => ing.id !== id));
  };

  const handleAddStep = () => {
    setSteps((prev) => [
      ...prev,
      { id: crypto.randomUUID(), instruction: '' },
    ]);
  };

  const handleUpdateStep = (id, instruction) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, instruction } : step))
    );
  };

  const handleRemoveStep = (id) => {
    setSteps((prev) => prev.filter((step) => step.id !== id));
  };

  const handleImportIngredients = () => {
    const parsed = parseRecipeText(importText);
    if (parsed.length === 0) return;

    const imported = parsed.map((item) => ({
      id: crypto.randomUUID(),
      quantity: '',
      name: item.name,
    }));

    setIngredients((prev) => {
      const nonEmpty = prev.filter((ing) => ing.name.trim());
      return [...nonEmpty, ...imported];
    });

    setShowImportOverlay(false);
    setImportText('');
  };

  const handleSave = async () => {
    setNameError('');
    setSaveError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Recipe name is required');
      return;
    }

    const filledIngredients = ingredients.filter((ing) => ing.name.trim());
    if (filledIngredients.length === 0) {
      setSaveError('At least one ingredient with a name is required');
      return;
    }

    setIsSaving(true);
    try {
      const recipeData = {
        name: trimmedName,
        description: '',
        imageUrl: imageFile ? '' : imageUrl,
        imageFile: imageFile ?? null,
        ingredients: filledIngredients.map((ing, idx) => ({
          id: ing.id,
          quantity: ing.quantity.trim(),
          name: ing.name.trim(),
          sortOrder: idx,
        })),
        steps: steps
          .filter((step) => step.instruction.trim())
          .map((step, idx) => ({
            id: step.id,
            instruction: step.instruction.trim(),
            sortOrder: idx,
          })),
      };
      await onSave(recipeData);
    } catch (err) {
      console.error('Failed to save recipe:', err);
      setSaveError('Failed to save recipe. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <nav className={styles.navBar}>
        <button
          type="button"
          className={styles.backButton}
          onClick={onBack}
          aria-label="Back"
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
          {isEditMode ? 'Edit Recipe' : 'New Recipe'}
        </h1>
        <button
          type="button"
          className={styles.saveButton}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </nav>

      <div className={styles.scrollArea}>
        {/* Image Section */}
        <div className={styles.imageSection}>
          {imagePreviewUrl ? (
            <div className={styles.imagePreviewWrap}>
              <img
                src={imagePreviewUrl}
                alt="Recipe preview"
                className={styles.imagePreview}
              />
              <button
                type="button"
                className={styles.imageRemoveBtn}
                onClick={handleRemoveImage}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ) : (
            <div
              className={styles.imagePlaceholder}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span className={styles.imagePlaceholderText}>
                Tap to add photo
              </span>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className={styles.hiddenFileInput}
            onChange={handleFileSelect}
          />
          {!imagePreviewUrl && !showUrlInput && (
            <div className={styles.imageOptions}>
              <button
                type="button"
                className={styles.imageOptionBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload Photo
              </button>
              <button
                type="button"
                className={styles.imageOptionBtn}
                onClick={() => setShowUrlInput(true)}
              >
                Paste URL
              </button>
            </div>
          )}
          {showUrlInput && (
            <div className={styles.urlInputRow}>
              <input
                type="url"
                className={styles.urlInput}
                placeholder="https://example.com/image.jpg"
                value={urlInputValue}
                onChange={(e) => setUrlInputValue(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className={styles.urlConfirmBtn}
                onClick={handleUrlConfirm}
              >
                OK
              </button>
              <button
                type="button"
                className={styles.urlCancelBtn}
                onClick={() => {
                  setShowUrlInput(false);
                  setUrlInputValue('');
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Recipe Name */}
        <div className={styles.formGroup}>
          <input
            type="text"
            className={`${styles.nameInput} ${nameError ? styles.nameInputError : ''}`}
            placeholder="Recipe name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError('');
            }}
          />
          {nameError && <p className={styles.errorText}>{nameError}</p>}
        </div>

        {/* Ingredients Section */}
        <div className={styles.formGroup}>
          <h2 className={styles.sectionHeader}>Ingredients</h2>
          <div className={styles.listGroup}>
            {ingredients.length === 0 ? (
              <div className={styles.emptyListRow}>No ingredients added</div>
            ) : (
              ingredients.map((ing) => (
                <div key={ing.id} className={styles.listRow}>
                  <input
                    type="text"
                    className={styles.ingredientQty}
                    placeholder="Qty"
                    value={ing.quantity}
                    onChange={(e) =>
                      handleUpdateIngredient(ing.id, 'quantity', e.target.value)
                    }
                  />
                  <input
                    type="text"
                    className={styles.ingredientName}
                    placeholder="Ingredient name"
                    value={ing.name}
                    onChange={(e) =>
                      handleUpdateIngredient(ing.id, 'name', e.target.value)
                    }
                  />
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => handleRemoveIngredient(ing.id)}
                    aria-label="Remove ingredient"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
          <div className={styles.ingredientActions}>
            <button
              type="button"
              className={styles.addBtn}
              onClick={handleAddIngredient}
            >
              + Add ingredient
            </button>
            <button
              type="button"
              className={styles.importBtn}
              onClick={() => setShowImportOverlay(true)}
            >
              📋 Import from Text
            </button>
          </div>
        </div>

        {/* Steps Section */}
        <div className={styles.formGroup}>
          <h2 className={styles.sectionHeader}>Steps</h2>
          <div className={styles.listGroup}>
            {steps.length === 0 ? (
              <div className={styles.emptyListRow}>No steps added</div>
            ) : (
              steps.map((step, idx) => (
                <div key={step.id} className={styles.listRow}>
                  <span className={styles.stepNumber}>{idx + 1}.</span>
                  <textarea
                    className={styles.stepInstruction}
                    placeholder="Step instruction"
                    value={step.instruction}
                    onChange={(e) => handleUpdateStep(step.id, e.target.value)}
                    rows={1}
                  />
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => handleRemoveStep(step.id)}
                    aria-label="Remove step"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
          <button
            type="button"
            className={styles.addBtn}
            onClick={handleAddStep}
          >
            + Add step
          </button>
        </div>

        {saveError && <p className={styles.errorText}>{saveError}</p>}

        {showImportOverlay && (
          <div className={styles.importOverlay}>
            <div className={styles.importPanel}>
              <div className={styles.importHeader}>
                <h3 className={styles.importTitle}>Import Ingredients</h3>
                <button
                  type="button"
                  className={styles.importCloseBtn}
                  onClick={() => { setShowImportOverlay(false); setImportText(''); }}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <p className={styles.importHint}>
                Paste your ingredient list below (one per line):
              </p>
              <textarea
                className={styles.importTextarea}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={"2 cups flour\n1 lb ground beef\n3 cloves garlic\n1 can tomato sauce"}
                rows={8}
                autoFocus
              />
              <div className={styles.importActions}>
                <button
                  type="button"
                  className={styles.importCancelBtn}
                  onClick={() => { setShowImportOverlay(false); setImportText(''); }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.importConfirmBtn}
                  onClick={handleImportIngredients}
                  disabled={!importText.trim()}
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

RecipeForm.propTypes = {
  recipe: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};
