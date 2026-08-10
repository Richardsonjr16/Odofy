-- scripts/seed-st-michaels.sql
-- Idempotent seed: St. Michael's merchant + full menu (46 items across 7 categories).
--
-- Usage: psql "$DATABASE_URL" -f scripts/seed-st-michaels.sql
-- (or run through any Postgres client; the script is self-contained.)
--
-- Notes:
--   * The slug unique index on odofy_merchants makes re-runs safe: any existing
--     st-michaels merchant and its products are removed first, then re-inserted.
--   * The merchant UUID is generated fresh on each run (gen_random_uuid()); the
--     products reference it via a CTE so no hardcoded UUID is needed.
--   * api_secret_key is NOT NULL in the live schema; a random 32-char hex secret
--     is generated per run (md5 of random() + clock_timestamp(), portable across
--     Postgres versions without requiring the pgcrypto extension).
--   * Latitude/longitude come from Google Maps geocoding of
--     "15 Main St, Springfield, NJ 07081" (lat 40.7121467, lng -74.3078732).
--   * Category requires migration 018 (merchant_products.category); the ALTER
--     below is idempotent and applied first so the script works standalone.

BEGIN;

ALTER TABLE merchant_products ADD COLUMN IF NOT EXISTS category TEXT;

-- Clear existing St. Michael's data (products first — no ON DELETE CASCADE).
DELETE FROM merchant_products
WHERE merchant_id IN (SELECT uuid FROM odofy_merchants WHERE slug = 'st-michaels');

DELETE FROM odofy_merchants WHERE slug = 'st-michaels';

