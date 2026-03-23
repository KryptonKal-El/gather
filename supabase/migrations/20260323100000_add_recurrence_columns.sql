-- Add recurrence and due date columns to items table
-- Migration: add_recurrence_columns
-- Created: 2026-03-23

-- ============================================================================
-- NEW COLUMNS
-- ============================================================================

-- Due date for time-sensitive items
ALTER TABLE items ADD COLUMN IF NOT EXISTS due_date date;

-- Structured recurrence rule (e.g., {"type": "weekly", "interval": 1, "daysOfWeek": [1,3,5]})
ALTER TABLE items ADD COLUMN IF NOT EXISTS recurrence_rule jsonb;

-- Days before due_date to trigger reminder (0 = same day)
ALTER TABLE items ADD COLUMN IF NOT EXISTS reminder_days_before integer;

-- Timestamp when item was checked off (for recurrence history)
ALTER TABLE items ADD COLUMN IF NOT EXISTS checked_at timestamptz;

-- Self-referential FK: links recurrence instances to their predecessor
ALTER TABLE items ADD COLUMN IF NOT EXISTS parent_item_id uuid REFERENCES items(id) ON DELETE SET NULL;

-- Tracks when reminder was sent (prevents duplicate notifications)
ALTER TABLE items ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Efficient queries for items by due date (sorting, filtering overdue items)
CREATE INDEX IF NOT EXISTS idx_items_due_date ON items(due_date);

-- Lookup completion history via parent chain
CREATE INDEX IF NOT EXISTS idx_items_parent_item_id ON items(parent_item_id);
