-- Migrate lists.sort_mode (text) to sort_config (jsonb)
-- Migration: migrate_list_sort_mode_to_config
-- Created: 2026-03-11
--
-- This migration evolves the lists table from v1 (text enum) to v2 (jsonb array):
--   - NULL            -> NULL (inherit from user preference / system default)
--   - 'store-category' -> ["store", "category", "name"]
--   - 'category'       -> ["category", "name"]
--   - 'alpha'          -> ["name"]
--   - 'date-added'     -> ["date"]
--
-- Column remains nullable: NULL = use default sort preference

-- ============================================================================
-- DROP CHECK CONSTRAINT
-- ============================================================================

ALTER TABLE lists
  DROP CONSTRAINT IF EXISTS lists_sort_mode_check;

-- ============================================================================
-- RENAME AND CONVERT COLUMN
-- ============================================================================

ALTER TABLE lists
  RENAME COLUMN sort_mode TO sort_config;

ALTER TABLE lists
  ALTER COLUMN sort_config TYPE jsonb
  USING (
    CASE sort_config
      WHEN 'store-category' THEN '["store", "category", "name"]'::jsonb
      WHEN 'category' THEN '["category", "name"]'::jsonb
      WHEN 'alpha' THEN '["name"]'::jsonb
      WHEN 'date-added' THEN '["date"]'::jsonb
      ELSE NULL
    END
  );
