const pool = require('../db');
const { isMerchantOpen } = require('../lib/hours');

const RELEASE_INTERVAL_MS = 60_000;

async function releaseHeldOrders() {
  try {
    const result = await pool.query(
      `SELECT t.uuid, t.merchant_id, t.customer_name, m.business_name,
              m.opening_time, m.closing_time, m.timezone
       FROM odofy_trips t
       JOIN odofy_merchants m ON t.merchant_id = m.uuid
       WHERE t.status = 'HOLD_UNTIL_OPENING'`
    );

    for (const row of result.rows) {
      const openingTime = row.opening_time || '08:00:00';
      const closingTime = row.closing_time || '22:00:00';
      const timezone = row.timezone || 'America/Chicago';

      if (isMerchantOpen(openingTime, closingTime, timezone)) {
        await pool.query(
          `UPDATE odofy_trips SET status = 'PENDING_PICKUP' WHERE uuid = $1`,
          [row.uuid]
        );
        console.log(
          `Released held order ${row.uuid} for merchant ${row.business_name} — now PENDING_PICKUP`
        );
      }
    }
  } catch (err) {
    console.error('Hold releaser error:', err);
  }
}

function startHoldReleaser() {
  const timer = setInterval(releaseHeldOrders, RELEASE_INTERVAL_MS);
  timer.unref();
  console.log('Hold releaser started — checking every 60s');
}

module.exports = { startHoldReleaser };
