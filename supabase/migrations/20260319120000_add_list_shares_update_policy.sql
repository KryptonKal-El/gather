-- Allow shared users to update their own list_shares row (e.g., sort_config).
-- The list owner can also update any share row for their lists.
CREATE POLICY "list_shares_update" ON list_shares
  FOR UPDATE USING (
    shared_with_email = auth.jwt() ->> 'email'
    OR is_list_owner(list_id)
  );
