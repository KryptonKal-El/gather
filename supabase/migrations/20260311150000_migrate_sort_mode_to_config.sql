-- Migrate default_sort_mode (text) to default_sort_config (jsonb)
-- Migration: migrate_sort_mode_to_config
-- Created: 2026-03-11
--
-- This migration evolves the user_preferences table from v1 (text enum) to v2 (jsonb array):
--   - 'store-category' -> ["store", "category", "name"]
--   - 'category'       -> ["category", "name"]
--   - 'alpha'          -> ["name"]
--   - 'date-added'     -> ["date"]

-- ============================================================================
-- DROP CHECK CONSTRAINT
-- ============================================================================

ALTER TABLE user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_default_sort_mode_check;

-- ============================================================================
-- DROP DEFAULT BEFORE TYPE CHANGE
-- ============================================================================

ALTER TABLE user_preferences
  ALTER COLUMN default_sort_mode DROP DEFAULT;

-- ============================================================================
-- RENAME AND CONVERT COLUMN
-- ============================================================================

ALTER TABLE user_preferences
  RENAME COLUMN default_sort_mode TO default_sort_config;

ALTER TABLE user_preferences
  ALTER COLUMN default_sort_config TYPE jsonb
  USING (
    CASE default_sort_config
      WHEN 'store-category' THEN '["store", "category", "name"]'::jsonb
      WHEN 'category' THEN '["category", "name"]'::jsonb
      WHEN 'alpha' THEN '["name"]'::jsonb
      WHEN 'date-added' THEN '["date"]'::jsonb
      ELSE '["store", "category", "name"]'::jsonb
    END
  );

-- ============================================================================
-- SET NEW DEFAULT
-- ============================================================================

ALTER TABLE user_preferences
  ALTER COLUMN default_sort_config SET DEFAULT '["store", "category", "name"]'::jsonb;

-- ============================================================================
-- ENSURE NOT NULL (confirm constraint persists)
-- ============================================================================

ALTER TABLE user_preferences
  ALTER COLUMN default_sort_config SET NOT NULL;
