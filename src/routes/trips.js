const express = require('express');
const pool = require('../db');
const { authenticateDriver, authenticateMerchant } = require('../middleware/auth');
const { haversineDistance } = require('../lib/haversine');
const { geocodeAddress } = require('../lib/geocode');
const { sendSms } = require('../lib/sms');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const DELIVERY_RADIUS_MILES = 4.33;

router.post('/manual', authenticateMerchant, async (req, res) => {
  try {
    const { customer_name, customer_phone, delivery_address } = req.body;

    if (!customer_name || !customer_phone || !delivery_address) {
      return res.status(400).json({
        error: 'Missing required fields: customer_name, customer_phone, delivery_address',
      });
    }

    let destLatitude;
    let destLongitude;
    try {
      const geoResult = await geocodeAddress(delivery_address);
      destLatitude = geoResult.latitude;
      destLongitude = geoResult.longitude;
    } catch (err) {
      return res.status(400).json({ error: `Geocoding failed: ${err.message}` });
    }

    const merchant = req.merchant;
    const distance = haversineDistance(
      merchant.latitude,
      merchant.longitude,
      destLatitude,
      destLongitude
    );

    const tripId = uuidv4();
    const tripStatus =
      distance > DELIVERY_RADIUS_MILES ? 'REJECTED' : 'PENDING_PICKUP';

    const result = await pool.query(
      `INSERT INTO odofy_trips
         (uuid, merchant_id, customer_name, customer_phone,
          delivery_address, dest_latitude, dest_longitude,
          status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        tripId,
        merchant.uuid,
        customer_name,
        customer_phone,
        delivery_address,
        destLatitude,
        destLongitude,
        tripStatus,
      ]
    );

    const trip = result.rows[0];

    if (tripStatus === 'REJECTED') {
      return res
        .status(200)
        .json({ status: 'rejected', reason: 'outside_delivery_radius', trip });
    }

    return res.status(201).json(trip);
  } catch (err) {
    console.error('Manual trip creation error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/available', authenticateDriver, async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM odofy_trips WHERE status = $1 ORDER BY created_at ASC',
      ['PENDING_PICKUP']
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Available trips error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/status', authenticateDriver, async (req, res) => {
  try {
    const tripId = req.params.id;
    const { status } = req.body;

    if (!status || !['EN_ROUTE', 'DELIVERED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be one of: EN_ROUTE, DELIVERED, CANCELLED',
      });
    }

    const tripResult = await pool.query(
      'SELECT * FROM odofy_trips WHERE uuid = $1',
      [tripId]
    );

    if (tripResult.rows.length === 0) {
      return res.status(400).json({ error: 'Trip not found' });
    }

    const trip = tripResult.rows[0];
    const driverId = req.driver.uuid;

    if (status === 'EN_ROUTE') {
      if (trip.status !== 'PENDING_PICKUP') {
        return res.status(400).json({
          error: `Cannot transition from ${trip.status} to EN_ROUTE`,
        });
      }
      if (trip.driver_id !== null) {
        return res.status(400).json({ error: 'Trip is already claimed' });
      }

      const result = await pool.query(
        `UPDATE odofy_trips SET status = $1, driver_id = $2 WHERE uuid = $3 RETURNING *`,
        ['EN_ROUTE', driverId, tripId]
      );

      if (trip.customer_phone) {
        sendSms(trip.customer_phone, 'Your Odofy delivery is on its way!').catch(
          (err) => console.error('SMS send failed:', err)
        );
      }

      return res.status(200).json(result.rows[0]);
    }

    if (status === 'DELIVERED') {
      if (trip.status !== 'EN_ROUTE') {
        return res.status(400).json({
          error: `Cannot transition from ${trip.status} to DELIVERED`,
        });
      }
      if (trip.driver_id !== driverId) {
        return res.status(400).json({ error: 'Trip does not belong to this driver' });
      }

      const result = await pool.query(
        `UPDATE odofy_trips SET status = $1 WHERE uuid = $2 RETURNING *`,
        ['DELIVERED', tripId]
      );

      if (trip.customer_phone) {
        sendSms(
          trip.customer_phone,
          'Your Odofy delivery has been delivered!'
        ).catch((err) => console.error('SMS send failed:', err));
      }

      return res.status(200).json(result.rows[0]);
    }

    if (status === 'CANCELLED') {
      if (trip.status !== 'PENDING_PICKUP' && trip.status !== 'EN_ROUTE') {
        return res.status(400).json({
          error: `Cannot transition from ${trip.status} to CANCELLED`,
        });
      }
      if (
        trip.driver_id !== null &&
        trip.driver_id !== driverId
      ) {
        return res.status(400).json({ error: 'Trip does not belong to this driver' });
      }

      const result = await pool.query(
        `UPDATE odofy_trips SET status = $1 WHERE uuid = $2 RETURNING *`,
        ['CANCELLED', tripId]
      );

      return res.status(200).json(result.rows[0]);
    }
  } catch (err) {
    console.error('Trip status update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
