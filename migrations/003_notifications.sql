-- Driver notifications table expected by GET /api/v1/odofy/drivers/notifications
CREATE TABLE IF NOT EXISTS odofy_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES odofy_drivers(uuid) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_odofy_notifications_driver_id
  ON odofy_notifications (driver_id, created_at DESC);
