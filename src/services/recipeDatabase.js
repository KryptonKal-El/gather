/**
 * Supabase database service layer for recipes.
 * Provides CRUD operations and subscriptions for recipes, ingredients, steps, and sharing.
 */
import { supabase } from './supabase.js';

// ---------------------------------------------------------------------------
// Recipes - CRUD
// ---------------------------------------------------------------------------

/**
 * Creates a new recipe with ingredients and steps. Returns the generated ID.
 * @param {string} userId - Owner's user ID
 * @param {object} recipe - Recipe data { name, description, ingredients, steps, collectionId }
 * @returns {Promise<string>} The new recipe's ID
 */
export const createRecipe = async (userId, recipe) => {
  if (!recipe.collectionId) {
    throw new Error('collectionId is required to create a recipe');
  }

  try {
    const { data, error } = await supabase
      .from('recipes')
      .insert({
        owner_id: userId,
        name: recipe.name,
        description: recipe.description ?? null,
        ingredient_count: recipe.ingredients?.length ?? 0,
        step_count: recipe.steps?.length ?? 0,
        collection_id: recipe.collectionId,
      })
      .select('id')
      .single();

    if (error) throw error;

    const recipeId = data.id;

    if (recipe.ingredients?.length > 0) {
      const ingredientRows = recipe.ingredients.map((ing, i) => ({
        recipe_id: recipeId,
        name: ing.name,
        quantity: ing.quantity ?? null,
        sort_order: i,
      }));

      const { error: ingError } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientRows);

      if (ingError) throw ingError;
    }

    if (recipe.steps?.length > 0) {
      const stepRows = recipe.steps.map((step, i) => ({
        recipe_id: recipeId,
        instruction: step.instruction,
        sort_order: i,
      }));

      const { error: stepError } = await supabase
        .from('recipe_steps')
        .insert(stepRows);

      if (stepError) throw stepError;
    }

    return recipeId;
  } catch (error) {
    throw new Error(`Failed to create recipe: name=${recipe.name}`, { cause: error });
  }
};

/**
 * Updates fields on a recipe.
 * @param {string} userId - User ID (kept for API compatibility)
 * @param {string} recipeId - Recipe ID to update
 * @param {object} updates - Fields to update (name, description, imageUrl)
 */
export const updateRecipe = async (userId, recipeId, updates) => {
  try {
    const mapped = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.description !== undefined) mapped.description = updates.description;
    if (updates.imageUrl !== undefined) mapped.image_url = updates.imageUrl;
    if (updates.image_url !== undefined) mapped.image_url = updates.image_url;

    const { error } = await supabase
      .from('recipes')
      .update(mapped)
      .eq('id', recipeId);

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to update recipe: recipeId=${recipeId}`, { cause: error });
  }
};

/**
 * Deletes a recipe. Ingredients, steps, and shares cascade-delete via FK constraint.
 * @param {string} userId - User ID (kept for API compatibility)
 * @param {string} recipeId - Recipe ID to delete
 */
export const deleteRecipe = async (userId, recipeId) => {
  try {
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId);

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to delete recipe: recipeId=${recipeId}`, { cause: error });
  }
};

/**
 * Replaces all ingredients for a recipe.
 * @param {string} recipeId - Recipe ID
 * @param {Array<object>} ingredients - Array of { name, quantity, sortOrder }
 */
export const updateRecipeIngredients = async (recipeId, ingredients) => {
  try {
    const { error: deleteError } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipeId);

    if (deleteError) throw deleteError;

    if (ingredients.length > 0) {
      const rows = ingredients.map((ing, i) => ({
        recipe_id: recipeId,
        name: ing.name,
        quantity: ing.quantity ?? null,
        sort_order: ing.sortOrder ?? i,
      }));

      const { error: insertError } = await supabase
        .from('recipe_ingredients')
        .insert(rows);

      if (insertError) throw insertError;
    }

    const { error: updateError } = await supabase
      .from('recipes')
      .update({
        ingredient_count: ingredients.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recipeId);

    if (updateError) throw updateError;
  } catch (error) {
    throw new Error(`Failed to update recipe ingredients: recipeId=${recipeId}`, { cause: error });
  }
};

