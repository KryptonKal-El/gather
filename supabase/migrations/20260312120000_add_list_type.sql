-- Add type column to lists table
-- Migration: add_list_type
-- Created: 2026-03-12

ALTER TABLE lists
ADD COLUMN type text NOT NULL DEFAULT 'grocery'
CONSTRAINT lists_type_check CHECK (
  type IN ('grocery', 'basic', 'guest_list', 'packing', 'project', 'todo')
);
