-- Tables expected by the running backend (odofy_ prefix)

CREATE TABLE IF NOT EXISTS odofy_drivers (
  uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone_number TEXT UNIQUE NOT NULL,
  driver_tier TEXT DEFAULT 'PUBLIC_BACKUP',
  backup_email TEXT,
  status TEXT DEFAULT 'PENDING_REVIEW',
  is_verified BOOLEAN DEFAULT false,
  license_number TEXT,
  license_photo_url TEXT,
  insurance_proof_url TEXT,
  profile_photo_url TEXT,
  vehicle_make_model TEXT,
  current_latitude NUMERIC(10,7),
  current_longitude NUMERIC(10,7),
  location_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS odofy_merchants (
  uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  storefront_address TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  api_secret_key TEXT,
  shop_domain TEXT,
  free_trial_runs_remaining INTEGER DEFAULT 5,
  contact_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS odofy_trips (
  uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES odofy_merchants(uuid),
  driver_id UUID REFERENCES odofy_drivers(uuid),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  dest_latitude NUMERIC(10,7),
  dest_longitude NUMERIC(10,7),
  status TEXT DEFAULT 'PENDING_PICKUP',
  merchant_fee NUMERIC(10,2) DEFAULT 0,
  driver_payout NUMERIC(10,2) DEFAULT 0,
  driver_tip_allocation NUMERIC(10,2) DEFAULT 0,
  batch_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
