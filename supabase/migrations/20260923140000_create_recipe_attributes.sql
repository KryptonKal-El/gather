-- Recipe attributes: the small, fixed vocabulary the meal planner uses to
-- balance a week (which meals a recipe suits, course, protein, cuisine,
-- effort, cooking method, kid-friendly, and key fresh ingredients).
--
-- One row per recipe, in its own table so recipes' shape, realtime traffic
-- and updated_at are untouched. On iOS the on-device model fills these in;
-- anyone who can edit the recipe can correct them on iOS or web. Fields a
-- person set by hand are listed in manual_fields and are never overwritten
-- by automatic tagging. auto_source_hash fingerprints the recipe text that
-- was last auto-tagged, so an edited recipe gets re-tagged.

CREATE TABLE recipe_attributes (
  recipe_id uuid PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
  course text CHECK (course IN ('main', 'side', 'dessert', 'snack', 'drink', 'component')),
  meal_types text[] NOT NULL DEFAULT '{}'
    CHECK (meal_types <@ ARRAY['breakfast', 'lunch', 'dinner']),
  protein text CHECK (protein IN (
    'chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'shellfish',
    'eggs', 'tofu', 'beans', 'dairy', 'none'
  )),
  cuisine text CHECK (cuisine IN (
    'american', 'mexican', 'italian', 'french', 'spanish', 'greek', 'mediterranean',
    'middle_eastern', 'indian', 'chinese', 'japanese', 'korean', 'thai',
    'vietnamese', 'caribbean', 'african', 'other'
  )),
  effort text CHECK (effort IN ('quick', 'medium', 'project')),
  method text CHECK (method IN (
    'stovetop', 'oven', 'grill', 'slow_cooker', 'pressure_cooker',
    'air_fryer', 'fried', 'no_cook'
  )),
  kid_friendly boolean,
  perishables text[] NOT NULL DEFAULT '{}',
  manual_fields text[] NOT NULL DEFAULT '{}',
  auto_source_hash text,
  auto_tagged_at timestamptz,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recipe_attributes ENABLE ROW LEVEL SECURITY;

-- Anyone who can see the recipe (owner, collection members, meal-plan members).
CREATE POLICY "recipe_attributes_select" ON recipe_attributes
  FOR SELECT USING (has_recipe_read_access(recipe_id));

-- Anyone who can edit the recipe.
CREATE POLICY "recipe_attributes_insert" ON recipe_attributes
  FOR INSERT WITH CHECK (has_recipe_write_access(recipe_id));

CREATE POLICY "recipe_attributes_update" ON recipe_attributes
  FOR UPDATE USING (has_recipe_write_access(recipe_id))
  WITH CHECK (has_recipe_write_access(recipe_id));

CREATE POLICY "recipe_attributes_delete" ON recipe_attributes
  FOR DELETE USING (has_recipe_write_access(recipe_id));

ALTER PUBLICATION supabase_realtime ADD TABLE recipe_attributes;
