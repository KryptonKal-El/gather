-- Weekly meal planning.
--
-- meal_plans is a household plan: one owner, shared with others by email via
-- meal_plan_shares (same model as collections / collection_shares). Every
-- member reads and writes the same week.
--
-- meal_plan_entries is one meal slot: (plan, date, meal) is unique. A slot is
-- either a recipe, or a non-recipe marker: eating out, leftovers, skip, or a
-- custom free-text meal. `title` snapshots the recipe name so a slot still
-- reads correctly if the recipe is later deleted (recipe_id SET NULL).
--
-- Members can read recipes planned in a plan they belong to, even when the
-- recipe lives in a collection that isn't shared with them — otherwise a
-- household member couldn't open, cook, or shop for a planned meal.
--
-- Finishing a cook marks the matching planned slot (same recipe, same local
-- day in the cook's profile timezone) as cooked.

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT 'Meal Plan',
  enabled_meals text[] NOT NULL DEFAULT ARRAY['breakfast', 'lunch', 'dinner'],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meal_plans_enabled_meals_valid
    CHECK (enabled_meals <@ ARRAY['breakfast', 'lunch', 'dinner'])
);

CREATE TABLE meal_plan_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id uuid REFERENCES meal_plans(id) ON DELETE CASCADE NOT NULL,
  shared_with_email text NOT NULL,
  shared_by uuid REFERENCES profiles(id) NOT NULL,
  permission text NOT NULL DEFAULT 'write' CHECK (permission IN ('read', 'write')),
  added_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_meal_plan_share UNIQUE (meal_plan_id, shared_with_email)
);

CREATE TABLE meal_plan_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id uuid REFERENCES meal_plans(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  meal text NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner')),
  kind text NOT NULL CHECK (kind IN ('recipe', 'eating_out', 'leftovers', 'skip', 'custom')),
  recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL,
  title text,
  note text,
  is_locked boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'suggested')),
  cooked_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_meal_plan_slot UNIQUE (meal_plan_id, date, meal)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- One owned plan per person (they can still be a member of others). Also stops two
-- devices opening the Plan tab at once from each creating a plan.
CREATE UNIQUE INDEX idx_meal_plans_one_per_owner ON meal_plans(owner_id);
CREATE INDEX idx_meal_plan_shares_meal_plan_id ON meal_plan_shares(meal_plan_id);
CREATE INDEX idx_meal_plan_shares_email ON meal_plan_shares(lower(shared_with_email));
CREATE INDEX idx_meal_plan_entries_plan_date ON meal_plan_entries(meal_plan_id, date);
CREATE INDEX idx_meal_plan_entries_recipe_id ON meal_plan_entries(recipe_id);

-- ============================================================================
-- HELPERS
-- ============================================================================

CREATE OR REPLACE FUNCTION is_meal_plan_owner(plan_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM meal_plans
    WHERE id = plan_uuid AND owner_id = auth.uid()
  );
$$;

