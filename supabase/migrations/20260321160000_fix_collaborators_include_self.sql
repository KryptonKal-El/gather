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
    SELECT DISTINCT p.id, p.display_name, p.avatar_url
    FROM list_shares ls
    JOIN profiles p ON ls.shared_with_email = p.email
    WHERE ls.list_id = p_list_id;
  ELSE
    -- Return owner + all collaborators (including self)
    RETURN QUERY
    SELECT DISTINCT p.id, p.display_name, p.avatar_url
    FROM lists l
    JOIN profiles p ON l.owner_id = p.id
    WHERE l.id = p_list_id
    UNION
    SELECT DISTINCT p.id, p.display_name, p.avatar_url
    FROM list_shares ls
    JOIN profiles p ON ls.shared_with_email = p.email
    WHERE ls.list_id = p_list_id;
  END IF;
END;
$$;
