-- PRD: List Category Management
-- US-004: Database - Remove categories column from stores
--
-- This migration removes the now-obsolete categories column from the stores table.
-- The category data was already migrated to lists.categories and user_category_defaults
-- in US-003 (20260320120002_migrate_store_categories_to_lists.sql).

ALTER TABLE stores DROP COLUMN IF EXISTS categories;
