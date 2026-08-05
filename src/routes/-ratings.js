const express = require('express');
const crypto = require('crypto');
const pool = require('../db.js');
const { authenticateDriver } = require('../middleware/auth');
const router = express.Router();

const ROLE_TYPES = ['DRIVER_TO_CUSTOMER', 'CUSTOMER_TO_DRIVER'];
const SAFETY_FLAGS = ['Loose Animal', 'Poor Lighting', 'Hostile Interaction'];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Customers have no account, so when no valid sender UUID is supplied we derive
// a stable anonymous UUID from the trip — repeat ratings from the same customer
// coalesce to a single sender identity while remaining unlinkable to a person.
function resolveCustomerSenderId(senderId, tripUuid) {
  if (typeof senderId === 'string' && UUID_PATTERN.test(senderId)) {
    return senderId;
  }
  const hash = crypto.createHash('md5').update(`${tripUuid}:customer`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

// DRIVER_TO_CUSTOMER ratings require a valid driver token; CUSTOMER_TO_DRIVER is public.
function requireDriverForRole(req, res, next) {
  if (req.body && req.body.role_type === 'DRIVER_TO_CUSTOMER') {
    return authenticateDriver(req, res, next);
  }
  next();
}

router.post('/submit', requireDriverForRole, async (req, res) => {
  try {
    const { order_id, sender_id, role_type, stars, safety_flags, notes } = req.body;
    if (!order_id) {
      return res.status(400).json({ error: 'Missing required field: order_id' });
    }
    if (!ROLE_TYPES.includes(role_type)) {
      return res.status(400).json({
        error: `Invalid role_type. Must be one of: ${ROLE_TYPES.join(', ')}`,
      });
    }
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ error: 'stars must be an integer between 1 and 5' });
    }
    // order_id may be the trip uuid (driver flow) or the public ODF- order
    // number carried in the customer's tracking link (customer flow).
    const tripResult = await pool.query(
      'SELECT uuid, driver_id, merchant_id, status FROM odofy_trips WHERE uuid::text = $1 OR order_number = $1',
      [order_id]
    );
    if (tripResult.rows.length === 0) {
      return res.status(400).json({ error: 'order_id does not reference a valid trip' });
    }
    const trip = tripResult.rows[0];
    let resolvedSenderId;
    let resolvedReceiverId;
    if (role_type === 'DRIVER_TO_CUSTOMER') {
      resolvedSenderId = req.driver.uuid;
      if (!trip.merchant_id) {
        return res.status(400).json({ error: 'Trip has no associated merchant' });
      }
      resolvedReceiverId = trip.merchant_id;
    } else {
      // CUSTOMER_TO_DRIVER — public; sender is the anonymous customer
      resolvedSenderId = resolveCustomerSenderId(sender_id, trip.uuid);
      if (!trip.driver_id) {
        return res.status(400).json({ error: 'Trip has no associated driver' });
      }
      resolvedReceiverId = trip.driver_id;
    }
    let flags = [];
    if (Array.isArray(safety_flags)) {
      flags = safety_flags.filter((flag) => typeof flag === 'string' && flag !== '');
    }
    if (role_type === 'DRIVER_TO_CUSTOMER') {
      for (const flag of flags) {
        if (!SAFETY_FLAGS.includes(flag)) {
          return res.status(400).json({
            error: `Invalid safety flag: ${flag}. Must be one of: ${SAFETY_FLAGS.join(', ')}`,
          });
        }
      }
    }
    const result = await pool.query(
      `INSERT INTO ratings_ledger
         (order_id, sender_id, receiver_id, role_type, stars, safety_flags, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [
        trip.uuid,
        resolvedSenderId,
        resolvedReceiverId,
        role_type,
        stars,
        flags,
        typeof notes === 'string' && notes.trim() !== '' ? notes : null,
      ]
    );
    const rating = result.rows[0];
    return res.status(201).json({ id: rating.id, created_at: rating.created_at });
  } catch (err) {
    console.error('Rating submission error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
