-- 012_marketing_campaigns.sql — CRM & marketing campaign ledger for merchant broadcasts
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES odofy_merchants(uuid),
  title TEXT NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('PUSH', 'SMS', 'EMAIL')),
  audience_segment TEXT NOT NULL DEFAULT 'ALL' CHECK (audience_segment IN ('ALL', 'LAPSED', 'VIP')),
  message_body TEXT NOT NULL,
  discount_code TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
