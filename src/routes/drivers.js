const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { authenticateDriver } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      phone_number,
      license_photo_url,
      insurance_proof_url,
      profile_photo_url,
      vehicle_make_model,
    } = req.body;

    const missing = [];
    if (!first_name) missing.push('first_name');
    if (!last_name) missing.push('last_name');
    if (!phone_number) missing.push('phone_number');
    if (!license_photo_url) missing.push('license_photo_url');
    if (!insurance_proof_url) missing.push('insurance_proof_url');
    if (!profile_photo_url) missing.push('profile_photo_url');
    if (!vehicle_make_model) missing.push('vehicle_make_model');

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    const authToken = crypto.randomBytes(32).toString('hex');

    const result = await pool.query(
      `INSERT INTO odofy_drivers
         (uuid, first_name, last_name, phone_number, auth_token, status,
          license_photo_url, insurance_proof_url, profile_photo_url, vehicle_make_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        uuidv4(),
        first_name,
        last_name,
        phone_number,
        authToken,
        'ACTIVE',
        license_photo_url,
        insurance_proof_url,
        profile_photo_url,
        vehicle_make_model,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Phone number already registered' });
    }
    console.error('Driver registration error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/location', authenticateDriver, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude === undefined || latitude === null || typeof latitude !== 'number') {
      return res.status(400).json({ error: 'latitude is required and must be a number' });
    }

    if (longitude === undefined || longitude === null || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'longitude is required and must be a number' });
    }

    await pool.query(
      `UPDATE odofy_drivers
       SET current_latitude = $1, current_longitude = $2, location_updated_at = NOW()
       WHERE uuid = $3`,
      [latitude, longitude, req.driver.uuid]
    );

    return res.status(200).json({ status: 'location_updated' });
  } catch (err) {
    console.error('Driver location update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
