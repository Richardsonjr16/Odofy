const pool = require('../db.js');

const RELEASE_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function releaseStaleIdentityChecks() {
  try {
    const result = await pool.query(
      `UPDATE odofy_drivers
       SET needs_periodic_identity_check = true
       WHERE needs_periodic_identity_check = false
         AND last_identity_check_at < NOW() - INTERVAL '14 days'`
    );
    console.log(`Identity releaser flagged ${result.rowCount} drivers`);
  } catch (err) {
    console.error('Identity releaser error:', err);
  }
}

function startIdentityReleaser() {
  const timer = setInterval(releaseStaleIdentityChecks, RELEASE_INTERVAL_MS);
  timer.unref();
  console.log('Identity releaser started — checking every 24h');
}

module.exports = { startIdentityReleaser };
