-- Backfill display_name from auth.users metadata for existing users
-- This is a one-time migration for users who signed in with Apple before
-- the app started syncing display_name to the profiles table.

UPDATE profiles
SET display_name = u.raw_user_meta_data->>'full_name'
FROM auth.users u
WHERE profiles.id = u.id
  AND profiles.display_name IS NULL
  AND u.raw_user_meta_data->>'full_name' IS NOT NULL;
