-- Enable REPLICA IDENTITY FULL on shared tables so Supabase Realtime can evaluate
-- RLS SELECT policies for all subscribers when processing UPDATE/DELETE events.
-- Without this, collaborator changes are not broadcast to list owners.

ALTER TABLE items SET REPLICA IDENTITY FULL;
ALTER TABLE lists SET REPLICA IDENTITY FULL;
ALTER TABLE list_shares SET REPLICA IDENTITY FULL;
