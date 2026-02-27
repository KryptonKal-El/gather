-- ShoppingListAI Row Level Security Policies
-- Migration: rls_policies
-- Created: 2026-02-27

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

ALTER TABLE list_shares ADD CONSTRAINT unique_list_share UNIQUE (list_id, shared_with_email);

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ============================================================================
-- STORES POLICIES
-- ============================================================================

CREATE POLICY "stores_all_own" ON stores
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- LISTS POLICIES
-- ============================================================================

CREATE POLICY "lists_select_own_or_shared" ON lists
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM list_shares
      WHERE list_shares.list_id = lists.id
      AND list_shares.shared_with_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "lists_insert_own" ON lists
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "lists_update_own_or_shared" ON lists
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM list_shares
      WHERE list_shares.list_id = lists.id
      AND list_shares.shared_with_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "lists_delete_own" ON lists
  FOR DELETE USING (owner_id = auth.uid());

-- ============================================================================
-- LIST_SHARES POLICIES
-- ============================================================================

CREATE POLICY "list_shares_select" ON list_shares
  FOR SELECT USING (
    shared_with_email = auth.jwt() ->> 'email'
    OR EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_shares.list_id
      AND lists.owner_id = auth.uid()
    )
  );

CREATE POLICY "list_shares_insert" ON list_shares
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_shares.list_id
      AND lists.owner_id = auth.uid()
    )
  );

CREATE POLICY "list_shares_delete" ON list_shares
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_shares.list_id
      AND lists.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- ITEMS POLICIES
-- ============================================================================

CREATE POLICY "items_select" ON items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = items.list_id
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

CREATE POLICY "items_insert" ON items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = items.list_id
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

CREATE POLICY "items_update" ON items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = items.list_id
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

CREATE POLICY "items_delete" ON items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = items.list_id
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
-- HISTORY POLICIES
-- ============================================================================

CREATE POLICY "history_all_own" ON history
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- UPDATE INCREMENT_ITEM_COUNT FUNCTION WITH ACCESS CHECK
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_item_count(p_list_id uuid, amount int)
RETURNS void AS $$
BEGIN
  -- Verify the caller has access to this list (owns it or it's shared with them)
  IF NOT EXISTS (
    SELECT 1 FROM lists
    WHERE id = p_list_id
    AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM list_shares
        WHERE list_id = p_list_id
        AND shared_with_email = auth.jwt() ->> 'email'
      )
    )
  ) THEN
    RAISE EXCEPTION 'Access denied: list %', p_list_id;
  END IF;

  UPDATE lists
  SET item_count = item_count + amount
  WHERE id = p_list_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
