ALTER TABLE odofy_trips ADD COLUMN IF NOT EXISTS proof_of_delivery_url TEXT;

CREATE TABLE IF NOT EXISTS disputes_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES odofy_trips(uuid),
  merchant_id UUID REFERENCES odofy_merchants(uuid),
  customer_id TEXT,
  reason_category TEXT NOT NULL CHECK (reason_category IN ('MISSING_ITEM', 'DAMAGED_GOODS', 'LATE_DELIVERY')),
  description TEXT,
  proof_image_url TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED_CREDIT', 'DENIED_DISPUTE')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
