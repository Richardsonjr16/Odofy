-- 016_group_carts.sql
-- Real-time group ordering: shared carts keyed by a 6-char room code, plus
-- per-user line items. Applied to live Neon (ep-winter-fog) via psql.

CREATE TABLE IF NOT EXISTS shared_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL UNIQUE,
  merchant_id UUID NOT NULL REFERENCES odofy_merchants(uuid),
  host_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CHECKED_OUT')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shared_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_cart_id UUID NOT NULL REFERENCES shared_carts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES merchant_products(id),
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enables the atomic UPSERT (increment quantity) for the same user + product in
-- a shared cart, and keeps duplicate rows out of the aggregate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_cart_items_user_product
  ON shared_cart_items (shared_cart_id, user_id, product_id);
