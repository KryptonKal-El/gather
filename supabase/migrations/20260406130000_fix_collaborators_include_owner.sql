-- Fix get_list_collaborators to return symmetric collaborator set
-- Owner view was missing the owner themselves; now both views return owner + all recipients

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

  -- Both owner and recipients see the same complete set: owner + all recipients
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
END;
$$;
