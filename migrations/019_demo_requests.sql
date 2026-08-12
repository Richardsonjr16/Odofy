-- 019: Lead capture for the "Book a Free Demo" marketing page (/contact).
-- Public marketing form — stores demo-request leads so the sales side can
-- follow up within one business day. No auth; endpoint is POST
-- /api/v1/odofy/demo-requests.
CREATE TABLE IF NOT EXISTS odofy_demo_requests (
  uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  restaurant_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  locations TEXT,
  current_provider TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
