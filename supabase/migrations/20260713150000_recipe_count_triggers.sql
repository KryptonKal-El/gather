-- Auto-maintain recipes.ingredient_count / step_count with triggers.
--
-- The columns default to 0 and were only maintained app-side by the web app;
-- iOS never wrote them, so iOS-created or iOS-edited recipes showed stale
-- counts in every row display. Same class of bug as lists.item_count
-- (fixed in 20260227230000_fix_item_count.sql). Triggers recompute from the
-- actual child rows instead of incrementing, so bulk replace flows
-- (delete-all + insert-all, used by both clients) always converge and any
-- historical drift self-heals on the next edit. Existing rows are backfilled.

-- ============================================================================
-- RECOUNT FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION recount_recipe_ingredients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid := COALESCE(NEW.recipe_id, OLD.recipe_id);
BEGIN
  UPDATE recipes
  SET ingredient_count = (
    SELECT count(*) FROM recipe_ingredients WHERE recipe_id = target
  )
  WHERE id = target;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION recount_recipe_steps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid := COALESCE(NEW.recipe_id, OLD.recipe_id);
BEGIN
  UPDATE recipes
  SET step_count = (
    SELECT count(*) FROM recipe_steps WHERE recipe_id = target
  )
  WHERE id = target;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS recipe_ingredients_recount ON recipe_ingredients;
CREATE TRIGGER recipe_ingredients_recount
  AFTER INSERT OR DELETE ON recipe_ingredients
  FOR EACH ROW EXECUTE FUNCTION recount_recipe_ingredients();

DROP TRIGGER IF EXISTS recipe_steps_recount ON recipe_steps;
CREATE TRIGGER recipe_steps_recount
  AFTER INSERT OR DELETE ON recipe_steps
  FOR EACH ROW EXECUTE FUNCTION recount_recipe_steps();

-- ============================================================================
-- BACKFILL EXISTING ROWS
-- ============================================================================

UPDATE recipes r
SET
  ingredient_count = (SELECT count(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id),
  step_count = (SELECT count(*) FROM recipe_steps rs WHERE rs.recipe_id = r.id);