/**
 * Replaces all steps for a recipe.
 * @param {string} recipeId - Recipe ID
 * @param {Array<object>} steps - Array of { instruction, sortOrder }
 */
export const updateRecipeSteps = async (recipeId, steps) => {
  try {
    const { error: deleteError } = await supabase
      .from('recipe_steps')
      .delete()
      .eq('recipe_id', recipeId);

    if (deleteError) throw deleteError;

    if (steps.length > 0) {
      const rows = steps.map((step, i) => ({
        recipe_id: recipeId,
        instruction: step.instruction,
        sort_order: step.sortOrder ?? i,
      }));

      const { error: insertError } = await supabase
        .from('recipe_steps')
        .insert(rows);

      if (insertError) throw insertError;
    }

    const { error: updateError } = await supabase
      .from('recipes')
      .update({
        step_count: steps.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recipeId);

    if (updateError) throw updateError;
  } catch (error) {
    throw new Error(`Failed to update recipe steps: recipeId=${recipeId}`, { cause: error });
  }
};

// ---------------------------------------------------------------------------
// Recipe Images
// ---------------------------------------------------------------------------

/**
 * Uploads a recipe image to Supabase Storage and updates the recipe's image_url.
 * @param {string} userId - Owner's user ID
 * @param {string} recipeId - Recipe ID
 * @param {File|Blob} file - The image file to upload
 * @returns {Promise<string>} The public URL
 */
export const uploadRecipeImage = async (userId, recipeId, file) => {
  try {
    const ext = file.type?.split('/')[1] ?? 'jpg';
    const path = `${userId}/${recipeId}.${ext}`;

    const { error } = await supabase.storage
      .from('recipe-images')
      .upload(path, file, { upsert: true });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('recipe-images')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    const { error: updateError } = await supabase
      .from('recipes')
      .update({
        image_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recipeId);

    if (updateError) throw updateError;

    return publicUrl;
  } catch (error) {
    throw new Error(`Failed to upload recipe image: recipeId=${recipeId}`, { cause: error });
  }
};

// ---------------------------------------------------------------------------
// Recipes - Subscriptions
// ---------------------------------------------------------------------------

/**
 * Subscribes to all recipes for a user.
 * Performs initial fetch and subscribes to real-time changes.
 * @param {string} userId - User ID
 * @param {function} callback - Called with array of recipe objects
 * @returns {function} Unsubscribe function that removes the channel
 */
export const subscribeRecipes = (userId, callback) => {
  const fetchRecipes = async () => {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch recipes:', error);
        return;
      }

      callback(
        data.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          imageUrl: row.image_url,
          ingredientCount: row.ingredient_count,
          stepCount: row.step_count,
          ownerId: row.owner_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      );
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
    }
  };

  fetchRecipes();

  const channel = supabase
    .channel(`recipes-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'recipes',
        filter: `owner_id=eq.${userId}`,
      },
      () => {
        fetchRecipes();
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[subscribeRecipes] Realtime subscription error:', err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Subscribes to a single recipe with its ingredients and steps.
 * Performs initial fetch and subscribes to real-time changes on all three tables.
 * @param {string} recipeId - Recipe ID
 * @param {function} callback - Called with recipe object including ingredients and steps arrays
 * @returns {function} Unsubscribe function that removes the channel
 */
export const subscribeRecipeDetail = (recipeId, callback) => {
  const fetchRecipeDetail = async () => {
    try {
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .maybeSingle();

      if (recipeError) {
        console.error('Failed to fetch recipe:', recipeError);
        return;
      }

      if (!recipe) {
        callback(null);
        return;
      }

      const { data: ingredients, error: ingError } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('sort_order', { ascending: true });

      if (ingError) {
        console.error('Failed to fetch recipe ingredients:', ingError);
        return;
      }

      const { data: steps, error: stepsError } = await supabase
        .from('recipe_steps')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('sort_order', { ascending: true });

      if (stepsError) {
        console.error('Failed to fetch recipe steps:', stepsError);
        return;
      }

      callback({
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        imageUrl: recipe.image_url,
        ingredientCount: recipe.ingredient_count,
        stepCount: recipe.step_count,
        ownerId: recipe.owner_id,
        createdAt: recipe.created_at,
        updatedAt: recipe.updated_at,
        ingredients: ingredients.map((row) => ({
          id: row.id,
          name: row.name,
          quantity: row.quantity,
          sortOrder: row.sort_order,
          recipeId: row.recipe_id,
        })),
        steps: steps.map((row) => ({
          id: row.id,
          instruction: row.instruction,
          sortOrder: row.sort_order,
          recipeId: row.recipe_id,
        })),
      });
    } catch (error) {
      console.error('Failed to fetch recipe detail:', error);
    }
  };

  fetchRecipeDetail();

  const channel = supabase
    .channel(`recipe-detail-${recipeId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'recipes',
        filter: `id=eq.${recipeId}`,
      },
      () => {
        fetchRecipeDetail();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'recipe_ingredients',
        filter: `recipe_id=eq.${recipeId}`,
      },
      () => {
        fetchRecipeDetail();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'recipe_steps',
        filter: `recipe_id=eq.${recipeId}`,
      },
      () => {
        fetchRecipeDetail();
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[subscribeRecipeDetail] Realtime subscription error:', err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};

// ---------------------------------------------------------------------------
// Recipe Sharing
// ---------------------------------------------------------------------------

/**
 * Shares a recipe with another user by email.
 * @deprecated Use shareCollection instead. Will be removed in US-012.
 * @param {string} recipeId - Recipe ID to share
 * @param {string} email - Email of the user to share with
 */
export const shareRecipe = async (recipeId, email) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const { error } = await supabase.from('recipe_shares').insert({
      recipe_id: recipeId,
      shared_with_email: normalizedEmail,
    });

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to share recipe: recipeId=${recipeId}, email=${email}`, { cause: error });
  }
};

/**
 * Removes sharing for a given email from a recipe.
 * @deprecated Use unshareCollection instead. Will be removed in US-012.
 * @param {string} recipeId - Recipe ID
 * @param {string} email - Email to unshare with
 */
export const unshareRecipe = async (recipeId, email) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const { error } = await supabase
      .from('recipe_shares')
      .delete()
      .eq('recipe_id', recipeId)
      .eq('shared_with_email', normalizedEmail);

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to unshare recipe: recipeId=${recipeId}, email=${email}`, { cause: error });
  }
};

