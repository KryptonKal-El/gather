-- Add categories column to lists table for custom category management.
-- NULL means "use system defaults for the list type" (transitional state).
-- 
-- JSONB schema: [{ key: string, name: string, color: string, keywords: string[] }]
-- Example: [{"key": "produce", "name": "Produce", "color": "#4CAF50", "keywords": ["apple", "banana"]}]

ALTER TABLE lists
ADD COLUMN categories jsonb DEFAULT NULL;

COMMENT ON COLUMN lists.categories IS 'Custom categories for this list. NULL = use system defaults for list type. Schema: [{key, name, color, keywords}]';
