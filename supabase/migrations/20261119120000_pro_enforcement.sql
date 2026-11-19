-- Launch switch and meal plan gating for Gather Lists Pro.
--
-- app_settings.pro_enforcement is the one switch that turns Pro limits on, for
-- the database, the edge functions and the apps alike. It starts off, so this
-- migration changes nothing until the row is set to true:
--
--   UPDATE app_settings SET value = 'true' WHERE key = 'pro_enforcement';

CREATE TABLE app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Readable by everyone, including signed-out clients; writable only by the
-- service role and dashboard SQL (no write policies).
CREATE POLICY "app_settings_select" ON app_settings
  FOR SELECT USING (true);

INSERT INTO app_settings (key, value) VALUES ('pro_enforcement', 'false'::jsonb);

CREATE OR REPLACE FUNCTION pro_enforced()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value = 'true'::jsonb FROM app_settings WHERE key = 'pro_enforcement'),
    false
  );
$$;

-- The meal plan is a Pro feature of the plan's OWNER: once enforcement is on,
-- a plan can be changed only while its owner has Pro, and then by every writer
-- on it, so free collaborators keep full use of a Pro owner's plan. Reading is
-- never restricted, so nobody loses sight of what they already planned.
--
-- Every meal plan write policy (entries, deals, feedback, plan settings) goes
-- through this function, so redefining it gates them all.
CREATE OR REPLACE FUNCTION can_write_meal_plan(plan_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    is_meal_plan_owner(plan_uuid) OR EXISTS (
      SELECT 1 FROM meal_plan_shares
      WHERE meal_plan_id = plan_uuid
      AND lower(shared_with_email) = lower(auth.jwt() ->> 'email')
      AND permission = 'write'
    )
  ) AND (
    NOT pro_enforced()
    OR is_pro((SELECT owner_id FROM meal_plans WHERE id = plan_uuid))
  );
$$;

-- Lets a client ask whether a plan is currently editable for Pro reasons,
-- without exposing is_pro for arbitrary users.
CREATE OR REPLACE FUNCTION meal_plan_has_pro(plan_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_meal_plan_member(plan_uuid) AND (
    NOT pro_enforced()
    OR is_pro((SELECT owner_id FROM meal_plans WHERE id = plan_uuid))
  );
$$;
