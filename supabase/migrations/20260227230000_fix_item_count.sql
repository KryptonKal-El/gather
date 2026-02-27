-- Fix CRITICAL-1: Prevent negative item_count and add auto-maintaining triggers

-- Replace increment_item_count to use GREATEST(0, ...) so counts never go negative
CREATE OR REPLACE FUNCTION increment_item_count(p_list_id uuid, amount int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the caller owns or has shared access to the list
  IF NOT EXISTS (
    SELECT 1 FROM lists WHERE id = p_list_id AND owner_id = auth.uid()
    UNION ALL
    SELECT 1 FROM list_shares WHERE list_id = p_list_id AND shared_with_email = (auth.jwt() ->> 'email')
  ) THEN
    RAISE EXCEPTION 'Access denied to list %', p_list_id;
  END IF;

  UPDATE lists
  SET item_count = GREATEST(0, item_count + amount)
  WHERE id = p_list_id;
END;
$$;

-- Trigger: increment item_count on item insert
CREATE OR REPLACE FUNCTION update_item_count_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE lists SET item_count = item_count + 1 WHERE id = NEW.list_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER items_insert_count
  AFTER INSERT ON items
  FOR EACH ROW EXECUTE FUNCTION update_item_count_on_insert();

-- Trigger: decrement item_count on item delete (only if item was unchecked)
CREATE OR REPLACE FUNCTION update_item_count_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT OLD.is_checked THEN
    UPDATE lists SET item_count = GREATEST(0, item_count - 1) WHERE id = OLD.list_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER items_delete_count
  AFTER DELETE ON items
  FOR EACH ROW EXECUTE FUNCTION update_item_count_on_delete();

-- Trigger: adjust item_count when is_checked changes
CREATE OR REPLACE FUNCTION update_item_count_on_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.is_checked = false AND NEW.is_checked = true THEN
    -- Item was checked off: decrement
    UPDATE lists SET item_count = GREATEST(0, item_count - 1) WHERE id = NEW.list_id;
  ELSIF OLD.is_checked = true AND NEW.is_checked = false THEN
    -- Item was unchecked: increment
    UPDATE lists SET item_count = item_count + 1 WHERE id = NEW.list_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER items_check_count
  AFTER UPDATE OF is_checked ON items
  FOR EACH ROW EXECUTE FUNCTION update_item_count_on_check();
