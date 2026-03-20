-- Create notification triggers using pg_net to call the send-notification edge function
-- Migration: create_notification_triggers
-- Created: 2026-03-21

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if a list has any notification subscribers
CREATE OR REPLACE FUNCTION has_notification_subscribers(p_list_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM list_notification_preferences WHERE list_id = p_list_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

-- Notify when a new item is added to a list
CREATE OR REPLACE FUNCTION notify_on_item_insert()
RETURNS trigger AS $$
BEGIN
  IF NOT has_notification_subscribers(NEW.list_id) THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://nvumgewnllqxzpaxubya.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'a26a9813f1e5f54c5df2f3027e6973385b61c4885128753177b0bed9782f7565'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'items',
      'schema', 'public',
      'record', jsonb_build_object(
        'id', NEW.id,
        'name', NEW.name,
        'list_id', NEW.list_id,
        'quantity', NEW.quantity
      ),
      'old_record', null,
      'actor_id', auth.uid()
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify when an item is checked off
CREATE OR REPLACE FUNCTION notify_on_item_check()
RETURNS trigger AS $$
BEGIN
  IF NOT (NEW.is_checked = true AND (OLD.is_checked IS DISTINCT FROM NEW.is_checked)) THEN
    RETURN NEW;
  END IF;

  IF NOT has_notification_subscribers(NEW.list_id) THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://nvumgewnllqxzpaxubya.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'a26a9813f1e5f54c5df2f3027e6973385b61c4885128753177b0bed9782f7565'
    ),
    body := jsonb_build_object(
      'type', 'UPDATE',
      'table', 'items',
      'schema', 'public',
      'record', jsonb_build_object(
        'id', NEW.id,
        'name', NEW.name,
        'list_id', NEW.list_id,
        'is_checked', NEW.is_checked
      ),
      'old_record', jsonb_build_object(
        'id', OLD.id,
        'is_checked', OLD.is_checked
      ),
      'actor_id', auth.uid()
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify when an item's RSVP status changes
CREATE OR REPLACE FUNCTION notify_on_rsvp_change()
RETURNS trigger AS $$
BEGIN
  IF NOT (OLD.rsvp_status IS DISTINCT FROM NEW.rsvp_status) THEN
    RETURN NEW;
  END IF;

  IF NOT has_notification_subscribers(NEW.list_id) THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://nvumgewnllqxzpaxubya.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'a26a9813f1e5f54c5df2f3027e6973385b61c4885128753177b0bed9782f7565'
    ),
    body := jsonb_build_object(
      'type', 'UPDATE',
      'table', 'items',
      'schema', 'public',
      'record', jsonb_build_object(
        'id', NEW.id,
        'name', NEW.name,
        'list_id', NEW.list_id,
        'rsvp_status', NEW.rsvp_status
      ),
      'old_record', jsonb_build_object(
        'id', OLD.id,
        'rsvp_status', OLD.rsvp_status
      ),
      'actor_id', auth.uid()
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify when a new collaborator joins a list
CREATE OR REPLACE FUNCTION notify_on_collaborator_join()
RETURNS trigger AS $$
BEGIN
  IF NOT has_notification_subscribers(NEW.list_id) THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://nvumgewnllqxzpaxubya.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'a26a9813f1e5f54c5df2f3027e6973385b61c4885128753177b0bed9782f7565'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'list_shares',
      'schema', 'public',
      'record', jsonb_build_object(
        'list_id', NEW.list_id,
        'shared_with_email', NEW.shared_with_email
      ),
      'old_record', null,
      'actor_id', auth.uid()
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER trigger_notify_item_insert
  AFTER INSERT ON items
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_item_insert();

CREATE TRIGGER trigger_notify_item_check
  AFTER UPDATE OF is_checked ON items
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_item_check();

CREATE TRIGGER trigger_notify_rsvp_change
  AFTER UPDATE OF rsvp_status ON items
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_rsvp_change();

CREATE TRIGGER trigger_notify_collaborator_join
  AFTER INSERT ON list_shares
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_collaborator_join();
