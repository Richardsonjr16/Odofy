const express = require('express');
const pool = require('../db.js');
const { authenticateDriver } = require('../middleware/auth');
const router = express.Router();

const BASE_DELIVERY_FEE = 850;
const RTS_PENALTY_FEE = 425;
const TOTAL_RTS_PAYOUT = 1275;

router.post('/execute-return-restock', authenticateDriver, async (req, res) => {
  const { order_id: tripId } = req.body || {};
  if (!tripId) return res.status(400).json({ error: 'Missing required field: order_id' });
  try {
    const tripResult = await pool.query(
      `SELECT t.*, m.contact_email
       FROM odofy_trips t
       LEFT JOIN odofy_merchants m ON m.uuid = t.merchant_id
       WHERE t.uuid = $1`,
      [tripId]
    );
    if (tripResult.rows.length === 0) return res.status(400).json({ error: 'Trip not found' });
    const trip = tripResult.rows[0];
    if (trip.driver_id !== req.driver.uuid) {
      return res.status(400).json({ error: 'Trip does not belong to this driver' });
    }
    if (trip.status !== 'UNDELIVERABLE') {
      return res.status(400).json({ error: `Cannot restock trip in ${trip.status} status` });
    }
    const result = await pool.query(
      `UPDATE odofy_trips
       SET status = 'RETURNED_TO_MERCHANT', driver_payout = $3
       WHERE uuid = $1 AND driver_id = $2 AND status = 'UNDELIVERABLE'
       RETURNING *`,
      [tripId, req.driver.uuid, TOTAL_RTS_PAYOUT]
    );
    if (result.rows.length === 0) return res.status(409).json({ error: 'Trip status changed; please retry' });
    console.log(`[RTS] STRIPE PLACEHOLDER — would charge customer ${trip.stripe_customer_id || 'unknown'} $${(RTS_PENALTY_FEE/100).toFixed(2)} for reverse logistics restock surcharge`);
    // TODO: Wire Stripe charge once finance onboarding is complete
    console.log(`[RTS] LEDGER PLACEHOLDER — would credit driver ${req.driver.uuid} $${(TOTAL_RTS_PAYOUT/100).toFixed(2)}`);
    console.log(`[RTS] Return restock complete — merchant ${trip.contact_email || 'unknown'} would be notified here`);
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Return restock error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;

router.post('/generate-verification-token', authenticateDriver, async (req, res) => {
  const { order_id: tripId } = req.body || {};
  if (!tripId) return res.status(400).json({ error: 'Missing required field: order_id' });
  try {
    const trip = (await pool.query('SELECT uuid, driver_id, status FROM odofy_trips WHERE uuid = $1', [tripId])).rows[0];
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.driver_id !== req.driver.uuid) return res.status(403).json({ error: 'Trip does not belong to this driver' });
    if (!['EN_ROUTE', 'IN_TRANSIT'].includes(trip.status)) return res.status(400).json({ error: 'Trip must be en route' });
    const rawToken = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await pool.query("UPDATE odofy_trips SET verification_token_hash=$1, verification_token_raw=$2, token_expires_at=NOW()+INTERVAL '30 minutes' WHERE uuid=$3", [hash, rawToken, tripId]);
    return res.json({ verification_token: rawToken });
  } catch (err) { console.error('Generate verification token error:', err); return res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/verify-qr-handshake', authenticateDriver, async (req, res) => {
  const { order_id: tripId, token } = req.body || {};
  if (!tripId || typeof token !== 'string' || !token) return res.status(400).json({ error: 'Missing required fields: order_id, token' });
  try {
    const trip = (await pool.query('SELECT uuid, driver_id, status, verification_token_hash, token_expires_at FROM odofy_trips WHERE uuid=$1', [tripId])).rows[0];
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.driver_id !== req.driver.uuid) return res.status(403).json({ error: 'Trip does not belong to this driver' });
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    if (!trip.verification_token_hash || hash !== trip.verification_token_hash || !trip.token_expires_at || new Date(trip.token_expires_at) <= new Date()) return res.status(400).json({ error: 'Invalid or expired verification token' });
    const result = await pool.query("UPDATE odofy_trips SET status='DELIVERED', verification_token_hash=NULL, verification_token_raw=NULL, token_expires_at=NULL WHERE uuid=$1 AND status IN ('EN_ROUTE','IN_TRANSIT') AND verification_token_hash=$2 RETURNING uuid", [tripId, hash]);
    if (!result.rows.length) return res.status(400).json({ error: 'Invalid or expired verification token' });
    return res.json({ verified: true });
  } catch (err) { console.error('QR handshake verification error:', err); return res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/:id/verification-token', async (req, res) => {
  try {
    const result = await pool.query("SELECT verification_token_raw FROM odofy_trips WHERE (uuid=$1 OR order_number=$1) AND status IN ('EN_ROUTE','IN_TRANSIT') AND token_expires_at > NOW()", [req.params.id]);
    if (!result.rows.length || !result.rows[0].verification_token_raw) return res.status(404).json({ error: 'Verification token unavailable' });
    return res.json({ verification_token: result.rows[0].verification_token_raw });
  } catch (err) { console.error('Fetch verification token error:', err); return res.status(500).json({ error: 'Internal server error' }); }
});
