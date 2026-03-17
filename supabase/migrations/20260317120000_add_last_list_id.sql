-- Add last_list_id column to user_preferences for persisting last-selected list
ALTER TABLE user_preferences
  ADD COLUMN last_list_id uuid REFERENCES lists(id) ON DELETE SET NULL;
