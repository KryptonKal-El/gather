-- Add sort_config to list_shares so shared users get a forked copy of the
-- owner's sort settings at share time.  NULL means "use my own default".
ALTER TABLE list_shares ADD COLUMN sort_config jsonb;
