-- Add rsvp_status column to items table
-- Migration: add_rsvp_status
-- Created: 2026-03-12

ALTER TABLE items
ADD COLUMN rsvp_status text DEFAULT NULL
CONSTRAINT items_rsvp_status_check CHECK (
  rsvp_status IS NULL OR rsvp_status IN ('invited', 'confirmed', 'declined', 'maybe')
);
