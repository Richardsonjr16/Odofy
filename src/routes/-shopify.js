const crypto = require('crypto');
const express = require('express');
const pool = require('../db.js');
const { haversineDistance } = require('../lib/haversine');
const { geocodeAddress } = require('../lib/geocode');
const { isMerchantOpen, formatTime } = require('../lib/hours');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const DELIVERY_RADIUS_MILES = 4.33;

router.post('/', async (req, res) => {
  try {
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'Server configuration error: webhook secret not set' });
    }

    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    if (!hmacHeader) {
      return res.status(401).json({ error: 'Missing X-Shopify-Hmac-SHA256 header' });
    }

    const rawBody = req.body;
    const computedHmac = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    if (computedHmac !== hmacHeader) {
      return res.status(401).json({ error: 'HMAC verification failed' });
    }

    const payload = JSON.parse(rawBody.toString('utf8'));

    const shopDomain = req.headers['x-shopify-shop-domain'];
    if (!shopDomain) {
      return res.status(400).json({ error: 'Missing X-Shopify-Shop-Domain header' });
    }

    const merchantResult = await pool.query(
      'SELECT * FROM odofy_merchants WHERE shop_domain = $1',
      [shopDomain]
    );

    if (merchantResult.rows.length === 0) {
      return res.status(400).json({ error: 'No merchant found for shop domain' });
    }

    const merchant = merchantResult.rows[0];

    const shippingAddress =
      payload.shipping_address || payload.billing_address || {};
    const firstName = shippingAddress.first_name || '';
    const lastName = shippingAddress.last_name || '';
    const customerName = `${firstName} ${lastName}`.trim() || 'Unknown Customer';
    const customerPhone = shippingAddress.phone || '';

    if (!customerPhone) {
      return res.status(400).json({ error: 'Customer phone number is required' });
    }

    const addressParts = [
      shippingAddress.address1,
      shippingAddress.city,
      shippingAddress.province,
      shippingAddress.zip,
      shippingAddress.country,
    ].filter(Boolean);

    const deliveryAddress = addressParts.join(', ');

    if (!deliveryAddress) {
      return res.status(400).json({ error: 'Delivery address is required' });
    }

    let destLatitude;
    let destLongitude;
    try {
      const geoResult = await geocodeAddress(deliveryAddress);
      destLatitude = geoResult.latitude;
      destLongitude = geoResult.longitude;
    } catch (err) {
      return res.status(400).json({ error: `Geocoding failed: ${err.message}` });
    }

    const distance = haversineDistance(
      merchant.latitude,
      merchant.longitude,
      destLatitude,
      destLongitude
    );

    let tip = 0.0;
    if (typeof payload.driver_tip_allocation === 'number' && payload.driver_tip_allocation >= 0) {
      tip = payload.driver_tip_allocation;
    }

    const tripId = uuidv4();
    let tripStatus;

    if (distance > DELIVERY_RADIUS_MILES) {
      tripStatus = 'REJECTED';
    } else {
      const openingTime = merchant.opening_time || '08:00:00';
      const closingTime = merchant.closing_time || '22:00:00';

      if (isMerchantOpen(openingTime, closingTime, merchant.timezone)) {
        tripStatus = 'PENDING_PICKUP';
      } else {
        tripStatus = 'HOLD_UNTIL_OPENING';
        console.log(
          `Held order for merchant ${merchant.business_name} until opening at ${formatTime(openingTime)}`
        );
      }
    }

    const result = await pool.query(
      `INSERT INTO odofy_trips
         (uuid, merchant_id, customer_name, customer_phone,
          delivery_address, dest_latitude, dest_longitude,
          status, driver_tip_allocation, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [
        tripId,
        merchant.uuid,
        customerName,
        customerPhone,
        deliveryAddress,
        destLatitude,
        destLongitude,
        tripStatus,
        tip,
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
    console.error('Shopify webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
