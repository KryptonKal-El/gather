-- Migrate store categories to lists and user_category_defaults
-- Migration: migrate_store_categories_to_lists
-- Created: 2026-03-20
--
-- This migration:
-- 1. Copies customized store categories to user_category_defaults for grocery
-- 2. Populates list.categories for all category-supporting list types
-- 3. Is idempotent (safe to re-run)

-- ============================================================================
-- SYSTEM DEFAULT CATEGORIES
-- ============================================================================

DO $$
DECLARE
  DEFAULT_CATEGORIES jsonb := '[
    {"key":"produce","name":"Produce","color":"#4caf50","keywords":["apple","apples","banana","bananas","lettuce","tomato","tomatoes","onion","onions","garlic","potato","potatoes","carrot","carrots","broccoli","spinach","avocado","avocados","cucumber","peppers","pepper","celery","mushroom","mushrooms","lemon","lemons","lime","limes","orange","oranges","berries","strawberries","blueberries","grapes","kale","zucchini","corn","ginger","cilantro","parsley","basil","mint","jalapeño","jalapeno"]},
    {"key":"dairy","name":"Dairy & Eggs","color":"#2196f3","keywords":["milk","cheese","yogurt","butter","cream","eggs","egg","sour cream","cream cheese","cottage cheese","mozzarella","parmesan","cheddar"]},
    {"key":"meat","name":"Meat & Seafood","color":"#e53935","keywords":["chicken","beef","pork","steak","salmon","shrimp","turkey","bacon","sausage","ground beef","ground turkey","fish","tuna","lamb","ham"]},
    {"key":"bakery","name":"Bakery","color":"#ff9800","keywords":["bread","bagel","bagels","tortilla","tortillas","rolls","buns","croissant","muffin","muffins","pita"]},
    {"key":"frozen","name":"Frozen","color":"#00bcd4","keywords":["ice cream","frozen pizza","frozen vegetables","frozen fruit","frozen berries"]},
    {"key":"pantry","name":"Pantry & Dry Goods","color":"#795548","keywords":["rice","pasta","flour","sugar","salt","oil","olive oil","vegetable oil","coconut oil","beans","lentils","oats","cereal","peanut butter","canned tomatoes","tomato paste","tomato sauce","chicken broth","broth","noodles","quinoa","baking soda","baking powder","vanilla","honey","vinegar","nuts","almonds","walnuts"]},
    {"key":"beverages","name":"Beverages","color":"#9c27b0","keywords":["water","juice","coffee","tea","soda","wine","beer"]},
    {"key":"snacks","name":"Snacks","color":"#ffc107","keywords":["chips","crackers","cookies","popcorn","granola","granola bars","pretzels","chocolate"]},
    {"key":"condiments","name":"Condiments & Sauces","color":"#ff5722","keywords":["ketchup","mustard","mayo","mayonnaise","soy sauce","hot sauce","salsa","salad dressing","bbq sauce","sriracha"]},
    {"key":"household","name":"Household","color":"#607d8b","keywords":["paper towels","toilet paper","trash bags","dish soap","laundry detergent","sponge","aluminum foil","plastic wrap"]},
    {"key":"personal_care","name":"Personal Care","color":"#e91e63","keywords":["shampoo","conditioner","soap","toothpaste","deodorant","lotion"]},
    {"key":"other","name":"Other","color":"#9e9e9e","keywords":[]}
  ]';

  PACKING_CATEGORIES jsonb := '[
    {"key":"clothes","name":"Clothes","color":"#5C6BC0","keywords":["shirt","shirts","pants","shorts","jacket","coat","dress","socks","underwear","sweater","hoodie","jeans","t-shirt","blouse","skirt"]},
    {"key":"toiletries","name":"Toiletries","color":"#26A69A","keywords":["toothbrush","toothpaste","shampoo","conditioner","soap","deodorant","razor","sunscreen","lotion","floss","mouthwash"]},
    {"key":"electronics","name":"Electronics","color":"#42A5F5","keywords":["charger","laptop","phone","tablet","headphones","earbuds","camera","adapter","cable","power bank","kindle"]},
    {"key":"documents","name":"Documents","color":"#78909C","keywords":["passport","tickets","boarding pass","id","insurance","itinerary","visa","license","reservation"]},
    {"key":"accessories","name":"Accessories","color":"#AB47BC","keywords":["hat","sunglasses","belt","watch","jewelry","wallet","umbrella","scarf","gloves"]},
    {"key":"medications","name":"Medications","color":"#EF5350","keywords":["medicine","pills","vitamins","inhaler","prescription","band-aids","first aid","allergy","ibuprofen","tylenol"]},
    {"key":"snacks_food","name":"Snacks & Food","color":"#FFA726","keywords":["snacks","granola bars","trail mix","nuts","crackers","water bottle","gum","candy"]},
    {"key":"entertainment","name":"Entertainment","color":"#66BB6A","keywords":["book","books","cards","games","puzzle","magazine","notebook","journal","pen","pencil"]},
    {"key":"miscellaneous","name":"Miscellaneous","color":"#9E9E9E","keywords":[]}
  ]';

  TODO_CATEGORIES jsonb := '[
    {"key":"work","name":"Work","color":"#42A5F5","keywords":[]},
    {"key":"personal","name":"Personal","color":"#66BB6A","keywords":[]},
    {"key":"errands","name":"Errands","color":"#FFA726","keywords":[]},
    {"key":"finance","name":"Finance","color":"#26A69A","keywords":[]},
    {"key":"health","name":"Health","color":"#EF5350","keywords":[]},
    {"key":"home","name":"Home","color":"#AB47BC","keywords":[]},
    {"key":"other","name":"Other","color":"#9E9E9E","keywords":[]}
  ]';