-- Owner or share recipient (any permission).
CREATE OR REPLACE FUNCTION is_meal_plan_member(plan_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_meal_plan_owner(plan_uuid) OR EXISTS (
    SELECT 1 FROM meal_plan_shares
    WHERE meal_plan_id = plan_uuid
    AND lower(shared_with_email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- Owner or share recipient with write permission.
CREATE OR REPLACE FUNCTION can_write_meal_plan(plan_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_meal_plan_owner(plan_uuid) OR EXISTS (
    SELECT 1 FROM meal_plan_shares
    WHERE meal_plan_id = plan_uuid
    AND lower(shared_with_email) = lower(auth.jwt() ->> 'email')
    AND permission = 'write'
  );
$$;

-- Is this recipe planned in any meal plan the current user belongs to?
CREATE OR REPLACE FUNCTION is_recipe_in_my_meal_plan(recipe_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM meal_plan_entries e
    WHERE e.recipe_id = recipe_uuid
    AND is_meal_plan_member(e.meal_plan_id)
  );
$$;

-- ============================================================================
-- RLS: meal_plans
-- ============================================================================

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_plans_select" ON meal_plans
  FOR SELECT USING (owner_id = auth.uid() OR is_meal_plan_member(id));

CREATE POLICY "meal_plans_insert" ON meal_plans
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Writers may change plan settings (e.g. which meals are shown). Ownership
-- never changes (enforced by meal_plans_keep_owner below).
CREATE POLICY "meal_plans_update" ON meal_plans
  FOR UPDATE USING (can_write_meal_plan(id));

CREATE OR REPLACE FUNCTION meal_plans_keep_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.owner_id := OLD.owner_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER meal_plans_keep_owner
  BEFORE UPDATE ON meal_plans
  FOR EACH ROW EXECUTE FUNCTION meal_plans_keep_owner();

CREATE POLICY "meal_plans_delete" ON meal_plans
  FOR DELETE USING (owner_id = auth.uid());

-- ============================================================================
-- RLS: meal_plan_shares
-- ============================================================================

-- Every member can see who else is on the plan.
CREATE POLICY "meal_plan_shares_select" ON meal_plan_shares
  FOR SELECT USING (is_meal_plan_member(meal_plan_id));

CREATE POLICY "meal_plan_shares_insert" ON meal_plan_shares
  FOR INSERT WITH CHECK (is_meal_plan_owner(meal_plan_id) AND shared_by = auth.uid());

-- The owner removes anyone; a recipient can remove themselves (leave).
CREATE POLICY "meal_plan_shares_delete" ON meal_plan_shares
  FOR DELETE USING (
    is_meal_plan_owner(meal_plan_id)
    OR lower(shared_with_email) = lower(auth.jwt() ->> 'email')
  );

-- ============================================================================
-- RLS: meal_plan_entries
-- ============================================================================

CREATE POLICY "meal_plan_entries_select" ON meal_plan_entries
  FOR SELECT USING (is_meal_plan_member(meal_plan_id));

-- A recipe slot may only point at a recipe the writer can already see, so a
-- plan can't be used to read arbitrary recipes by id.
CREATE POLICY "meal_plan_entries_insert" ON meal_plan_entries
  FOR INSERT WITH CHECK (
    can_write_meal_plan(meal_plan_id)
    AND (recipe_id IS NULL OR has_recipe_read_access(recipe_id))
  );

CREATE POLICY "meal_plan_entries_update" ON meal_plan_entries
  FOR UPDATE USING (can_write_meal_plan(meal_plan_id))
  WITH CHECK (
    can_write_meal_plan(meal_plan_id)
    AND (recipe_id IS NULL OR has_recipe_read_access(recipe_id))
  );

CREATE POLICY "meal_plan_entries_delete" ON meal_plan_entries
  FOR DELETE USING (can_write_meal_plan(meal_plan_id));

-- ============================================================================
-- RECIPE READ ACCESS FOR PLAN MEMBERS
-- Additional permissive SELECT policies (OR'd with the existing ones).
-- ============================================================================

CREATE POLICY "recipes_select_via_meal_plan" ON recipes
  FOR SELECT USING (is_recipe_in_my_meal_plan(id));

CREATE POLICY "recipe_ingredients_select_via_meal_plan" ON recipe_ingredients
  FOR SELECT USING (is_recipe_in_my_meal_plan(recipe_id));

CREATE POLICY "recipe_steps_select_via_meal_plan" ON recipe_steps
  FOR SELECT USING (is_recipe_in_my_meal_plan(recipe_id));

-- has_recipe_read_access gates cook_sessions; extend it so a household member
-- can cook (and log) a planned recipe from a collection not shared with them.
-- The original owner/collection branches are unchanged.
CREATE OR REPLACE FUNCTION has_recipe_read_access(recipe_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM recipes
    WHERE id = recipe_uuid
    AND (
      owner_id = auth.uid()
      OR (
        collection_id IS NOT NULL
        AND (
          is_collection_owner(collection_id)
          OR is_collection_shared_with_me(collection_id)
        )
      )
    )
  ) OR is_recipe_in_my_meal_plan(recipe_uuid);
$$;

-- ============================================================================
-- COLLABORATORS RPC (mirrors get_collection_collaborators)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_meal_plan_collaborators(p_meal_plan_id uuid)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_meal_plan_member(p_meal_plan_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM meal_plan_shares WHERE meal_plan_id = p_meal_plan_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    p.id,
    COALESCE(p.display_name, split_part(p.email, '@', 1)),
    COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
  FROM meal_plans mp
  JOIN profiles p ON mp.owner_id = p.id
  JOIN auth.users u ON p.id = u.id
  WHERE mp.id = p_meal_plan_id
    AND p.id != auth.uid()
  UNION
  SELECT DISTINCT
    p.id,
    COALESCE(p.display_name, split_part(p.email, '@', 1)),
    COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
  FROM meal_plan_shares s
  JOIN profiles p ON lower(s.shared_with_email) = lower(p.email)
  JOIN auth.users u ON p.id = u.id
  WHERE s.meal_plan_id = p_meal_plan_id
    AND p.id != auth.uid();
END;
$$;

-- ============================================================================
-- MARK PLANNED MEAL COOKED WHEN A COOK FINISHES
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_planned_meal_cooked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_tz text;
  v_local_date date;
BEGIN
  IF NEW.completed_at IS NULL
     OR (TG_OP = 'UPDATE' AND OLD.completed_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  SELECT email, COALESCE(NULLIF(timezone, ''), 'UTC')
    INTO v_email, v_tz
    FROM profiles WHERE id = NEW.user_id;

  BEGIN
    v_local_date := (NEW.completed_at AT TIME ZONE v_tz)::date;
  EXCEPTION WHEN invalid_parameter_value THEN
    v_local_date := (NEW.completed_at AT TIME ZONE 'UTC')::date;
  END;

  UPDATE meal_plan_entries e
  SET cooked_at = NEW.completed_at, updated_at = now()
  WHERE e.recipe_id = NEW.recipe_id
    AND e.kind = 'recipe'
    AND e.date = v_local_date
    AND e.cooked_at IS NULL
    AND EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = e.meal_plan_id
      AND (
        mp.owner_id = NEW.user_id
        OR EXISTS (
          SELECT 1 FROM meal_plan_shares s
          WHERE s.meal_plan_id = mp.id
          AND lower(s.shared_with_email) = lower(v_email)
        )
      )
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cook_sessions_mark_planned_meal ON cook_sessions;
CREATE TRIGGER cook_sessions_mark_planned_meal
  AFTER INSERT OR UPDATE OF completed_at ON cook_sessions
  FOR EACH ROW EXECUTE FUNCTION mark_planned_meal_cooked();

-- ============================================================================
-- REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE meal_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE meal_plan_shares;
ALTER PUBLICATION supabase_realtime ADD TABLE meal_plan_entries;
