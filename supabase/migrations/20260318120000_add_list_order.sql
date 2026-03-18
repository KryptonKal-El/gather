-- Add list_order column to user_preferences for cross-device list ordering sync
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS list_order jsonb DEFAULT '[]'::jsonb;
