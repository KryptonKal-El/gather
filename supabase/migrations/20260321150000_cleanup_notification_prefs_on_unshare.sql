-- Clean up notification preferences when a list is unshared
-- Migration: cleanup_notification_prefs_on_unshare
-- Created: 2026-03-21

-- ============================================================================
-- TRIGGER FUNCTION
-- ============================================================================

-- When a list_shares row is deleted, remove the corresponding notification preferences
CREATE OR REPLACE FUNCTION cleanup_notification_prefs_on_unshare()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Look up user by email
  SELECT id INTO v_user_id
  FROM profiles
  WHERE email = OLD.shared_with_email;

  -- If user found, delete their notification preferences for this list
  IF v_user_id IS NOT NULL THEN
    DELETE FROM list_notification_preferences
    WHERE user_id = v_user_id AND list_id = OLD.list_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER
-- ============================================================================

CREATE TRIGGER trigger_cleanup_prefs_on_unshare
  AFTER DELETE ON list_shares
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_notification_prefs_on_unshare();
