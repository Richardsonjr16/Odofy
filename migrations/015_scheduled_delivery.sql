-- 015: Scheduled delivery time-lock columns for odofy_trips.
-- Trips created as scheduled deliveries stay hidden from driver dispatch until
-- scheduled_window_start approaches. The scheduled-dispatch worker
-- (src/workers/-scheduled-dispatch.js) flips dispatch_released and turns the
-- trip dispatchable (PENDING_PICKUP) so nearby drivers can claim it during its window.

ALTER TABLE odofy_trips ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT false;
ALTER TABLE odofy_trips ADD COLUMN IF NOT EXISTS scheduled_window_start TIMESTAMPTZ;
ALTER TABLE odofy_trips ADD COLUMN IF NOT EXISTS scheduled_window_end TIMESTAMPTZ;
ALTER TABLE odofy_trips ADD COLUMN IF NOT EXISTS dispatch_released BOOLEAN DEFAULT false;
