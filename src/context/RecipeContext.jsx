/**
 * Recipe state management backed by Supabase.
 * Real-time listeners push data into state. Actions call Supabase directly.
 * Supports both owned recipes and recipes shared by other users.
 */
import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';
import {
  subscribeRecipes,
  subscribeRecipeDetail,
  subscribeSharedRecipeRefs,
  createRecipe as dbCreateRecipe,
  updateRecipe as dbUpdateRecipe,
  deleteRecipe as dbDeleteRecipe,
  updateRecipeIngredients as dbUpdateRecipeIngredients,
  updateRecipeSteps as dbUpdateRecipeSteps,
  uploadRecipeImage as dbUploadRecipeImage,
  shareRecipe as dbShareRecipe,
  unshareRecipe as dbUnshareRecipe,
  getRecipeShares as dbGetRecipeShares,
} from '../services/recipeDatabase.js';

export const RecipeContext = createContext(null);

/**
 * Provides recipe state and actions to the component tree.
 * Subscribes to Supabase Realtime listeners scoped to the current user,
 * plus shared recipe references from other users.
 */
export const RecipeProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

  const [recipes, setRecipes] = useState([]);
  const [sharedRecipes, setSharedRecipes] = useState([]);
  const [activeRecipeId, setActiveRecipeId] = useState(null);
  const [activeRecipe, setActiveRecipe] = useState(null);

  const activeRecipeUnsubRef = useRef(null);

  // Subscribe to owned recipes
  useEffect(() => {
    if (!userId) {
      setRecipes([]);
      setActiveRecipeId(null);
      setActiveRecipe(null);
      return;
    }
    return subscribeRecipes(userId, setRecipes);
  }, [userId]);

  // Subscribe to shared recipe refs (recipes others shared with me)
  useEffect(() => {
    if (!userEmail) {
      setSharedRecipes([]);
      return;
    }
    return subscribeSharedRecipeRefs(userEmail, setSharedRecipes);
  }, [userEmail]);

  // Subscribe to recipe detail when activeRecipeId changes
  useEffect(() => {
    if (activeRecipeUnsubRef.current) {
      activeRecipeUnsubRef.current();
      activeRecipeUnsubRef.current = null;
    }

    if (!activeRecipeId) {
      setActiveRecipe(null);
      return;
    }

    activeRecipeUnsubRef.current = subscribeRecipeDetail(activeRecipeId, setActiveRecipe);

    return () => {
      if (activeRecipeUnsubRef.current) {
        activeRecipeUnsubRef.current();
        activeRecipeUnsubRef.current = null;
      }
    };
  }, [activeRecipeId]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const createRecipeAction = useCallback(async (recipe) => {
    if (!userId) return null;
    const newId = await dbCreateRecipe(userId, recipe);
    return newId;
  }, [userId]);

  const updateRecipeAction = useCallback(async (recipeId, updates) => {
    if (!userId) return;
    await dbUpdateRecipe(userId, recipeId, updates);
  }, [userId]);

  const deleteRecipeAction = useCallback(async (recipeId) => {
    if (!userId) return;
    await dbDeleteRecipe(userId, recipeId);
    if (activeRecipeId === recipeId) {
      setActiveRecipeId(null);
    }
  }, [userId, activeRecipeId]);

  const updateIngredientsAction = useCallback(async (recipeId, ingredients) => {
    await dbUpdateRecipeIngredients(recipeId, ingredients);
  }, []);

  const updateStepsAction = useCallback(async (recipeId, steps) => {
    await dbUpdateRecipeSteps(recipeId, steps);
  }, []);

  const uploadImageAction = useCallback(async (recipeId, file) => {
    if (!userId) return null;
    const publicUrl = await dbUploadRecipeImage(userId, recipeId, file);
    return publicUrl;
  }, [userId]);

  const shareRecipeAction = useCallback(async (recipeId, email) => {
    await dbShareRecipe(recipeId, email);
  }, []);

  const unshareRecipeAction = useCallback(async (recipeId, email) => {
    await dbUnshareRecipe(recipeId, email);
  }, []);

  const selectRecipeAction = useCallback((id) => {
    setActiveRecipeId(id);
  }, []);

  const getSharesAction = useCallback(async (recipeId) => {
    const shares = await dbGetRecipeShares(recipeId);
    return shares;
  }, []);

  // -----------------------------------------------------------------------
  // Build the context value
  // -----------------------------------------------------------------------

  const state = {
    recipes,
    sharedRecipes,
    activeRecipeId,
    activeRecipe,
  };

  const actions = {
    createRecipe: createRecipeAction,
    updateRecipe: updateRecipeAction,
    deleteRecipe: deleteRecipeAction,
    updateIngredients: updateIngredientsAction,
    updateSteps: updateStepsAction,
    uploadImage: uploadImageAction,
    shareRecipe: shareRecipeAction,
    unshareRecipe: unshareRecipeAction,
    selectRecipe: selectRecipeAction,
    getShares: getSharesAction,
  };

  return (
    <RecipeContext.Provider value={{ state, actions }}>
      {children}
    </RecipeContext.Provider>
  );
};
