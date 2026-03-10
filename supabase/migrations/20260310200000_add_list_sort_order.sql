ALTER TABLE lists ADD COLUMN sort_order int DEFAULT 0;

-- Backfill existing lists with sort_order based on created_at
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at ASC) - 1 AS rn
  FROM lists
)
UPDATE lists SET sort_order = ordered.rn FROM ordered WHERE lists.id = ordered.id;
