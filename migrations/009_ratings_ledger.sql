CREATE TABLE IF NOT EXISTS ratings_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES odofy_trips(uuid),
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  role_type TEXT NOT NULL CHECK (role_type IN ('DRIVER_TO_CUSTOMER', 'CUSTOMER_TO_DRIVER')),
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  safety_flags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
