-- Wish List list type (Phase 1)
--
-- * Allows lists.type = 'wish_list'.
-- * Adds items.url (product link) and items.priority (must / want / nice).
-- * Both are reusable item attributes, so they are mirrored into `history` and
--   the edit-sync trigger, per docs/memory/history-mirrors-items.md.

ALTER TABLE lists DROP CONSTRAINT IF EXISTS lists_type_check;
ALTER TABLE lists ADD CONSTRAINT lists_type_check CHECK (
  type IN ('grocery', 'basic', 'guest_list', 'packing', 'project', 'todo', 'wish_list')
);

ALTER TABLE items ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE items ADD COLUMN IF NOT EXISTS priority text;
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_priority_check;
ALTER TABLE items ADD CONSTRAINT items_priority_check CHECK (
  priority IS NULL OR priority IN ('must', 'want', 'nice')
);

ALTER TABLE history ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE history ADD COLUMN IF NOT EXISTS priority text;

CREATE OR REPLACE FUNCTION sync_item_to_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Sub-items never appear as suggestions, so they have no history to sync.
  IF NEW.parent_item_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE history SET
      name = NEW.name,
      image_url = NEW.image_url,
      category = NEW.category,
      store_id = NEW.store_id,
      quantity = NEW.quantity,
      price = NEW.price,
      unit = NEW.unit,
      note = NEW.note,
      url = NEW.url,
      priority = NEW.priority
    WHERE list_id = NEW.list_id AND name = OLD.name;
  ELSE
    UPDATE history SET
      image_url = NEW.image_url,
      category = NEW.category,
      store_id = NEW.store_id,
      quantity = NEW.quantity,
      price = NEW.price,
      unit = NEW.unit,
      note = NEW.note,
      url = NEW.url,
      priority = NEW.priority
    WHERE list_id = NEW.list_id AND name = NEW.name;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_item_to_history ON items;
CREATE TRIGGER trg_sync_item_to_history
AFTER UPDATE OF name, image_url, category, store_id, quantity, price, unit, note, url, priority ON items
FOR EACH ROW
EXECUTE FUNCTION sync_item_to_history();
