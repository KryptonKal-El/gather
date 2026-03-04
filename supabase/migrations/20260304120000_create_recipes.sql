-- ShoppingListAI Recipe Tables, Sharing, Storage, and RLS
-- Migration: create_recipes
-- Created: 2026-03-04

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. recipes - User-owned recipes with metadata
CREATE TABLE recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  ingredient_count int DEFAULT 0,
  step_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. recipe_ingredients - Ingredients within a recipe
CREATE TABLE recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  quantity text,
  sort_order int DEFAULT 0
);

-- 3. recipe_steps - Preparation steps within a recipe
CREATE TABLE recipe_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  instruction text NOT NULL,
  sort_order int DEFAULT 0
);

-- 4. recipe_shares - Sharing recipes with other users by email
CREATE TABLE recipe_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  shared_with_email text NOT NULL,
  added_at timestamptz DEFAULT now()
);

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

ALTER TABLE recipe_shares ADD CONSTRAINT unique_recipe_share UNIQUE (recipe_id, shared_with_email);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_recipes_owner_id ON recipes(owner_id);
CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_steps_recipe_id ON recipe_steps(recipe_id);
CREATE INDEX idx_recipe_shares_recipe_id ON recipe_shares(recipe_id);
CREATE INDEX idx_recipe_shares_shared_with_email ON recipe_shares(shared_with_email);

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_shares ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RECIPES POLICIES
-- ============================================================================

CREATE POLICY "recipes_select_own_or_shared" ON recipes
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM recipe_shares
      WHERE recipe_shares.recipe_id = recipes.id
      AND recipe_shares.shared_with_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "recipes_insert_own" ON recipes
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "recipes_update_own" ON recipes
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "recipes_delete_own" ON recipes
  FOR DELETE USING (owner_id = auth.uid());

-- ============================================================================
-- RECIPE_INGREDIENTS POLICIES
-- ============================================================================

CREATE POLICY "recipe_ingredients_select" ON recipe_ingredients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND (
        recipes.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM recipe_shares
          WHERE recipe_shares.recipe_id = recipes.id
          AND recipe_shares.shared_with_email = auth.jwt() ->> 'email'
        )
      )
    )
  );

CREATE POLICY "recipe_ingredients_insert" ON recipe_ingredients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND recipes.owner_id = auth.uid()
    )
  );

CREATE POLICY "recipe_ingredients_update" ON recipe_ingredients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND recipes.owner_id = auth.uid()
    )
  );

CREATE POLICY "recipe_ingredients_delete" ON recipe_ingredients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND recipes.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- RECIPE_STEPS POLICIES
-- ============================================================================

CREATE POLICY "recipe_steps_select" ON recipe_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_steps.recipe_id
      AND (
        recipes.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM recipe_shares
          WHERE recipe_shares.recipe_id = recipes.id
          AND recipe_shares.shared_with_email = auth.jwt() ->> 'email'
        )
      )
    )
  );

CREATE POLICY "recipe_steps_insert" ON recipe_steps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_steps.recipe_id
      AND recipes.owner_id = auth.uid()
    )
  );

CREATE POLICY "recipe_steps_update" ON recipe_steps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_steps.recipe_id
      AND recipes.owner_id = auth.uid()
    )
  );

CREATE POLICY "recipe_steps_delete" ON recipe_steps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_steps.recipe_id
      AND recipes.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- RECIPE_SHARES POLICIES
-- ============================================================================

CREATE POLICY "recipe_shares_select" ON recipe_shares
  FOR SELECT USING (
    shared_with_email = auth.jwt() ->> 'email'
    OR EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_shares.recipe_id
      AND recipes.owner_id = auth.uid()
    )
  );

CREATE POLICY "recipe_shares_insert" ON recipe_shares
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_shares.recipe_id
      AND recipes.owner_id = auth.uid()
    )
  );

CREATE POLICY "recipe_shares_delete" ON recipe_shares
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_shares.recipe_id
      AND recipes.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- CREATE STORAGE BUCKET
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true);

-- ============================================================================
-- RECIPE-IMAGES BUCKET POLICIES
-- Authenticated users can manage their own images under: recipe-images/{userId}/*
-- ============================================================================

CREATE POLICY "recipe_images_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'recipe-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "recipe_images_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'recipe-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "recipe_images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'recipe-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "recipe_images_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'recipe-images');

-- ============================================================================
-- REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE recipes;
ALTER PUBLICATION supabase_realtime ADD TABLE recipe_ingredients;
ALTER PUBLICATION supabase_realtime ADD TABLE recipe_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE recipe_shares;
