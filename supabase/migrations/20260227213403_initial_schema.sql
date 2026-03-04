-- Gather Initial Database Schema
-- Migration: initial_schema
-- Created: 2026-02-27

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. profiles - User profiles linked to auth.users
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name text,
  email text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- 2. stores - User-defined stores with categories
CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  color text,
  categories jsonb DEFAULT '[]',
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. lists - Shopping lists owned by users
CREATE TABLE lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  emoji text,
  item_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 4. list_shares - Sharing lists with other users by email
CREATE TABLE list_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  shared_with_email text NOT NULL,
  added_at timestamptz DEFAULT now()
);

-- 5. items - Items within shopping lists
CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  category text,
  is_checked boolean DEFAULT false,
  store_id uuid REFERENCES stores(id) ON DELETE SET NULL,
  quantity int DEFAULT 1,
  price numeric,
  image_url text,
  added_at timestamptz DEFAULT now()
);

-- 6. history - User's item history for autocomplete
CREATE TABLE history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  added_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_lists_owner_id ON lists(owner_id);
CREATE INDEX idx_list_shares_shared_with_email ON list_shares(shared_with_email);
CREATE INDEX idx_list_shares_list_id ON list_shares(list_id);
CREATE INDEX idx_items_list_id ON items(list_id);
CREATE INDEX idx_history_user_id ON history(user_id);
CREATE INDEX idx_stores_user_id ON stores(user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call handle_new_user on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Atomically increment/decrement item_count on a list
-- Replaces Firestore's increment() functionality
CREATE OR REPLACE FUNCTION increment_item_count(p_list_id uuid, amount int)
RETURNS void AS $$
BEGIN
  UPDATE lists
  SET item_count = item_count + amount
  WHERE id = p_list_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- REALTIME
-- ============================================================================

-- Enable realtime for tables that need subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE stores;
ALTER PUBLICATION supabase_realtime ADD TABLE lists;
ALTER PUBLICATION supabase_realtime ADD TABLE list_shares;
ALTER PUBLICATION supabase_realtime ADD TABLE items;
ALTER PUBLICATION supabase_realtime ADD TABLE history;
