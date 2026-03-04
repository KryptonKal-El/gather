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
 * @param {object} recipe - Recipe data { name, description, ingredients, steps }
 * @returns {Promise<string>} The new recipe's ID
 */
export const createRecipe = async (userId, recipe) => {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .insert({
        owner_id: userId,
        name: recipe.name,
        description: recipe.description ?? null,
        ingredient_count: recipe.ingredients?.length ?? 0,
        step_count: recipe.steps?.length ?? 0,
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
