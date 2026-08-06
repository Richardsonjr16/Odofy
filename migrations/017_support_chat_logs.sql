CREATE TABLE IF NOT EXISTS support_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  order_id UUID REFERENCES odofy_trips(uuid),
  chat_transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  escalation_status TEXT NOT NULL DEFAULT 'RESOLVED' CHECK (escalation_status IN ('RESOLVED', 'PENDING_ADMIN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
