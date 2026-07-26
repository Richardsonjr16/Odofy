const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { geocodeAddress } = require('../lib/geocode');

const router = express.Router();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

router.post('/register', async (req, res) => {
  try {
    const { business_name, storefront_address, shop_domain, contact_email, password } = req.body;

    if (!business_name || !storefront_address) {
      return res.status(400).json({
        error: 'Missing required fields: business_name, storefront_address',
      });
    }

    let latitude;
    let longitude;
    try {
      const geoResult = await geocodeAddress(storefront_address);
      latitude = geoResult.latitude;
      longitude = geoResult.longitude;
    } catch (err) {
      return res.status(400).json({ error: `Geocoding failed: ${err.message}` });
    }

    const apiSecretKey = crypto.randomBytes(32).toString('hex');

    const passwordHash = password ? hashPassword(password) : null;
    const email = contact_email || null;

    const result = await pool.query(
      `INSERT INTO odofy_merchants
         (uuid, business_name, storefront_address, latitude, longitude, api_secret_key, shop_domain, contact_email, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [uuidv4(), business_name, storefront_address, latitude, longitude, apiSecretKey, shop_domain || null, email, passwordHash]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Merchant registration error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
