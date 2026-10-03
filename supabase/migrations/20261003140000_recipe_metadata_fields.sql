-- Recipe metadata: source (name + optional URL), prep time, cook time, servings.
-- All optional, so existing recipes and the existing RLS policies are unaffected.
alter table public.recipes
  add column if not exists source_name text,
  add column if not exists source_url  text,
  add column if not exists prep_time   text,
  add column if not exists cook_time   text,
  add column if not exists servings    integer;
