const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { authenticateDriver } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { first_name, last_name, phone_number } = req.body;

    if (!first_name || !last_name || !phone_number) {
      return res.status(400).json({
        error: 'Missing required fields: first_name, last_name, phone_number',
      });
    }

    const authToken = crypto.randomBytes(32).toString('hex');

    const result = await pool.query(
      `INSERT INTO odofy_drivers
         (uuid, first_name, last_name, phone_number, auth_token, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [uuidv4(), first_name, last_name, phone_number, authToken, 'ACTIVE']
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
