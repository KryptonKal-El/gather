-- Add timezone to user profiles for timezone-aware reminder delivery
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC';
