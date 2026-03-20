-- Create device_tokens table for push notification tokens
CREATE TABLE device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'ios',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one token per user
ALTER TABLE device_tokens ADD CONSTRAINT device_tokens_user_token_unique UNIQUE (user_id, token);

-- Index for lookups by user
CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);

-- Create list_notification_preferences table
CREATE TABLE list_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  item_added boolean NOT NULL DEFAULT false,
  item_checked boolean NOT NULL DEFAULT false,
  rsvp_changed boolean NOT NULL DEFAULT false,
  collaborator_joined boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one preference row per user per list
ALTER TABLE list_notification_preferences ADD CONSTRAINT list_notif_prefs_user_list_unique UNIQUE (user_id, list_id);

-- Indexes
CREATE INDEX idx_list_notif_prefs_user_id ON list_notification_preferences(user_id);
CREATE INDEX idx_list_notif_prefs_list_id ON list_notification_preferences(list_id);

-- Enable RLS on device_tokens
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own device tokens"
  ON device_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own device tokens"
  ON device_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own device tokens"
  ON device_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own device tokens"
  ON device_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Enable RLS on list_notification_preferences
ALTER TABLE list_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification preferences"
  ON list_notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
  ON list_notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON list_notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification preferences"
  ON list_notification_preferences FOR DELETE
  USING (auth.uid() = user_id);