BEGIN
  -- ============================================================================
  -- STEP 1: Migrate customized store categories to user_category_defaults
  -- ============================================================================
  -- For each user with customized store categories (non-empty array),
  -- take the store with the most categories (or first by sort_order if tied)
  -- and insert into user_category_defaults for list_type = 'grocery'

  INSERT INTO user_category_defaults (user_id, list_type, categories)
  SELECT DISTINCT ON (s.user_id)
    s.user_id,
    'grocery' AS list_type,
    s.categories
  FROM stores s
  WHERE jsonb_array_length(s.categories) > 0
  ORDER BY s.user_id, jsonb_array_length(s.categories) DESC, s.sort_order ASC
  ON CONFLICT (user_id, list_type) DO NOTHING;

  -- ============================================================================
  -- STEP 2: Populate grocery lists with categories
  -- ============================================================================
  -- For grocery lists with NULL categories:
  -- - Use user_category_defaults if available
  -- - Otherwise use system DEFAULT_CATEGORIES

  -- 2a. Grocery lists where owner has user_category_defaults
  UPDATE lists l
  SET categories = ucd.categories
  FROM user_category_defaults ucd
  WHERE l.categories IS NULL
    AND l.type = 'grocery'
    AND l.owner_id = ucd.user_id
    AND ucd.list_type = 'grocery';

  -- 2b. Grocery lists where owner has no user_category_defaults (use system defaults)
  UPDATE lists
  SET categories = DEFAULT_CATEGORIES
  WHERE categories IS NULL
    AND type = 'grocery';

  -- ============================================================================
  -- STEP 3: Populate packing lists with PACKING_CATEGORIES
  -- ============================================================================

  UPDATE lists
  SET categories = PACKING_CATEGORIES
  WHERE categories IS NULL
    AND type = 'packing';

  -- ============================================================================
  -- STEP 4: Populate todo lists with TODO_CATEGORIES
  -- ============================================================================

  UPDATE lists
  SET categories = TODO_CATEGORIES
  WHERE categories IS NULL
    AND type = 'todo';

END $$;
