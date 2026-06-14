-- Add free-text note column to items, shown under the item name on the row
ALTER TABLE items ADD COLUMN IF NOT EXISTS note text;
