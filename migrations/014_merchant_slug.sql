-- 014: Merchant slugs for public storefront URLs + storefront order metadata.
-- Slugs power /store/:slug pages; order_number/total_cents carry storefront checkout totals.

ALTER TABLE odofy_merchants ADD COLUMN IF NOT EXISTS slug TEXT;

-- Generate slugs for existing merchants from business_name:
-- lowercase, replace spaces with hyphens, remove special chars
UPDATE odofy_merchants
SET slug = regexp_replace(lower(business_name), '[^a-z0-9]+', '-', 'g')
WHERE slug IS NULL OR slug = '';

-- Guard against empty business names producing empty slugs.
UPDATE odofy_merchants
SET slug = 'merchant-' || LEFT(uuid::text, 8)
WHERE slug = '' OR slug IS NULL;

-- Disambiguate duplicate slugs (e.g. two merchants named "Test Store") by
-- appending a short uuid fragment so every slug is unique before indexing.
DO $$
DECLARE dup RECORD;
BEGIN
  FOR dup IN
    SELECT slug FROM odofy_merchants GROUP BY slug HAVING COUNT(*) > 1
  LOOP
    UPDATE odofy_merchants m
    SET slug = m.slug || '-' || LEFT(m.uuid::text, 8)
    WHERE m.slug = dup.slug;
  END LOOP;
END $$;

-- Enforce uniqueness now that duplicates are disambiguated.
CREATE UNIQUE INDEX IF NOT EXISTS odofy_merchants_slug_key ON odofy_merchants (slug);

-- Storefront orders: order number + total in cents.
ALTER TABLE odofy_trips ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE odofy_trips ADD COLUMN IF NOT EXISTS total_cents INTEGER;
