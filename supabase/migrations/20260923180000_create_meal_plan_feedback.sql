-- How a household reacts to "Plan my week" suggestions, so the planner learns.
--
-- One row per reaction: a suggestion was kept (locked), swapped away, or
-- replaced by Regenerate. Cooking is learned from cook_sessions directly and
-- planned-but-uncooked meals from meal_plan_entries, so neither is stored here.
-- Rows belong to the plan, so everyone on a shared plan trains the same
-- preferences. Clients only read the last ~6 months; old reactions fade.

CREATE TABLE meal_plan_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id uuid REFERENCES meal_plans(id) ON DELETE CASCADE NOT NULL,
  recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  event text NOT NULL CHECK (event IN ('kept', 'swapped', 'regenerated')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meal_plan_feedback_plan_created ON meal_plan_feedback(meal_plan_id, created_at);

ALTER TABLE meal_plan_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_plan_feedback_select" ON meal_plan_feedback
  FOR SELECT USING (is_meal_plan_member(meal_plan_id));

CREATE POLICY "meal_plan_feedback_insert" ON meal_plan_feedback
  FOR INSERT WITH CHECK (can_write_meal_plan(meal_plan_id) AND created_by = auth.uid());
