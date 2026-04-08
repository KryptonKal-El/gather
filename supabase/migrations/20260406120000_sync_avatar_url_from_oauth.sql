-- Sync avatar_url from OAuth metadata to profiles table
-- This fixes collaborator avatars not showing on shared lists

-- 1. Update handle_new_user() to also sync avatar_url from OAuth metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Backfill avatar_url for existing users whose profiles.avatar_url is null
-- but have one in auth.users.raw_user_meta_data
UPDATE profiles
SET avatar_url = u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
WHERE profiles.id = u.id
  AND profiles.avatar_url IS NULL
  AND u.raw_user_meta_data->>'avatar_url' IS NOT NULL;

-- 3. Update get_list_collaborators to fall back to auth.users metadata
-- in case profiles.avatar_url is still null
CREATE OR REPLACE FUNCTION get_list_collaborators(p_list_id uuid)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner boolean;
  v_is_shared_with_me boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM lists WHERE id = p_list_id AND owner_id = auth.uid()
  ) INTO v_is_owner;

  SELECT EXISTS (
    SELECT 1 FROM list_shares
    WHERE list_id = p_list_id AND shared_with_email = auth.jwt() ->> 'email'
  ) INTO v_is_shared_with_me;

  IF NOT v_is_owner AND NOT v_is_shared_with_me THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_is_owner THEN
    -- Return all people this list is shared with
    RETURN QUERY
    SELECT DISTINCT
      p.id,
      COALESCE(p.display_name, split_part(p.email, '@', 1)),
      COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
    FROM list_shares ls
    JOIN profiles p ON ls.shared_with_email = p.email
    JOIN auth.users u ON p.id = u.id
    WHERE ls.list_id = p_list_id;
  ELSE
    -- Return owner + all collaborators (including self)
    RETURN QUERY
    SELECT DISTINCT
      p.id,
      COALESCE(p.display_name, split_part(p.email, '@', 1)),
      COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
    FROM lists l
    JOIN profiles p ON l.owner_id = p.id
    JOIN auth.users u ON p.id = u.id
    WHERE l.id = p_list_id
    UNION
    SELECT DISTINCT
      p.id,
      COALESCE(p.display_name, split_part(p.email, '@', 1)),
      COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
    FROM list_shares ls
    JOIN profiles p ON ls.shared_with_email = p.email
    JOIN auth.users u ON p.id = u.id
    WHERE ls.list_id = p_list_id;
  END IF;
END;
$$;
