ALTER TABLE odofy_drivers ADD COLUMN IF NOT EXISTS needs_periodic_identity_check BOOLEAN DEFAULT false;
ALTER TABLE odofy_drivers ADD COLUMN IF NOT EXISTS last_identity_check_at TIMESTAMPTZ;
