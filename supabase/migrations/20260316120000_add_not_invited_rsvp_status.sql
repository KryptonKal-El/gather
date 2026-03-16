-- Add 'not_invited' to the rsvp_status CHECK constraint
-- Migration: add_not_invited_rsvp_status
-- Created: 2026-03-16

ALTER TABLE items
DROP CONSTRAINT items_rsvp_status_check;

ALTER TABLE items
ADD CONSTRAINT items_rsvp_status_check CHECK (
  rsvp_status IS NULL OR rsvp_status IN ('invited', 'confirmed', 'declined', 'maybe', 'not_invited')
);
