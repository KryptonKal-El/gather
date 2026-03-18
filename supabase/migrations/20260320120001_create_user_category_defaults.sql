-- User Category Defaults Table for storing default categories per list type
-- Migration: create_user_category_defaults
-- Created: 2026-03-20

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE user_category_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  list_type text NOT NULL,
  categories jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

ALTER TABLE user_category_defaults
  ADD CONSTRAINT unique_user_list_type UNIQUE (user_id, list_type);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_user_category_defaults_user_id ON user_category_defaults(user_id);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE TRIGGER user_category_defaults_updated_at
  BEFORE UPDATE ON user_category_defaults
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE user_category_defaults ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

CREATE POLICY "user_category_defaults_select_own" ON user_category_defaults
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_category_defaults_insert_own" ON user_category_defaults
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_category_defaults_update_own" ON user_category_defaults
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_category_defaults_delete_own" ON user_category_defaults
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE user_category_defaults;
