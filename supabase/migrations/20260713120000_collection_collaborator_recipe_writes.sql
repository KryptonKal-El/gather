-- Let collection collaborators add & edit recipes in shared collections.
--
-- Previously all write policies on recipes / recipe_ingredients / recipe_steps
-- required recipes.owner_id = auth.uid(). Now anyone with write access to the
-- recipe's collection (the owner, or a collection_shares row with
-- permission = 'write') can write. Also fixes two pre-existing gaps:
--   1. recipes_insert_own did not constrain collection_id, so any user could
--      insert a recipe into ANY collection whose id they knew.
--   2. recipes_select had no is_collection_owner branch, so a collection owner
--      could not see recipes added to their collection by collaborators.
--
-- Note: recipe_shares was archived in 20260304220000; sharing is
-- collection-based only.

-- ============================================================================
-- HELPER: write access to a recipe (owner, collection owner, or write sharee)
-- ============================================================================

CREATE OR REPLACE FUNCTION has_recipe_write_access(recipe_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM recipes
    WHERE id = recipe_uuid
    AND (
      owner_id = auth.uid()
      OR (
        collection_id IS NOT NULL
        AND (
          is_collection_owner(collection_id)
          OR has_collection_write_permission(collection_id)
        )
      )
    )
  );
$$;

-- ============================================================================
-- RECIPES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "recipes_select_own_or_shared" ON recipes;
CREATE POLICY "recipes_select_own_or_shared" ON recipes
  FOR SELECT USING (
    owner_id = auth.uid()
    OR (
      collection_id IS NOT NULL
      AND (
        is_collection_owner(collection_id)
        OR is_collection_shared_with_me(collection_id)
      )
    )
  );

-- INSERT: you must own the new row, and the target collection must be yours
-- or one shared with you with write permission.
DROP POLICY IF EXISTS "recipes_insert_own" ON recipes;
CREATE POLICY "recipes_insert_own" ON recipes
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
    AND (
      collection_id IS NULL
      OR is_collection_owner(collection_id)
      OR has_collection_write_permission(collection_id)
    )
  );

-- UPDATE: recipe owner, collection owner, or write sharee. WITH CHECK keeps
-- the row in a collection the editor can write to (blocks moving someone
-- else's recipe into an unrelated collection).
DROP POLICY IF EXISTS "recipes_update_own" ON recipes;
CREATE POLICY "recipes_update_own_or_collection_writers" ON recipes
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR (
      collection_id IS NOT NULL
      AND (
        is_collection_owner(collection_id)
        OR has_collection_write_permission(collection_id)
      )
    )
  ) WITH CHECK (
    collection_id IS NULL
    OR is_collection_owner(collection_id)
    OR has_collection_write_permission(collection_id)
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "recipes_delete_own" ON recipes;
CREATE POLICY "recipes_delete_own_or_collection_writers" ON recipes
  FOR DELETE USING (
    owner_id = auth.uid()
    OR (
      collection_id IS NOT NULL
      AND (
        is_collection_owner(collection_id)
        OR has_collection_write_permission(collection_id)
      )
    )
  );

-- ============================================================================
-- RECIPE_INGREDIENTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "recipe_ingredients_select" ON recipe_ingredients;
CREATE POLICY "recipe_ingredients_select" ON recipe_ingredients
  FOR SELECT USING (
    has_recipe_write_access(recipe_id)
    OR EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND recipes.collection_id IS NOT NULL
      AND is_collection_shared_with_me(recipes.collection_id)
    )
  );

DROP POLICY IF EXISTS "recipe_ingredients_insert" ON recipe_ingredients;
CREATE POLICY "recipe_ingredients_insert" ON recipe_ingredients
  FOR INSERT WITH CHECK (has_recipe_write_access(recipe_id));

DROP POLICY IF EXISTS "recipe_ingredients_update" ON recipe_ingredients;
CREATE POLICY "recipe_ingredients_update" ON recipe_ingredients
  FOR UPDATE USING (has_recipe_write_access(recipe_id));

DROP POLICY IF EXISTS "recipe_ingredients_delete" ON recipe_ingredients;
CREATE POLICY "recipe_ingredients_delete" ON recipe_ingredients
  FOR DELETE USING (has_recipe_write_access(recipe_id));

-- ============================================================================
-- RECIPE_STEPS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "recipe_steps_select" ON recipe_steps;
CREATE POLICY "recipe_steps_select" ON recipe_steps
  FOR SELECT USING (
    has_recipe_write_access(recipe_id)
    OR EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_steps.recipe_id
      AND recipes.collection_id IS NOT NULL
      AND is_collection_shared_with_me(recipes.collection_id)
    )
  );

DROP POLICY IF EXISTS "recipe_steps_insert" ON recipe_steps;
CREATE POLICY "recipe_steps_insert" ON recipe_steps
  FOR INSERT WITH CHECK (has_recipe_write_access(recipe_id));

DROP POLICY IF EXISTS "recipe_steps_update" ON recipe_steps;
CREATE POLICY "recipe_steps_update" ON recipe_steps
  FOR UPDATE USING (has_recipe_write_access(recipe_id));

DROP POLICY IF EXISTS "recipe_steps_delete" ON recipe_steps;
CREATE POLICY "recipe_steps_delete" ON recipe_steps
  FOR DELETE USING (has_recipe_write_access(recipe_id));
