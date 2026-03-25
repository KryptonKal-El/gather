-- Add created_by column to track which user created/added the item
ALTER TABLE items ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Backfill existing items with list owner as created_by (best guess for historical data)
UPDATE items SET created_by = lists.owner_id
FROM lists
WHERE items.list_id = lists.id AND items.created_by IS NULL;
