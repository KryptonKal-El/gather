-- Collection counterpart of get_list_collaborators (see 20260406140000):
-- 1. Case-insensitive email matching for collaborator lookup
-- 2. For owned collections with no shares, return empty (not just owner)
-- 3. For shared collections, return owner + all recipients (symmetric view)
-- 4. Exclude the calling user from results (you already know you have access)

CREATE OR REPLACE FUNCTION get_collection_collaborators(p_collection_id uuid)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner boolean;
  v_is_shared_with_me boolean;
  v_has_shares boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM collections WHERE id = p_collection_id AND owner_id = auth.uid()
  ) INTO v_is_owner;

  SELECT EXISTS (
    SELECT 1 FROM collection_shares
    WHERE collection_id = p_collection_id AND LOWER(shared_with_email) = LOWER(auth.jwt() ->> 'email')
  ) INTO v_is_shared_with_me;

  IF NOT v_is_owner AND NOT v_is_shared_with_me THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Check if collection has any shares at all
  SELECT EXISTS (
    SELECT 1 FROM collection_shares WHERE collection_id = p_collection_id
  ) INTO v_has_shares;

  -- For private collections (no shares), return empty set
  IF NOT v_has_shares THEN
    RETURN;
  END IF;

  -- For shared collections, return owner + all recipients (symmetric view)
  RETURN QUERY
  SELECT DISTINCT
    p.id,
    COALESCE(p.display_name, split_part(p.email, '@', 1)),
    COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
  FROM collections c
  JOIN profiles p ON c.owner_id = p.id
  JOIN auth.users u ON p.id = u.id
  WHERE c.id = p_collection_id
    AND p.id != auth.uid()
  UNION
  SELECT DISTINCT
    p.id,
    COALESCE(p.display_name, split_part(p.email, '@', 1)),
    COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
  FROM collection_shares cs
  JOIN profiles p ON LOWER(cs.shared_with_email) = LOWER(p.email)
  JOIN auth.users u ON p.id = u.id
  WHERE cs.collection_id = p_collection_id
    AND p.id != auth.uid();
END;
$$;
