/**
 * Recipe and Collection state management backed by Supabase.
 * Real-time listeners push data into state. Actions call Supabase directly.
 * Supports owned collections, shared collections, and recipe filtering by active collection.
 */
import { createContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext.jsx';
import { supabase } from '../services/supabase.js';
import {
  subscribeRecipes,
  subscribeRecipeDetail,
  createRecipe as dbCreateRecipe,
  updateRecipe as dbUpdateRecipe,
  deleteRecipe as dbDeleteRecipe,
  updateRecipeIngredients as dbUpdateRecipeIngredients,
  updateRecipeSteps as dbUpdateRecipeSteps,
  uploadRecipeImage as dbUploadRecipeImage,
  subscribeCollections as dbSubscribeCollections,
  ensureDefaultCollection as dbEnsureDefaultCollection,
  createCollection as dbCreateCollection,
  updateCollection as dbUpdateCollection,
  deleteCollection as dbDeleteCollection,
  moveRecipeToCollection as dbMoveRecipeToCollection,
  shareCollection as dbShareCollection,
  unshareCollection as dbUnshareCollection,
  getCollectionShares as dbGetCollectionShares,
  subscribeSharedCollections as dbSubscribeSharedCollections,
} from '../services/recipeDatabase.js';

export const RecipeContext = createContext(null);

/**
 * Provides recipe and collection state and actions to the component tree.
 * Subscribes to Supabase Realtime listeners scoped to the current user,
 * plus shared collections from other users.
 */
export const RecipeProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

  const [collections, setCollections] = useState([]);
  const [sharedCollections, setSharedCollections] = useState([]);
  const [activeCollectionId, setActiveCollectionId] = useState(null);
  const [allRecipes, setAllRecipes] = useState([]);
  const [sharedCollectionRecipes, setSharedCollectionRecipes] = useState([]);
  const [activeRecipeId, setActiveRecipeId] = useState(null);
  const [activeRecipe, setActiveRecipe] = useState(null);

  const activeRecipeUnsubRef = useRef(null);

  // Determine if the active collection is a shared collection
  const isSharedCollection = useMemo(() => {
    if (!activeCollectionId) return false;
    const isOwned = collections.some((c) => c.id === activeCollectionId);
    const isShared = sharedCollections.some((sc) => sc.collectionId === activeCollectionId);
    return !isOwned && isShared;
  }, [activeCollectionId, collections, sharedCollections]);

  // Derive recipes based on active collection
  const recipes = useMemo(() => {
    if (!activeCollectionId) return [];
    if (isSharedCollection) return sharedCollectionRecipes;
    return allRecipes.filter((r) => r.collectionId === activeCollectionId);
  }, [activeCollectionId, isSharedCollection, sharedCollectionRecipes, allRecipes]);

  // Subscribe to owned collections
  useEffect(() => {
    if (!userId) {
      setCollections([]);
      setActiveCollectionId(null);
      return;
    }

    // Ensure a default collection exists
    dbEnsureDefaultCollection(userId).catch((err) => {
      console.error('Failed to ensure default collection:', err);
    });

    return dbSubscribeCollections(userId, (cols) => {
      setCollections(cols);
      setActiveCollectionId((prev) => {
        if (prev) return prev;
        const defaultCol = cols.find((c) => c.isDefault);
        return defaultCol?.id ?? cols[0]?.id ?? null;
      });
    });
  }, [userId]);

  // Subscribe to shared collections
  useEffect(() => {
    if (!userEmail) {
      setSharedCollections([]);
      return;
    }
    return dbSubscribeSharedCollections(userEmail, setSharedCollections);
  }, [userEmail]);

  // Subscribe to owned recipes
  useEffect(() => {
    if (!userId) {
      setAllRecipes([]);
      setActiveRecipeId(null);
      setActiveRecipe(null);
      return;
    }
    return subscribeRecipes(userId, setAllRecipes);
  }, [userId]);

  // Fetch recipes for shared collection when viewing one
  useEffect(() => {
    if (!isSharedCollection || !activeCollectionId) {
      setSharedCollectionRecipes([]);
      return;
    }

    const fetchRecipes = async () => {
      try {
        const { data, error } = await supabase
          .from('recipes')
          .select('*')
          .eq('collection_id', activeCollectionId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Failed to fetch shared collection recipes:', error);
          return;
        }

        setSharedCollectionRecipes(
          data.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            imageUrl: row.image_url,
            ingredientCount: row.ingredient_count,
            stepCount: row.step_count,
            ownerId: row.owner_id,
            collectionId: row.collection_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }))
        );
      } catch (error) {
        console.error('Failed to fetch shared collection recipes:', error);
      }
    };

    fetchRecipes();

    const channel = supabase
      .channel(`shared-col-recipes-${activeCollectionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recipes',
          filter: `collection_id=eq.${activeCollectionId}`,
        },
        () => {
          fetchRecipes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSharedCollection, activeCollectionId]);

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

  // -------------------------------------------------------------------------
  // Recipe Actions
  // -------------------------------------------------------------------------

  const createRecipeAction = useCallback(async (recipe) => {
    if (!userId) return null;
    const newId = await dbCreateRecipe(userId, { ...recipe, collectionId: activeCollectionId });
    return newId;
  }, [userId, activeCollectionId]);

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

  const selectRecipeAction = useCallback((id) => {
    setActiveRecipeId(id);
  }, []);

  const moveRecipeAction = useCallback(async (recipeId, targetCollectionId) => {
    await dbMoveRecipeToCollection(recipeId, targetCollectionId);
  }, []);

  // -------------------------------------------------------------------------
  // Collection Actions
  // -------------------------------------------------------------------------

  const selectCollectionAction = useCallback((collectionId) => {
    setActiveCollectionId(collectionId);
    setActiveRecipeId(null);
  }, []);

  const createCollectionAction = useCallback(async ({ name, emoji, description }) => {
    if (!userId) return null;
    return await dbCreateCollection(userId, { name, emoji, description });
  }, [userId]);

  const updateCollectionAction = useCallback(async (collectionId, updates) => {
    await dbUpdateCollection(collectionId, updates);
  }, []);

  const deleteCollectionAction = useCallback(async (collectionId, { deleteRecipes = false } = {}) => {
    if (!userId) return;

    if (deleteRecipes) {
      const recipesInCollection = allRecipes.filter((r) => r.collectionId === collectionId);
      for (const recipe of recipesInCollection) {
        await dbDeleteRecipe(userId, recipe.id);
      }
    } else {
      const defaultCollection = collections.find((c) => c.isDefault);
      if (!defaultCollection) throw new Error('No default collection found');
      const recipesInCollection = allRecipes.filter((r) => r.collectionId === collectionId);
      for (const recipe of recipesInCollection) {
        await dbMoveRecipeToCollection(recipe.id, defaultCollection.id);
      }
    }

    await dbDeleteCollection(userId, collectionId);

    if (activeCollectionId === collectionId) {
      const defaultCollection = collections.find((c) => c.isDefault);
      setActiveCollectionId(defaultCollection?.id ?? null);
    }
  }, [userId, allRecipes, collections, activeCollectionId]);

  const shareCollectionAction = useCallback(async (collectionId, email) => {
    if (!userId) return;
    await dbShareCollection(collectionId, email, userId);
  }, [userId]);

  const unshareCollectionAction = useCallback(async (collectionId, email) => {
    await dbUnshareCollection(collectionId, email);
  }, []);

  const getCollectionSharesAction = useCallback(async (collectionId) => {
    return await dbGetCollectionShares(collectionId);
  }, []);

  // -------------------------------------------------------------------------
  // Build the context value
  // -------------------------------------------------------------------------

  const state = {
    collections,
    sharedCollections,
    activeCollectionId,
    recipes,
    allRecipes,
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
    selectRecipe: selectRecipeAction,
    moveRecipe: moveRecipeAction,
    createCollection: createCollectionAction,
    updateCollection: updateCollectionAction,
    deleteCollection: deleteCollectionAction,
    selectCollection: selectCollectionAction,
    shareCollection: shareCollectionAction,
    unshareCollection: unshareCollectionAction,
    getCollectionShares: getCollectionSharesAction,
  };

  return (
    <RecipeContext.Provider value={{ state, actions }}>
      {children}
    </RecipeContext.Provider>
  );
};
