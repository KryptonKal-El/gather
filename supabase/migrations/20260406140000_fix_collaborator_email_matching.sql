-- Fix get_list_collaborators to:
-- 1. Use case-insensitive email matching for collaborator lookup
-- 2. For owned lists with no shares, return empty (not just owner)
-- 3. For shared lists, return owner + all recipients (symmetric view)
-- 4. Exclude the calling user from results (you already know you have access)

CREATE OR REPLACE FUNCTION get_list_collaborators(p_list_id uuid)
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
    SELECT 1 FROM lists WHERE id = p_list_id AND owner_id = auth.uid()
  ) INTO v_is_owner;

  SELECT EXISTS (
    SELECT 1 FROM list_shares
    WHERE list_id = p_list_id AND LOWER(shared_with_email) = LOWER(auth.jwt() ->> 'email')
  ) INTO v_is_shared_with_me;

  IF NOT v_is_owner AND NOT v_is_shared_with_me THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Check if list has any shares at all
  SELECT EXISTS (
    SELECT 1 FROM list_shares WHERE list_id = p_list_id
  ) INTO v_has_shares;

  -- For private lists (no shares), return empty set
  IF NOT v_has_shares THEN
    RETURN;
  END IF;

  -- For shared lists, return owner + all recipients (symmetric view)
  RETURN QUERY
  SELECT DISTINCT
    p.id,
    COALESCE(p.display_name, split_part(p.email, '@', 1)),
    COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
  FROM lists l
  JOIN profiles p ON l.owner_id = p.id
  JOIN auth.users u ON p.id = u.id
  WHERE l.id = p_list_id
    AND p.id != auth.uid()
  UNION
  SELECT DISTINCT
    p.id,
    COALESCE(p.display_name, split_part(p.email, '@', 1)),
    COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
  FROM list_shares ls
  JOIN profiles p ON LOWER(ls.shared_with_email) = LOWER(p.email)
  JOIN auth.users u ON p.id = u.id
  WHERE ls.list_id = p_list_id
    AND p.id != auth.uid();
END;
$$;
