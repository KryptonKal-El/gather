-- Add unit column to items table for measurement support (e.g., cups, lbs, oz)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'items' AND column_name = 'unit'
    ) THEN
        ALTER TABLE items ADD COLUMN unit text NOT NULL DEFAULT 'each';
    END IF;
END $$;
