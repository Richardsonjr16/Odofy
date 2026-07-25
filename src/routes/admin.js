const express = require('express');
const pool = require('../db');
const { sendSms } = require('../lib/sms');

const router = express.Router();

function authenticateAdmin(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.ODOFY_ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

router.get('/drivers/pending', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT uuid, first_name, last_name, phone_number, status,
              license_photo_url, insurance_proof_url, profile_photo_url,
              vehicle_make_model, created_at
       FROM odofy_drivers
       WHERE status = 'PENDING_REVIEW'
       ORDER BY created_at DESC`
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List pending drivers error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/drivers/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const driverId = req.params.id;

    const driverResult = await pool.query(
      'SELECT * FROM odofy_drivers WHERE uuid = $1',
      [driverId]
    );

    if (driverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const driver = driverResult.rows[0];

    if (driver.status === 'ACTIVE') {
      return res.status(200).json({ message: 'Driver already approved', driver });
    }

    const result = await pool.query(
      "UPDATE odofy_drivers SET status = 'ACTIVE' WHERE uuid = $1 RETURNING *",
      [driverId]
    );

    const updatedDriver = result.rows[0];

    sendSms(
      updatedDriver.phone_number,
      'Welcome to Odofy! Your driver account has been approved. You can now start accepting deliveries.'
    ).catch((err) => console.error('Driver approval SMS failed:', err));

    return res.status(200).json(updatedDriver);
  } catch (err) {
    console.error('Driver approval error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/drivers/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const driverId = req.params.id;

    const driverResult = await pool.query(
      'SELECT * FROM odofy_drivers WHERE uuid = $1',
      [driverId]
    );

    if (driverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const driver = driverResult.rows[0];

    if (driver.status === 'REJECTED') {
      return res.status(200).json({ message: 'Driver already rejected', driver });
    }

    const result = await pool.query(
      "UPDATE odofy_drivers SET status = 'REJECTED' WHERE uuid = $1 RETURNING *",
      [driverId]
    );

    const updatedDriver = result.rows[0];

    sendSms(
      updatedDriver.phone_number,
      'Your Odofy driver application has been declined. If you have questions, please contact support.'
    ).catch((err) => console.error('Driver rejection SMS failed:', err));

    return res.status(200).json(updatedDriver);
  } catch (err) {
    console.error('Driver rejection error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
