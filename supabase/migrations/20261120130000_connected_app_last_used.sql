-- When each app connected to the caller's account was last active.
--
-- Supabase Auth's grants API only reports when an app was connected. Its
-- sessions table records each time an app's access is renewed, which happens
-- about hourly while the app is in use, so the newest renewal is a good
-- "last used" time. Clients can't read the auth schema, hence this function.

CREATE FUNCTION connected_app_last_used()
RETURNS TABLE (client_id text, last_used_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    s.oauth_client_id::text,
    -- refreshed_at is stored without a time zone, in UTC.
    max(greatest(s.updated_at, s.refreshed_at AT TIME ZONE 'UTC', s.created_at))
  FROM auth.sessions s
  WHERE s.user_id = auth.uid()
    AND s.oauth_client_id IS NOT NULL
  GROUP BY s.oauth_client_id;
$$;

REVOKE EXECUTE ON FUNCTION connected_app_last_used() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION connected_app_last_used() TO authenticated;
