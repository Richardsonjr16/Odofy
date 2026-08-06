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
