-- Migrate Recipes to Collections and Deprecate Recipe Shares
-- Migration: migrate_recipes_to_collections
-- Created: 2026-03-04
--
-- This migration:
-- 1. Creates default collections for all existing recipe owners
-- 2. Assigns unassigned recipes to their owner's default collection
-- 3. Migrates recipe_shares to collection_shares
-- 4. Makes collection_id NOT NULL
-- 5. Updates FK constraint to ON DELETE RESTRICT
-- 6. Archives recipe_shares table and updates policies

BEGIN;

-- ============================================================================
-- STEP 1: CREATE DEFAULT COLLECTIONS FOR EXISTING RECIPE OWNERS
-- ============================================================================

INSERT INTO collections (owner_id, name, emoji, is_default, sort_order)
SELECT DISTINCT r.owner_id, 'My Recipes', '📖', true, 0
FROM recipes r
WHERE NOT EXISTS (
  SELECT 1 FROM collections c
  WHERE c.owner_id = r.owner_id AND c.is_default = true
);

-- ============================================================================
-- STEP 2: ASSIGN UNASSIGNED RECIPES TO OWNER'S DEFAULT COLLECTION
-- ============================================================================

UPDATE recipes
SET collection_id = (
  SELECT c.id FROM collections c
  WHERE c.owner_id = recipes.owner_id AND c.is_default = true
  LIMIT 1
)
WHERE collection_id IS NULL;

-- ============================================================================
-- STEP 3: MIGRATE RECIPE_SHARES TO COLLECTION_SHARES
-- ============================================================================

-- For each recipe that was shared, create collection_shares rows so the
-- previously-shared users can access recipes via collection-based sharing.

INSERT INTO collection_shares (collection_id, shared_with_email, shared_by, permission)
SELECT DISTINCT
  r.collection_id,
  rs.shared_with_email,
  r.owner_id,
  'write'
FROM recipe_shares rs
JOIN recipes r ON r.id = rs.recipe_id
WHERE r.collection_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM collection_shares cs
  WHERE cs.collection_id = r.collection_id
  AND cs.shared_with_email = rs.shared_with_email
);

-- ============================================================================
-- STEP 4: MAKE COLLECTION_ID NOT NULL
-- ============================================================================

ALTER TABLE recipes ALTER COLUMN collection_id SET NOT NULL;

-- ============================================================================
-- STEP 5: UPDATE FK CONSTRAINT TO ON DELETE RESTRICT
-- ============================================================================

-- With collection_id NOT NULL, ON DELETE SET NULL would violate the constraint.
-- Use ON DELETE RESTRICT so collections with recipes cannot be deleted directly.
-- The application layer (US-015) will handle moving recipes before deletion.

ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_collection_id_fkey;
ALTER TABLE recipes ADD CONSTRAINT recipes_collection_id_fkey
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE RESTRICT;

-- ============================================================================
-- STEP 6: DROP RECIPE_SHARES FROM REALTIME PUBLICATION
-- ============================================================================

ALTER PUBLICATION supabase_realtime DROP TABLE recipe_shares;

-- ============================================================================
-- STEP 7: DROP RECIPE_SHARES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "recipe_shares_select" ON recipe_shares;
DROP POLICY IF EXISTS "recipe_shares_insert" ON recipe_shares;
DROP POLICY IF EXISTS "recipe_shares_delete" ON recipe_shares;

-- ============================================================================
-- STEP 8: ARCHIVE RECIPE_SHARES TABLE
-- ============================================================================

-- Rename for safety - can be dropped manually after verification
ALTER TABLE recipe_shares RENAME TO recipe_shares_archive;

-- Disable RLS on archive table (no longer needed for active use)
ALTER TABLE recipe_shares_archive DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 9: UPDATE RECIPES SELECT POLICY
-- Remove recipe_shares fallback, use only collection-based sharing
-- ============================================================================

DROP POLICY IF EXISTS "recipes_select_own_or_shared" ON recipes;

CREATE POLICY "recipes_select_own_or_shared" ON recipes
  FOR SELECT USING (
    owner_id = auth.uid()
    OR is_collection_shared_with_me(collection_id)
  );

-- ============================================================================
-- STEP 10: UPDATE RECIPE_INGREDIENTS SELECT POLICY
-- Remove recipe_shares fallback, use only collection-based sharing
-- ============================================================================

DROP POLICY IF EXISTS "recipe_ingredients_select" ON recipe_ingredients;

CREATE POLICY "recipe_ingredients_select" ON recipe_ingredients
  FOR SELECT USING (
    is_recipe_owner(recipe_id)
    OR EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND is_collection_shared_with_me(recipes.collection_id)
    )
  );

-- ============================================================================
-- STEP 11: UPDATE RECIPE_STEPS SELECT POLICY
-- Remove recipe_shares fallback, use only collection-based sharing
-- ============================================================================

DROP POLICY IF EXISTS "recipe_steps_select" ON recipe_steps;

CREATE POLICY "recipe_steps_select" ON recipe_steps
  FOR SELECT USING (
    is_recipe_owner(recipe_id)
    OR EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_steps.recipe_id
      AND is_collection_shared_with_me(recipes.collection_id)
    )
  );

COMMIT;