-- Merchant + menu in one transaction-scoped statement.
WITH m AS (
  INSERT INTO odofy_merchants
    (business_name, storefront_address, latitude, longitude, api_secret_key, slug)
  VALUES
    ('St. Michael''s', '15 Main St, Springfield, NJ 07081', 40.7121467, -74.3078732,
     md5(random()::text || clock_timestamp()::text), 'st-michaels')
  RETURNING uuid
)
INSERT INTO merchant_products (merchant_id, title, description, price_cents, category, in_stock)
SELECT m.uuid, v.title, v.description, v.price_cents, v.category, true
FROM m
CROSS JOIN (VALUES
  -- ── Starters (7) ──
  ('Spinach & Artichoke Dip', 'Creamy spinach and artichoke dip baked with mozzarella, served with warm tortilla chips.', 1095, 'Starters'),
  ('Chicken Tenders', 'Crispy golden chicken tenders served with your choice of dipping sauce.', 1195, 'Starters'),
  ('Crab Cakes', 'Jumbo lump crab cakes pan-seared and served with remoulade sauce.', 1495, 'Starters'),
  ('Spicy Cheese Ravioli', 'Cheese ravioli tossed in a spicy marinara and topped with parmesan.', 1125, 'Starters'),
  ('Basket of Fries', 'Golden crispy fries served in a generous basket.', 625, 'Starters'),
  ('Soup of the Day', 'Ask your server about today''s fresh-made soup selection.', 675, 'Starters'),
  ('Soup and Salad', 'Bowl of the soup of the day paired with a fresh house salad.', 1250, 'Starters'),

  -- ── Fresh Garden Salads (7) ──
  ('Small Side Salad', 'Crisp mixed greens with tomatoes, cucumbers and onions, served with your choice of dressing.', 595, 'Fresh Garden Salads'),
  ('Crab Cake Salad', 'Fresh garden salad topped with a pan-seared jumbo lump crab cake.', 1450, 'Fresh Garden Salads'),
  ('Grilled Chicken Salad', 'Grilled chicken breast over fresh greens with tomatoes, cucumbers and onions.', 1295, 'Fresh Garden Salads'),
  ('Crispy Chicken Salad', 'Crispy chicken tenders over fresh greens with tomatoes, cucumbers and onions.', 1295, 'Fresh Garden Salads'),
  ('Blackened Salmon Salad', 'Blackened salmon fillet over fresh greens with tomatoes, cucumbers and onions.', 1450, 'Fresh Garden Salads'),
  ('Tomato & Mozzarella Salad', 'Fresh mozzarella, vine-ripened tomatoes and basil finished with balsamic glaze.', 1095, 'Fresh Garden Salads'),
  ('Large House Salad', 'Hearty portion of mixed greens, tomatoes, cucumbers, onions and cheese.', 1195, 'Fresh Garden Salads'),

  -- ── Burgers (7) ──
  ('The Dante Hall', 'Half-pound burger with American cheese, lettuce, tomato and onion on a toasted roll.', 1195, 'Burgers'),
  ('Schoolyard', 'Classic burger with American cheese, served with lettuce, tomato and onion.', 1125, 'Burgers'),
  ('Steel Pier', 'Burger topped with grilled onions, mushrooms and Swiss cheese.', 1195, 'Burgers'),
  ('500 Club', 'Bacon cheeseburger with lettuce, tomato and mayo on a toasted roll.', 1195, 'Burgers'),
  ('Mississippi Ave', 'Burger stacked with cheddar, crispy bacon and barbecue sauce.', 1195, 'Burgers'),
  ('King Kong', 'Double-stacked burger with double cheese, bacon and special sauce.', 1395, 'Burgers'),
  ('NY Yankee', 'Burger with American cheese, pickles, ketchup and mustard.', 1195, 'Burgers'),

  -- ── Cold Subs (6) ──
  ('Regular Italian', 'Ham, salami, provolone, lettuce, tomato, onion and oil & vinegar on a fresh roll.', 1150, 'Cold Subs'),
  ('Spicy Capicola', 'Spicy capicola, provolone, lettuce, tomato and hot peppers.', 1150, 'Cold Subs'),
  ('Turkey Sub', 'Roasted turkey breast, provolone, lettuce, tomato and mayo.', 1150, 'Cold Subs'),
  ('Salami Sub', 'Genoa salami, provolone, lettuce, tomato, onion and oil & vinegar.', 1150, 'Cold Subs'),
  ('Chicken Salad Sub', 'Homemade chicken salad with lettuce and tomato on a fresh roll.', 1150, 'Cold Subs'),
  ('Italian BLT', 'Bacon, lettuce, tomato, ham and provolone with mayo.', 1150, 'Cold Subs'),

  -- ── Hot Subs (7) ──
  ('Cheesesteak', 'Sliced steak with melted cheese and grilled onions on a toasted roll.', 1195, 'Hot Subs'),
  ('Meatball Sub', 'Homemade meatballs in marinara with melted mozzarella on a toasted roll.', 1195, 'Hot Subs'),
  ('Chicken Parm', 'Breaded chicken cutlet, marinara and melted mozzarella on a toasted roll.', 1195, 'Hot Subs'),
  ('Italian Dip', 'Sliced roast beef with provolone, served with au jus for dipping.', 1195, 'Hot Subs'),
  ('Pizza Sub', 'Pepperoni and mozzarella with marinara, toasted hot.', 1195, 'Hot Subs'),
  ('Russo', 'Grilled sausage with peppers and onions and provolone on a toasted roll.', 1195, 'Hot Subs'),
  ('Turkey Russo', 'Roasted turkey with peppers, onions and provolone, toasted hot.', 1195, 'Hot Subs'),

  -- ── Wraps (7) ──
  ('Caribbean Jerk Wrap', 'Jerk chicken, lettuce, tomato and pineapple salsa wrapped in a flour tortilla.', 1225, 'Wraps'),
  ('Turkey Club Wrap', 'Roasted turkey, bacon, lettuce, tomato and mayo in a flour tortilla.', 1225, 'Wraps'),
  ('Veggie Wrap', 'Fresh grilled vegetables, lettuce, tomato and provolone in a flour tortilla.', 1225, 'Wraps'),
  ('Grilled Turkey Provolone Wrap', 'Grilled turkey breast with melted provolone, lettuce and tomato.', 1225, 'Wraps'),
  ('Black Bean Wrap', 'Black beans, rice, corn salsa and cheese in a flour tortilla.', 1225, 'Wraps'),
  ('Chicken Salad Wrap', 'Homemade chicken salad with lettuce and tomato in a flour tortilla.', 1225, 'Wraps'),
  ('Chicken Caesar Wrap', 'Grilled chicken, romaine, parmesan and caesar dressing in a flour tortilla.', 1225, 'Wraps'),

  -- ── Sandwiches (5) ──
  ('Montreal Grilled Chicken', 'Grilled chicken breast seasoned Montreal-style, served on a fresh roll.', 1025, 'Sandwiches'),
  ('Chicken Club', 'Grilled chicken, bacon, lettuce, tomato and mayo on toasted bread.', 1095, 'Sandwiches'),
  ('Crab Cake Sandwich', 'Pan-seared crab cake with lettuce, tomato and remoulade on a fresh roll.', 1350, 'Sandwiches'),
  ('Guacamole Chicken', 'Grilled chicken, guacamole, lettuce, tomato and onion on a fresh roll.', 1025, 'Sandwiches'),
  ('Spicy Jalapeño Grilled Cheese', 'Toasted bread with melted cheese and fresh jalapeños.', 795, 'Sandwiches')
) AS v(title, description, price_cents, category);

COMMIT;
