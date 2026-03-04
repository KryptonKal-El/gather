-- Fix RLS infinite recursion on recipes/recipe_shares
-- Migration: fix_recipe_rls_recursion
-- Created: 2026-03-04
--
-- Root cause: recipes SELECT policy queries recipe_shares, and recipe_shares
-- SELECT policy queries recipes, creating an infinite loop.
--
-- Fix: Create a SECURITY DEFINER function that bypasses RLS to check recipe
-- ownership, then use it in recipe_shares policies instead of querying recipes.

-- ============================================================================
-- SECURITY DEFINER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION is_recipe_owner(recipe_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM recipes
    WHERE id = recipe_uuid
    AND owner_id = auth.uid()
  );
$$;

-- ============================================================================
-- DROP PROBLEMATIC RECIPE_SHARES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "recipe_shares_select" ON recipe_shares;
DROP POLICY IF EXISTS "recipe_shares_insert" ON recipe_shares;
DROP POLICY IF EXISTS "recipe_shares_delete" ON recipe_shares;

-- ============================================================================
-- RECREATE RECIPE_SHARES POLICIES USING is_recipe_owner()
-- ============================================================================

CREATE POLICY "recipe_shares_select" ON recipe_shares
  FOR SELECT USING (
    shared_with_email = auth.jwt() ->> 'email'
    OR is_recipe_owner(recipe_id)
  );

CREATE POLICY "recipe_shares_insert" ON recipe_shares
  FOR INSERT WITH CHECK (
    is_recipe_owner(recipe_id)
  );

CREATE POLICY "recipe_shares_delete" ON recipe_shares
  FOR DELETE USING (
    is_recipe_owner(recipe_id)
  );

-- ============================================================================
-- DROP PROBLEMATIC RECIPE_INGREDIENTS/RECIPE_STEPS SELECT POLICIES
-- These also have nested subqueries that trigger the recursion chain
-- ============================================================================

DROP POLICY IF EXISTS "recipe_ingredients_select" ON recipe_ingredients;
DROP POLICY IF EXISTS "recipe_steps_select" ON recipe_steps;

-- ============================================================================
-- RECREATE RECIPE_INGREDIENTS/RECIPE_STEPS SELECT POLICIES
-- Use is_recipe_owner() to avoid triggering recipes RLS
-- ============================================================================

CREATE POLICY "recipe_ingredients_select" ON recipe_ingredients
  FOR SELECT USING (
    is_recipe_owner(recipe_id)
    OR EXISTS (
      SELECT 1 FROM recipe_shares
      WHERE recipe_shares.recipe_id = recipe_ingredients.recipe_id
      AND recipe_shares.shared_with_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "recipe_steps_select" ON recipe_steps
  FOR SELECT USING (
    is_recipe_owner(recipe_id)
    OR EXISTS (
      SELECT 1 FROM recipe_shares
      WHERE recipe_shares.recipe_id = recipe_steps.recipe_id
      AND recipe_shares.shared_with_email = auth.jwt() ->> 'email'
    )
  );
