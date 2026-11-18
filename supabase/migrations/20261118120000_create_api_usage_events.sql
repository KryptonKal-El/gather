-- Per-call log of the edge functions that hit metered third-party APIs
-- (search-products, search-images, search-recipes, import-recipe-url).
--
-- One row per upstream call, so cost per active user can be measured before
-- pricing Gather Pro and so monthly free quotas can be enforced later. The
-- search text itself is deliberately not stored.

CREATE TABLE api_usage_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- NULL when the caller sent only the anon key (signed out, or an app build
  -- from before clients started sending the session token).
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  function_name text NOT NULL,
  source text NOT NULL,
  operation text NOT NULL,
  ok boolean NOT NULL,
  platform text NOT NULL
);

CREATE INDEX api_usage_events_created_at_idx ON api_usage_events (created_at);
CREATE INDEX api_usage_events_user_created_idx ON api_usage_events (user_id, created_at);

-- No policies: only the service role (edge functions, dashboard SQL) reads or writes.
ALTER TABLE api_usage_events ENABLE ROW LEVEL SECURITY;
