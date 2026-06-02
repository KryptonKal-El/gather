-- Gather: List-Scoped Stores Migration
-- Migration: list_scoped_stores
-- Created: 2026-06-01
-- 
-- Transforms stores from per-user ownership to per-list ownership.
-- All downstream code relies on stores.list_id as the ownership key.
-- Collaborators on a shared list see and can manage the same stores.

-- ============================================================================
-- STEP 1: Add list_id column as nullable (for data migration)
-- ============================================================================

ALTER TABLE stores
ADD COLUMN list_id uuid REFERENCES lists(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 2: Create user_store_defaults table (for preserving user defaults)
-- ============================================================================

CREATE TABLE user_store_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  list_type text NOT NULL,
  name text NOT NULL,
  color text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- STEP 3: Data migration - copy stores to user_store_defaults
-- ============================================================================

INSERT INTO user_store_defaults (user_id, list_type, name, color, sort_order, created_at)
SELECT user_id, 'grocery', name, color, sort_order, created_at
FROM stores
WHERE user_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Delete all rows from stores (they have no list_id and cannot be migrated)
-- ============================================================================

DELETE FROM stores;

-- ============================================================================
-- STEP 5: Drop old RLS policies on stores (user-scoped)
-- ============================================================================

DROP POLICY IF EXISTS "stores_all_own" ON stores;
DROP POLICY IF EXISTS "stores_select_own_or_shared" ON stores;
DROP POLICY IF EXISTS "stores_insert_own" ON stores;
DROP POLICY IF EXISTS "stores_update_own" ON stores;
DROP POLICY IF EXISTS "stores_delete_own" ON stores;

-- ============================================================================
-- STEP 6: Set list_id as NOT NULL
-- ============================================================================

ALTER TABLE stores
ALTER COLUMN list_id SET NOT NULL;

-- ============================================================================
-- STEP 7: Drop user_id column from stores
-- ============================================================================

ALTER TABLE stores
DROP COLUMN user_id;

-- ============================================================================
-- STEP 8: Add indexes for new schema
-- ============================================================================

CREATE INDEX idx_stores_list_id ON stores(list_id);
CREATE INDEX idx_user_store_defaults_user_id ON user_store_defaults(user_id);

-- ============================================================================
-- STEP 9: Add new RLS policies on stores (list-scoped)
-- ============================================================================

-- SELECT: list owner OR collaborator
CREATE POLICY "stores_select" ON stores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = stores.list_id
      AND (
        lists.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM list_shares
          WHERE list_shares.list_id = lists.id
          AND list_shares.shared_with_email = auth.jwt() ->> 'email'
        )
      )
    )
  );

-- INSERT: list owner OR collaborator
CREATE POLICY "stores_insert" ON stores
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = stores.list_id
      AND (
        lists.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM list_shares
          WHERE list_shares.list_id = lists.id
          AND list_shares.shared_with_email = auth.jwt() ->> 'email'
        )
      )
    )
  );

-- UPDATE: list owner OR collaborator
CREATE POLICY "stores_update" ON stores
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = stores.list_id
      AND (
        lists.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM list_shares
          WHERE list_shares.list_id = lists.id
          AND list_shares.shared_with_email = auth.jwt() ->> 'email'
        )
      )
    )
  );

-- DELETE: list owner OR collaborator
CREATE POLICY "stores_delete" ON stores
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = stores.list_id
      AND (
        lists.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM list_shares
          WHERE list_shares.list_id = lists.id
          AND list_shares.shared_with_email = auth.jwt() ->> 'email'
        )
      )
    )
  );

-- ============================================================================
-- STEP 10: Add RLS to user_store_defaults table
-- ============================================================================

ALTER TABLE user_store_defaults ENABLE ROW LEVEL SECURITY;

-- All operations require user_id = auth.uid()
CREATE POLICY "user_store_defaults_all_own" ON user_store_defaults
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- STEP 11: Enable realtime for user_store_defaults
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE user_store_defaults;
