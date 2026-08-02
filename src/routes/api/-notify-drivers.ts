const express = require('express');
const { sql } = require('../../db.ts');
const { sendSms } = require('../../lib/sms.js');

const router = express.Router();

function authenticateAdmin(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.ODOFY_ADMIN_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

router.post('/', authenticateAdmin, async (_req, res) => {
  try {
    if (
      !process.env.TWILIO_ACCOUNT_SID ||
      !process.env.TWILIO_AUTH_TOKEN ||
      !process.env.TWILIO_PHONE_NUMBER
    ) {
      res.status(500).json({
        error:
          'Twilio is not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.',
      });
      return;
    }

    const db = sql();
    const drivers = await db`
      SELECT phone_number, first_name, last_name
      FROM odofy_drivers
      WHERE status = 'APPROVED'
    `;

    if (drivers.length === 0) {
      res.status(200).json({ success: true, totalSent: 0 });
      return;
    }

    const messageBody =
      "There's higher than normal order volume in your area! Turn on Odofy for earnings opportunities.";

    let totalSent = 0;
    const BATCH_SIZE = 20;

    for (let i = 0; i < drivers.length; i += BATCH_SIZE) {
      const batch = drivers.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((driver) => sendSms(driver.phone_number, messageBody)),
      );
      totalSent += results.filter((r) => r.status === 'fulfilled').length;
    }

    res.status(200).json({ success: true, totalSent });
  } catch (err) {
    console.error('Notify drivers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── MULTI-STOP ROUTE OPTIMIZATION ──
router.post('/optimize-route', authenticateAdmin, async (req, res) => {
  try {
    const { store_id } = req.body || {};

    if (!store_id) {
      res.status(400).json({ error: 'store_id is required' });
      return;
    }

    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      res.status(500).json({
        error: 'MAPBOX_ACCESS_TOKEN is not configured.',
      });
      return;
    }

    const db = sql();

    // 1. Fetch the store's coordinates
    const stores = await db`
      SELECT id, latitude, longitude
      FROM stores
      WHERE id = ${store_id}
    `;

    if (stores.length === 0) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    const store = stores[0];

    if (store.latitude == null || store.longitude == null) {
      res.status(400).json({ error: 'Store has no coordinates on file' });
      return;
    }

    // 2. Fetch all unassigned orders for this store that have coordinates
    const orders = await db`
      SELECT id, latitude, longitude, delivery_address
      FROM orders
      WHERE store_id = ${store_id}
        AND status = 'pending'
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      ORDER BY created_at ASC
    `;

    if (orders.length === 0) {
      res.status(200).json({
        success: true,
        optimized: false,
        message: 'No unassigned orders with coordinates found for this store.',
      });
      return;
    }

    // 3. Build the coordinates query string: store first, then all orders
    const coords = [
      `${store.longitude},${store.latitude}`,
      ...orders.map((o) => `${o.longitude},${o.latitude}`),
    ];

    const coordinatesQueryString = coords.join(';');

    // 4. Call Mapbox Optimization API
    const mapboxUrl =
      `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinatesQueryString}` +
      `?source=first&destination=any&roundtrip=false&access_token=${mapboxToken}`;

    const response = await fetch(mapboxUrl);
    const data = await response.json();

    if (!response.ok || !data.waypoints) {
      console.error('Mapbox optimization error:', data);
      res.status(502).json({
        error: 'Mapbox optimization request failed',
        details: data.message || 'Unknown error',
      });
      return;
    }

    // 5. Parse the response — waypoints are returned in optimized order.
    //    waypoint_index maps back to the original coordinate position.
    //    Index 0 = store (fixed start), indices 1..N = orders in optimized sequence.
    const waypoints = data.waypoints || [];
    const optimizedSequence = [];

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const sourceIndex = wp.waypoint_index;

      // Skip the store (sourceIndex 0 is the store itself)
      if (sourceIndex === 0) continue;

      // Map back to the order (sourceIndex - 1 because orders array is 0-based)
      const orderIndex = sourceIndex - 1;
      if (orderIndex >= 0 && orderIndex < orders.length) {
        const sequenceNumber = optimizedSequence.length + 1; // 1-based sequence
        optimizedSequence.push({
          order_id: orders[orderIndex].id,
          route_sequence_index: sequenceNumber,
          delivery_address: orders[orderIndex].delivery_address,
        });
      }
    }

    // 6. Update the database: set route_sequence_index and mark as assigned
    for (const stop of optimizedSequence) {
      await db`
        UPDATE orders
        SET route_sequence_index = ${stop.route_sequence_index},
            status = 'assigned'
        WHERE id = ${stop.order_id}
      `;
    }

    res.status(200).json({
      success: true,
      optimized: true,
      store: { id: store.id, latitude: store.latitude, longitude: store.longitude },
      sequence: optimizedSequence,
      totalStops: optimizedSequence.length,
    });
  } catch (err) {
    console.error('Route optimization error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
