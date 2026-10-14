-- Eat-out deals: restaurants with a recurring deal on certain days of the week
-- (e.g. "kids eat free on Tuesdays"). Deals belong to the meal plan, so every
-- household member sees and edits the same list. The Plan tab badges matching
-- slots; nothing here changes a slot on its own.
--
-- weekdays uses the planner's numbering: Monday = 0 … Sunday = 6.
-- last_checked_on is the day someone last confirmed the deal still runs.

CREATE TABLE meal_plan_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id uuid REFERENCES meal_plans(id) ON DELETE CASCADE NOT NULL,
  restaurant text NOT NULL CHECK (length(btrim(restaurant)) > 0),
  details text,
  address text,
  weekdays smallint[] NOT NULL,
  meals text[] NOT NULL DEFAULT ARRAY['dinner'],
  is_active boolean NOT NULL DEFAULT true,
  last_checked_on date,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meal_plan_deals_weekdays_valid
    CHECK (cardinality(weekdays) > 0 AND weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  CONSTRAINT meal_plan_deals_meals_valid
    CHECK (cardinality(meals) > 0 AND meals <@ ARRAY['breakfast', 'lunch', 'dinner'])
);

CREATE INDEX idx_meal_plan_deals_plan ON meal_plan_deals(meal_plan_id);

ALTER TABLE meal_plan_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_plan_deals_select" ON meal_plan_deals
  FOR SELECT USING (is_meal_plan_member(meal_plan_id));

CREATE POLICY "meal_plan_deals_insert" ON meal_plan_deals
  FOR INSERT WITH CHECK (can_write_meal_plan(meal_plan_id) AND created_by = auth.uid());

CREATE POLICY "meal_plan_deals_update" ON meal_plan_deals
  FOR UPDATE USING (can_write_meal_plan(meal_plan_id))
  WITH CHECK (can_write_meal_plan(meal_plan_id));

CREATE POLICY "meal_plan_deals_delete" ON meal_plan_deals
  FOR DELETE USING (can_write_meal_plan(meal_plan_id));

-- Clients subscribe without a row filter (non-PK filters drop events).
ALTER PUBLICATION supabase_realtime ADD TABLE meal_plan_deals;
