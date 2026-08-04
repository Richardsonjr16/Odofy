CREATE TABLE IF NOT EXISTS drivers_identity_checks (
  id UUID PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES odofy_drivers(uuid) ON DELETE CASCADE,
  front_view_url TEXT NOT NULL,
  left_view_url TEXT NOT NULL,
  right_view_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'FLAGGED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS drivers_identity_checks_driver_created_idx
  ON drivers_identity_checks (driver_id, created_at DESC);
