const express = require('express');
const { sql } = require('../../../db.js');
const { sendSms } = require('../../../lib/sms.js');

const router = express.Router();

function authenticateAdmin(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.ODOFY_ADMIN_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { store, orders } = req.body || {};

    if (!store || !orders || !Array.isArray(orders) || orders.length === 0) {
      res.status(400).json({
        error: 'Request body must include a "store" object and a non-empty "orders" array.',
      });
      return;
    }

    if (
      store.latitude == null ||
      store.longitude == null
    ) {
      res.status(400).json({ error: 'Store must include latitude and longitude.' });
      return;
    }

    const validOrders = orders.filter(
      (o) => o.id && o.latitude != null && o.longitude != null
    );

    if (validOrders.length === 0) {
      res.status(400).json({
        error: 'At least one order with id, latitude, and longitude is required.',
      });
      return;
    }

    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;

    if (!mapboxToken) {
      res.status(500).json({ error: 'MAPBOX_ACCESS_TOKEN is not configured.' });
      return;
    }

    // Build coordinate string: store first, then all valid orders
    const coords = [
      `${store.longitude},${store.latitude}`,
      ...validOrders.map((o) => `${o.longitude},${o.latitude}`),
    ];

    const coordinatesQueryString = coords.join(';');

    // Call Mapbox Optimization API
    const mapboxUrl =
      `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinatesQueryString}` +
      `?source=first&destination=last&roundtrip=false&access_token=${mapboxToken}`;

    const mapboxResponse = await fetch(mapboxUrl);
    const data = await mapboxResponse.json();

    if (!mapboxResponse.ok || !data.waypoints) {
      console.error('Mapbox optimization error:', data);
      res.status(502).json({
        error: 'Mapbox optimization request failed',
        details: data.message || 'Unknown error',
      });
      return;
    }

    // Parse optimized waypoints — map back to order IDs
    const waypoints = data.waypoints || [];
    const optimizedSequence = [];

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const sourceIndex = wp.waypoint_index;

      // Skip store at index 0
      if (sourceIndex === 0) continue;

      const orderIndex = sourceIndex - 1;
      if (orderIndex >= 0 && orderIndex < validOrders.length) {
        optimizedSequence.push({
          order_id: validOrders[orderIndex].id,
          route_sequence_index: optimizedSequence.length + 1,
        });
      }
    }

    // Persist route_sequence_index for the store's orders
    const db = sql();

    for (const stop of optimizedSequence) {
      await db`
        UPDATE orders
        SET route_sequence_index = ${stop.route_sequence_index},
            status = 'assigned'
        WHERE id = ${stop.order_id}
      `;
    }

    const allDrivers = await db`
      SELECT uuid, first_name, last_name, phone_number, email
      FROM odofy_drivers
      WHERE status IN ('ACTIVE', 'APPROVED')
    `;

    const priorityDrivers = allDrivers.filter(
      (d) => d.email && (d.email.endsWith('@getodofy.com') || d.email.endsWith('.edu'))
    );
    const nonPriorityDrivers = allDrivers.filter(
      (d) => !priorityDrivers.includes(d)
    );

    const msgBody = `Odofy Alert: ${store.name || store.shop_domain || 'A store'} has ${optimizedSequence.length} delivery stop(s) ready for pickup. Open your driver dashboard to claim: https://getodofy.com/dashboard`;

    let prioritySent = 0;
    for (const driver of priorityDrivers) {
      try {
        await sendSms(driver.phone_number, msgBody);
        prioritySent++;
      } catch (e) {
        console.error(`SMS to priority driver ${driver.uuid} failed:`, e.message);
      }
    }

    const orderIds = optimizedSequence.map((s) => s.order_id);
    setTimeout(async () => {
      try {
        const db2 = sql();
        const stillUnclaimed = await db2`
          SELECT id FROM orders
          WHERE id IN ${db2(orderIds)}
            AND status = 'assigned'
          LIMIT 1
        `;

        if (stillUnclaimed.length === 0) return;

        let backupSent = 0;
        for (const driver of nonPriorityDrivers) {
          try {
            await sendSms(driver.phone_number, msgBody);
            backupSent++;
          } catch (e) {
            console.error(`SMS to backup driver ${driver.uuid} failed:`, e.message);
          }
        }
        console.log(`Priority dispatch escalated: ${backupSent} backup drivers notified for orders ${orderIds.join(',')}`);
      } catch (err) {
        console.error('Priority dispatch escalation error:', err);
      }
    }, 120000);

    res.status(200).json({
      success: true,
      message: 'Stacked delivery coordinates optimized successfully.',
      optimized: true,
      totalStops: optimizedSequence.length,
      sequence: optimizedSequence,
      priorityNotified: prioritySent,
      backupEligible: nonPriorityDrivers.length,
    });
  } catch (err) {
    console.error('Webhook orders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
