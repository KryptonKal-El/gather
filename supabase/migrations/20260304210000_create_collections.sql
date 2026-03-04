-- Gather Collections Schema for Recipe Grouping
-- Migration: create_collections
-- Created: 2026-03-04
--
-- Collections allow users to organize recipes into groups and share entire
-- collections with other users (replacing per-recipe sharing in US-002).

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. collections - User-owned recipe collections
CREATE TABLE collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  emoji text,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. collection_shares - Sharing collections with other users by email
CREATE TABLE collection_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid REFERENCES collections(id) ON DELETE CASCADE NOT NULL,
  shared_with_email text NOT NULL,
  shared_by uuid REFERENCES profiles(id) NOT NULL,
  permission text NOT NULL DEFAULT 'write' CHECK (permission IN ('read', 'write')),
  added_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- MODIFY RECIPES TABLE
-- ============================================================================

-- Add collection_id column (nullable during transition, US-002 will make NOT NULL)
ALTER TABLE recipes ADD COLUMN collection_id uuid REFERENCES collections(id) ON DELETE SET NULL;

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

ALTER TABLE collection_shares ADD CONSTRAINT unique_collection_share UNIQUE (collection_id, shared_with_email);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_collections_owner_id ON collections(owner_id);
CREATE INDEX idx_collection_shares_collection_id ON collection_shares(collection_id);
CREATE INDEX idx_collection_shares_shared_with_email ON collection_shares(shared_with_email);
CREATE INDEX idx_recipes_collection_id ON recipes(collection_id);

-- ============================================================================
-- ENABLE RLS ON NEW TABLES
-- ============================================================================

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_shares ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- ============================================================================

-- Check if current user owns the specified collection
CREATE OR REPLACE FUNCTION is_collection_owner(collection_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collections
    WHERE id = collection_uuid
    AND owner_id = auth.uid()
  );
$$;

-- Check if current user has a share on the specified collection
CREATE OR REPLACE FUNCTION is_collection_shared_with_me(collection_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collection_shares
    WHERE collection_id = collection_uuid
    AND shared_with_email = auth.jwt() ->> 'email'
  );
$$;

-- Check if current user has write permission on the specified collection
CREATE OR REPLACE FUNCTION has_collection_write_permission(collection_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collection_shares
    WHERE collection_id = collection_uuid
    AND shared_with_email = auth.jwt() ->> 'email'
    AND permission = 'write'
  );
$$;

-- ============================================================================
-- COLLECTIONS POLICIES
-- ============================================================================

-- SELECT: owner or shared user
CREATE POLICY "collections_select_own_or_shared" ON collections
  FOR SELECT USING (
    owner_id = auth.uid()
    OR is_collection_shared_with_me(id)
  );

-- INSERT: only owner
CREATE POLICY "collections_insert_own" ON collections
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- UPDATE: only owner
CREATE POLICY "collections_update_own" ON collections
  FOR UPDATE USING (owner_id = auth.uid());

-- DELETE: only owner
CREATE POLICY "collections_delete_own" ON collections
  FOR DELETE USING (owner_id = auth.uid());

-- ============================================================================
-- COLLECTION_SHARES POLICIES
-- ============================================================================

-- SELECT: shared user sees their own rows, collection owner sees all
CREATE POLICY "collection_shares_select" ON collection_shares
  FOR SELECT USING (
    shared_with_email = auth.jwt() ->> 'email'
    OR is_collection_owner(collection_id)
  );

-- INSERT: only collection owner
CREATE POLICY "collection_shares_insert" ON collection_shares
  FOR INSERT WITH CHECK (
    is_collection_owner(collection_id)
  );

-- DELETE: only collection owner
CREATE POLICY "collection_shares_delete" ON collection_shares
  FOR DELETE USING (
    is_collection_owner(collection_id)
  );

-- ============================================================================
-- UPDATE RECIPES SELECT POLICY
-- Add collection-based sharing alongside existing recipe_shares (transition)
-- ============================================================================

DROP POLICY IF EXISTS "recipes_select_own_or_shared" ON recipes;

CREATE POLICY "recipes_select_own_or_shared" ON recipes
  FOR SELECT USING (
    owner_id = auth.uid()
    OR (
      collection_id IS NOT NULL
      AND is_collection_shared_with_me(collection_id)
    )
    OR EXISTS (
      SELECT 1 FROM recipe_shares
      WHERE recipe_shares.recipe_id = recipes.id
      AND recipe_shares.shared_with_email = auth.jwt() ->> 'email'
    )
  );

-- ============================================================================
-- UPDATE RECIPE_INGREDIENTS SELECT POLICY
-- Add collection-based sharing alongside existing recipe_shares (transition)
-- ============================================================================

DROP POLICY IF EXISTS "recipe_ingredients_select" ON recipe_ingredients;

CREATE POLICY "recipe_ingredients_select" ON recipe_ingredients
  FOR SELECT USING (
    is_recipe_owner(recipe_id)
    OR EXISTS (
      SELECT 1 FROM recipe_shares
      WHERE recipe_shares.recipe_id = recipe_ingredients.recipe_id
      AND recipe_shares.shared_with_email = auth.jwt() ->> 'email'
    )
    OR EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND recipes.collection_id IS NOT NULL
      AND is_collection_shared_with_me(recipes.collection_id)
    )
  );

-- ============================================================================
-- UPDATE RECIPE_STEPS SELECT POLICY
-- Add collection-based sharing alongside existing recipe_shares (transition)
-- ============================================================================

DROP POLICY IF EXISTS "recipe_steps_select" ON recipe_steps;

CREATE POLICY "recipe_steps_select" ON recipe_steps
  FOR SELECT USING (
    is_recipe_owner(recipe_id)
    OR EXISTS (
      SELECT 1 FROM recipe_shares
      WHERE recipe_shares.recipe_id = recipe_steps.recipe_id
      AND recipe_shares.shared_with_email = auth.jwt() ->> 'email'
    )
    OR EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_steps.recipe_id
      AND recipes.collection_id IS NOT NULL
      AND is_collection_shared_with_me(recipes.collection_id)
    )
  );

-- ============================================================================
-- REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE collections;
ALTER PUBLICATION supabase_realtime ADD TABLE collection_shares;
