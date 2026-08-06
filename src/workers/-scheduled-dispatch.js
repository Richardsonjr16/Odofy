const pool = require('../db.js');

const DISPATCH_INTERVAL_MS = 60_000;
// Release a scheduled trip ~35 minutes before its delivery window starts so
// drivers have lead time to see and claim it before the window opens.
const RELEASE_LEAD_TIME_SQL = "NOW() + INTERVAL '35 minutes'";

async function releaseScheduledTrips() {
  try {
    const result = await pool.query(
      `SELECT uuid, scheduled_window_start
       FROM odofy_trips
       WHERE is_scheduled = true
         AND dispatch_released = false
         AND scheduled_window_start <= ${RELEASE_LEAD_TIME_SQL}`
    );

    for (const row of result.rows) {
      await pool.query(
        `UPDATE odofy_trips
         SET dispatch_released = true, status = 'PENDING_PICKUP'
         WHERE uuid = $1`,
        [row.uuid]
      );
      console.log(
        `[SCHEDULED-DISPATCH] Released trip ${row.uuid} for window ${row.scheduled_window_start}`
      );
    }

    console.log(
      `[SCHEDULED-DISPATCH] Cycle complete — ${result.rows.length} scheduled trip(s) released`
    );
  } catch (err) {
    console.error('[SCHEDULED-DISPATCH] Worker error:', err);
  }
}

// Self-start when required — no separate start function needed.
const timer = setInterval(releaseScheduledTrips, DISPATCH_INTERVAL_MS);
timer.unref();
releaseScheduledTrips();

console.log('[SCHEDULED-DISPATCH] Worker started — checking every 60s');

module.exports = { releaseScheduledTrips };