/**
 * Subscribes to shared recipe references for a user (by email).
 * Returns refs for recipes that others have shared with this user.
 * @deprecated Use subscribeSharedCollections instead. Will be removed in US-012.
 * @param {string} email - User's email
 * @param {function} callback - Called with array of shared recipe ref objects
 * @returns {function} Unsubscribe function that removes the channel
 */
export const subscribeSharedRecipeRefs = (email, callback) => {
  if (!email) {
    callback([]);
    return () => {};
  }

  const normalizedEmail = email.toLowerCase().trim();

  const fetchSharedRefs = async () => {
    try {
      const { data: shares, error: sharesError } = await supabase
        .from('recipe_shares')
        .select('id, recipe_id, added_at')
        .eq('shared_with_email', normalizedEmail);

      if (sharesError) {
        console.error('Failed to fetch shared recipe refs:', sharesError);
        return;
      }

      if (shares.length === 0) {
        callback([]);
        return;
      }

      const recipeIds = shares.map((s) => s.recipe_id);
      const { data: recipes, error: recipesError } = await supabase
        .from('recipes')
        .select('id, name, owner_id')
        .in('id', recipeIds);

      if (recipesError) {
        console.error('Failed to fetch shared recipes:', recipesError);
        return;
      }

      const recipeMap = {};
      for (const recipe of recipes) {
        recipeMap[recipe.id] = recipe;
      }

      const refs = shares
        .filter((s) => recipeMap[s.recipe_id])
        .map((s) => {
          const recipe = recipeMap[s.recipe_id];
          return {
            id: s.id,
            recipeId: s.recipe_id,
            recipeName: recipe.name,
            ownerUid: recipe.owner_id,
            addedAt: s.added_at,
          };
        });

      callback(refs);
    } catch (error) {
      console.error('Failed to fetch shared recipe refs:', error);
    }
  };

  fetchSharedRefs();

  const channel = supabase
    .channel(`shared-recipe-refs-${normalizedEmail}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'recipe_shares',
        filter: `shared_with_email=eq.${normalizedEmail}`,
      },
      () => {
        fetchSharedRefs();
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[subscribeSharedRecipeRefs] Realtime subscription error:', err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Fetches all shares for a recipe.
 * @deprecated Use getCollectionShares instead. Will be removed in US-012.
 * @param {string} recipeId - Recipe ID
 * @returns {Promise<Array<object>>} Array of { id, email, addedAt }
 */
export const getRecipeShares = async (recipeId) => {
  try {
    const { data, error } = await supabase
      .from('recipe_shares')
      .select('id, shared_with_email, added_at')
      .eq('recipe_id', recipeId);

    if (error) throw error;

    return data.map((row) => ({
      id: row.id,
      email: row.shared_with_email,
      addedAt: row.added_at,
    }));
  } catch (error) {
    throw new Error(`Failed to get recipe shares: recipeId=${recipeId}`, { cause: error });
  }
};

// ---------------------------------------------------------------------------
// Collections - CRUD
// ---------------------------------------------------------------------------

/**
 * Creates a new collection. Returns the generated ID.
 * @param {string} userId - Owner's user ID
 * @param {object} params - Collection data { name, emoji, description }
 * @returns {Promise<string>} The new collection's ID
 */
export const createCollection = async (userId, { name, emoji, description }) => {
  try {
    const { data, error } = await supabase
      .from('collections')
      .insert({
        owner_id: userId,
        name,
        emoji: emoji ?? null,
        description: description ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;

    return data.id;
  } catch (error) {
    throw new Error(`Failed to create collection: name=${name}`, { cause: error });
  }
};

/**
 * Updates fields on a collection.
 * @param {string} collectionId - Collection ID to update
 * @param {object} updates - Fields to update { name, emoji, description }
 */
export const updateCollection = async (collectionId, { name, emoji, description }) => {
  try {
    const mapped = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) mapped.name = name;
    if (emoji !== undefined) mapped.emoji = emoji;
    if (description !== undefined) mapped.description = description;

    const { error } = await supabase
      .from('collections')
      .update(mapped)
      .eq('id', collectionId);

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to update collection: collectionId=${collectionId}`, { cause: error });
  }
};

