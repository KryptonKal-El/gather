-- Inviting someone to a meal plan now follows the same Pro rule as editing it:
-- the owner can only add members while the plan is editable. Removing members
-- and leaving a plan stay open, so a lapsed subscriber can still tidy up.

DROP POLICY "meal_plan_shares_insert" ON meal_plan_shares;

CREATE POLICY "meal_plan_shares_insert" ON meal_plan_shares
  FOR INSERT WITH CHECK (
    is_meal_plan_owner(meal_plan_id)
    AND shared_by = auth.uid()
    AND can_write_meal_plan(meal_plan_id)
  );
