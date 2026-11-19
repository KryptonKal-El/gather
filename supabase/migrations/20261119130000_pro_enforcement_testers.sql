-- Per-account enforcement, so Pro limits can be tried end to end before launch.
--
-- app_settings.pro_enforcement_testers is a JSON array of user ids for whom
-- limits are on even while the global switch is off:
--
--   UPDATE app_settings SET value = '["<user uuid>"]' WHERE key = 'pro_enforcement_testers';
--
-- Because the row holds user ids, app_settings is no longer readable by
-- clients; they call pro_enforced() instead.

DROP POLICY "app_settings_select" ON app_settings;

INSERT INTO app_settings (key, value) VALUES ('pro_enforcement_testers', '[]'::jsonb);

CREATE OR REPLACE FUNCTION pro_enforced_for(target_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value = 'true'::jsonb FROM app_settings WHERE key = 'pro_enforcement'),
    false
  ) OR COALESCE(
    (SELECT value ? target_user::text FROM app_settings WHERE key = 'pro_enforcement_testers'),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION pro_enforced_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION pro_enforced_for(uuid) TO service_role;

-- Whether limits apply to the caller.
CREATE OR REPLACE FUNCTION pro_enforced()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pro_enforced_for(auth.uid());
$$;

-- A plan follows its OWNER on both counts: limits apply if they apply to the
-- owner, and are satisfied by the owner's subscription.
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
    SELECT NOT pro_enforced_for(owner_id) OR is_pro(owner_id)
    FROM meal_plans WHERE id = plan_uuid
  );
$$;

CREATE OR REPLACE FUNCTION meal_plan_has_pro(plan_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_meal_plan_member(plan_uuid) AND (
    SELECT NOT pro_enforced_for(owner_id) OR is_pro(owner_id)
    FROM meal_plans WHERE id = plan_uuid
  );
$$;