/**
 * Deletes a collection. Prevents deleting the user's last collection.
 * @param {string} userId - Owner's user ID
 * @param {string} collectionId - Collection ID to delete
 */
export const deleteCollection = async (userId, collectionId) => {
  try {
    const { count, error: countError } = await supabase
      .from('collections')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', userId);

    if (countError) throw countError;

    if (count <= 1) {
      throw new Error('Cannot delete your last collection');
    }

    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId);

    if (error) throw error;
  } catch (error) {
    if (error.message === 'Cannot delete your last collection') {
      throw error;
    }
    throw new Error(`Failed to delete collection: collectionId=${collectionId}`, { cause: error });
  }
};

/**
 * Fetches all collections for a user.
 * @param {string} userId - User ID
 * @returns {Promise<Array<object>>} Array of collection objects
 */
export const getCollections = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('owner_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      description: row.description,
      isDefault: row.is_default,
      sortOrder: row.sort_order,
      ownerId: row.owner_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    throw new Error(`Failed to get collections: userId=${userId}`, { cause: error });
  }
};

/**
 * Subscribes to all collections for a user.
 * Performs initial fetch and subscribes to real-time changes.
 * @param {string} userId - User ID
 * @param {function} callback - Called with array of collection objects
 * @returns {function} Unsubscribe function that removes the channel
 */
