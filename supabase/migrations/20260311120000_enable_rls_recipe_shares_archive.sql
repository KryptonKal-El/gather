-- Enable RLS on archived recipe_shares table to satisfy Security Advisor.
-- No policies are added — with RLS enabled and zero policies, the table
-- is effectively inaccessible, which is correct for an unused archive.
ALTER TABLE recipe_shares_archive ENABLE ROW LEVEL SECURITY;
