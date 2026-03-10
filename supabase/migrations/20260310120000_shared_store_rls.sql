-- Migration: Shared Store Visibility RLS
-- Purpose: Replace blanket stores_all_own policy with granular per-operation policies
--          that allow users to see stores referenced by items in lists shared with them.
-- Story: US-001 - Refactor Store RLS Policies
-- Date: 2026-03-10

-- Drop the existing blanket policy
DROP POLICY IF EXISTS stores_all_own ON stores;

-- Drop new policies if they exist (idempotent)
DROP POLICY IF EXISTS stores_select_own_or_shared ON stores;
DROP POLICY IF EXISTS stores_insert_own ON stores;
DROP POLICY IF EXISTS stores_update_own ON stores;
DROP POLICY IF EXISTS stores_delete_own ON stores;

-- SELECT: Allow reading own stores OR stores referenced by items in shared lists
CREATE POLICY stores_select_own_or_shared ON stores
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR id IN (
      SELECT DISTINCT i.store_id FROM items i
      JOIN list_shares ls ON ls.list_id = i.list_id
      WHERE ls.shared_with_email = auth.jwt() ->> 'email'
      AND i.store_id IS NOT NULL
    )
  );

-- INSERT: Only allow inserting stores owned by current user
CREATE POLICY stores_insert_own ON stores
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Only allow updating own stores
CREATE POLICY stores_update_own ON stores
  FOR UPDATE
  USING (user_id = auth.uid());

-- DELETE: Only allow deleting own stores
CREATE POLICY stores_delete_own ON stores
  FOR DELETE
  USING (user_id = auth.uid());

-- Index to support the shared stores subquery performance
CREATE INDEX IF NOT EXISTS idx_items_store_id ON items(store_id);
