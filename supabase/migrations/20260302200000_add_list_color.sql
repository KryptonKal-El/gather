-- Add color column to lists table for list color feature
ALTER TABLE lists ADD COLUMN color text NOT NULL DEFAULT '#1565c0';
