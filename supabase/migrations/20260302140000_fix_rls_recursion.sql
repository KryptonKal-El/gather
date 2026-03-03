-- Fix RLS Infinite Recursion (PostgreSQL error 42P17)
-- Migration: fix_rls_recursion
-- Created: 2026-03-02
--
-- PROBLEM: The original RLS policies created circular dependencies:
--   - `lists` policies query `list_shares` (to check if shared with user)
--   - `list_shares` policies query `lists` (to check if user owns the list)
--   - `items` policies query `lists` (which triggers `list_shares` check)
--
-- When Postgres evaluates RLS on one table, it triggers RLS evaluation on the
-- referenced table, causing infinite recursion.
--
-- SOLUTION: Create SECURITY DEFINER helper functions that bypass RLS when
-- checking ownership/sharing. These functions run with elevated privileges
-- (as the function owner, typically the superuser who ran the migration)
-- so they can query the underlying tables without triggering RLS checks.

-- ============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER to bypass RLS)
-- ============================================================================

-- Check if current user owns the specified list
-- Uses SECURITY DEFINER to bypass RLS on the lists table
CREATE OR REPLACE FUNCTION is_list_owner(p_list_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM lists WHERE id = p_list_id AND owner_id = auth.uid()
  );
$$;

-- Check if current user has been granted access to the specified list
-- Uses SECURITY DEFINER to bypass RLS on the list_shares table
CREATE OR REPLACE FUNCTION is_list_shared_with_me(p_list_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM list_shares
    WHERE list_id = p_list_id
    AND shared_with_email = auth.jwt() ->> 'email'
  );
$$;

-- ============================================================================
-- RECREATE LISTS POLICIES (remove direct list_shares references)
-- ============================================================================

DROP POLICY IF EXISTS "lists_select_own_or_shared" ON lists;
CREATE POLICY "lists_select_own_or_shared" ON lists
  FOR SELECT USING (
    owner_id = auth.uid()
    OR is_list_shared_with_me(id)
  );

DROP POLICY IF EXISTS "lists_update_own_or_shared" ON lists;
CREATE POLICY "lists_update_own_or_shared" ON lists
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR is_list_shared_with_me(id)
  );

-- NOTE: lists_insert_own and lists_delete_own don't reference list_shares,
-- so they don't need to be changed.

-- ============================================================================
-- RECREATE LIST_SHARES POLICIES (remove direct lists references)
-- ============================================================================

DROP POLICY IF EXISTS "list_shares_select" ON list_shares;
CREATE POLICY "list_shares_select" ON list_shares
  FOR SELECT USING (
    shared_with_email = auth.jwt() ->> 'email'
    OR is_list_owner(list_id)
  );

DROP POLICY IF EXISTS "list_shares_insert" ON list_shares;
CREATE POLICY "list_shares_insert" ON list_shares
  FOR INSERT WITH CHECK (
    is_list_owner(list_id)
  );

DROP POLICY IF EXISTS "list_shares_delete" ON list_shares;
CREATE POLICY "list_shares_delete" ON list_shares
  FOR DELETE USING (
    is_list_owner(list_id)
  );

-- ============================================================================
-- RECREATE ITEMS POLICIES (use helper functions instead of nested queries)
-- ============================================================================

DROP POLICY IF EXISTS "items_select" ON items;
CREATE POLICY "items_select" ON items
  FOR SELECT USING (
    is_list_owner(list_id) OR is_list_shared_with_me(list_id)
  );

DROP POLICY IF EXISTS "items_insert" ON items;
CREATE POLICY "items_insert" ON items
  FOR INSERT WITH CHECK (
    is_list_owner(list_id) OR is_list_shared_with_me(list_id)
  );

DROP POLICY IF EXISTS "items_update" ON items;
CREATE POLICY "items_update" ON items
  FOR UPDATE USING (
    is_list_owner(list_id) OR is_list_shared_with_me(list_id)
  );

DROP POLICY IF EXISTS "items_delete" ON items;
CREATE POLICY "items_delete" ON items
  FOR DELETE USING (
    is_list_owner(list_id) OR is_list_shared_with_me(list_id)
  );
