ALTER TABLE odofy_trips ADD COLUMN IF NOT EXISTS verification_token_hash TEXT;
ALTER TABLE odofy_trips ADD COLUMN IF NOT EXISTS verification_token_raw TEXT;
ALTER TABLE odofy_trips ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