export const subscribeCollections = (userId, callback) => {
  const fetchCollections = async () => {
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('owner_id', userId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch collections:', error);
        return;
      }

      callback(
        data.map((row) => ({
          id: row.id,
          name: row.name,
          emoji: row.emoji,
          description: row.description,
          isDefault: row.is_default,
          sortOrder: row.sort_order,
          ownerId: row.owner_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      );
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    }
  };

  fetchCollections();

  const channel = supabase
    .channel(`collections-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'collections',
        filter: `owner_id=eq.${userId}`,
      },
      () => {
        fetchCollections();
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[subscribeCollections] Realtime subscription error:', err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Ensures the user has a default collection, creating one if needed.
 * @param {string} userId - User ID
 * @returns {Promise<string>} The default collection's ID
 */
export const ensureDefaultCollection = async (userId) => {
  try {
    const { data, error: selectError } = await supabase
      .from('collections')
      .select('id')
      .eq('owner_id', userId)
      .eq('is_default', true)
      .maybeSingle();

    if (selectError) throw selectError;

    if (data) {
      return data.id;
    }

    const { data: newCollection, error: insertError } = await supabase
      .from('collections')
      .insert({
        owner_id: userId,
        name: 'My Recipes',
        emoji: '📖',
        is_default: true,
        sort_order: 0,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    return newCollection.id;
  } catch (error) {
    throw new Error(`Failed to ensure default collection: userId=${userId}`, { cause: error });
  }
};

/**
 * Moves a recipe to a different collection.
 * @param {string} recipeId - Recipe ID to move
 * @param {string} collectionId - Target collection ID
 */
export const moveRecipeToCollection = async (recipeId, collectionId) => {
  try {
    const { error } = await supabase
      .from('recipes')
      .update({
        collection_id: collectionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recipeId);

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to move recipe: recipeId=${recipeId}, collectionId=${collectionId}`, { cause: error });
  }
};

// ---------------------------------------------------------------------------
// Collections - Sharing
// ---------------------------------------------------------------------------

/**
 * Shares a collection with another user by email.
 * @param {string} collectionId - Collection ID to share
 * @param {string} email - Email of the user to share with
 * @param {string} userId - User ID of the person sharing (owner)
 */
export const shareCollection = async (collectionId, email, userId) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Check if owner is trying to share with themselves
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('owner_id')
      .eq('id', collectionId)
      .single();

    if (collectionError) throw collectionError;

    const { data: ownerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', collection.owner_id)
      .single();

    if (profileError) throw profileError;

    if (ownerProfile.email?.toLowerCase().trim() === normalizedEmail) {
      throw new Error('Cannot share a collection with yourself');
    }

    const { error } = await supabase.from('collection_shares').insert({
      collection_id: collectionId,
      shared_with_email: normalizedEmail,
      shared_by: userId,
      permission: 'write',
    });

    if (error) throw error;
  } catch (error) {
    if (error.message === 'Cannot share a collection with yourself') {
      throw error;
    }
    throw new Error(`Failed to share collection: collectionId=${collectionId}, email=${email}`, { cause: error });
  }
};

/**
 * Removes sharing for a given email from a collection.
 * @param {string} collectionId - Collection ID
 * @param {string} email - Email to unshare with
 */
export const unshareCollection = async (collectionId, email) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const { error } = await supabase
      .from('collection_shares')
      .delete()
      .eq('collection_id', collectionId)
      .eq('shared_with_email', normalizedEmail);

    if (error) throw error;
  } catch (error) {
    throw new Error(`Failed to unshare collection: collectionId=${collectionId}, email=${email}`, { cause: error });
  }
};

/**
 * Fetches all shares for a collection.
 * @param {string} collectionId - Collection ID
 * @returns {Promise<Array<object>>} Array of { id, email, addedAt }
 */
export const getCollectionShares = async (collectionId) => {
  try {
    const { data, error } = await supabase
      .from('collection_shares')
      .select('id, shared_with_email, added_at')
      .eq('collection_id', collectionId);

    if (error) throw error;

    return data.map((row) => ({
      id: row.id,
      email: row.shared_with_email,
      addedAt: row.added_at,
    }));
  } catch (error) {
    throw new Error(`Failed to get collection shares: collectionId=${collectionId}`, { cause: error });
  }
};

