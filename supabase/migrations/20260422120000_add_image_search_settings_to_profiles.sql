-- Add image_search_settings to profiles for per-user image source preferences
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS image_search_settings jsonb NOT NULL DEFAULT '{"walmart":true,"spoonacular":false,"openfoodfacts":false,"serpapi":false}'::jsonb;