/**
 * Subscribes to shared collections for a user (by email).
 * Returns collections that others have shared with this user.
 * @param {string} email - User's email
 * @param {function} callback - Called with array of shared collection objects
 * @returns {function} Unsubscribe function that removes the channel
 */
export const subscribeSharedCollections = (email, callback) => {
  if (!email) {
    callback([]);
    return () => {};
  }

  const normalizedEmail = email.toLowerCase().trim();

  const fetchSharedCollections = async () => {
    try {
      const { data: shares, error: sharesError } = await supabase
        .from('collection_shares')
        .select(`
          id,
          collection_id,
          added_at,
          permission,
          collections (
            id, name, emoji, description, owner_id, created_at, updated_at
          )
        `)
        .eq('shared_with_email', normalizedEmail);

      if (sharesError) {
        console.error('Failed to fetch shared collections:', sharesError);
        return;
      }

      if (!shares || shares.length === 0) {
        callback([]);
        return;
      }

      // Get recipe counts per collection
      const collectionIds = shares.map((s) => s.collection_id);
      const { data: recipes, error: recipesError } = await supabase
        .from('recipes')
        .select('collection_id')
        .in('collection_id', collectionIds);

      if (recipesError) {
        console.error('Failed to fetch recipe counts:', recipesError);
        return;
      }

      // Count recipes per collection
      const recipeCounts = {};
      for (const recipe of recipes || []) {
        recipeCounts[recipe.collection_id] = (recipeCounts[recipe.collection_id] || 0) + 1;
      }

      const mapped = shares
        .filter((s) => s.collections)
        .map((s) => ({
          id: s.id,
          collectionId: s.collection_id,
          permission: s.permission,
          addedAt: s.added_at,
          collection: {
            id: s.collections.id,
            name: s.collections.name,
            emoji: s.collections.emoji,
            description: s.collections.description,
            ownerId: s.collections.owner_id,
            createdAt: s.collections.created_at,
            updatedAt: s.collections.updated_at,
          },
          recipeCount: recipeCounts[s.collection_id] || 0,
        }));

      callback(mapped);
    } catch (error) {
      console.error('Failed to fetch shared collections:', error);
    }
  };

  fetchSharedCollections();

  const channel = supabase
    .channel(`shared-collections-${normalizedEmail}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'collection_shares',
        filter: `shared_with_email=eq.${normalizedEmail}`,
      },
      () => {
        fetchSharedCollections();
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[subscribeSharedCollections] Realtime subscription error:', err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Adds a recipe to a shared collection. The recipe will be owned by the user
 * but placed in the shared collection.
 * @param {string} userId - User ID of the person adding the recipe
 * @param {string} collectionId - Shared collection ID
 * @param {object} recipe - Recipe data { name, description, ingredients, steps }
 * @returns {Promise<string>} The new recipe's ID
 */
export const addRecipeToSharedCollection = async (userId, collectionId, recipe) => {
  try {
    return await createRecipe(userId, { ...recipe, collectionId });
  } catch (error) {
    throw new Error(`Failed to add recipe to shared collection: collectionId=${collectionId}`, { cause: error });
  }
};

/**
 * Removes a recipe from a shared collection. Users can only remove recipes they added.
 * @param {string} userId - User ID attempting the removal
 * @param {string} recipeId - Recipe ID to remove
 * @param {string} collectionId - Collection ID (kept for API clarity)
 */
export const removeRecipeFromSharedCollection = async (userId, recipeId, _collectionId) => {
  try {
    // Check if user owns the recipe
    const { data: recipe, error: fetchError } = await supabase
      .from('recipes')
      .select('owner_id')
      .eq('id', recipeId)
      .single();

    if (fetchError) throw fetchError;

    if (recipe.owner_id !== userId) {
      throw new Error('Can only remove recipes you added to a shared collection');
    }

    const { error: deleteError } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId);

    if (deleteError) throw deleteError;
  } catch (error) {
    if (error.message === 'Can only remove recipes you added to a shared collection') {
      throw error;
    }
    throw new Error(`Failed to remove recipe from shared collection: recipeId=${recipeId}`, { cause: error });
  }
};
