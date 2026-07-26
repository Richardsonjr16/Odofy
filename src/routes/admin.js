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

router.get('/drivers/pending', authenticateAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM odofy_drivers WHERE status = 'PENDING_REVIEW' ORDER BY created_at DESC"
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Fetch pending drivers error:', err);
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
      `Odofy Alert: Welcome to the fleet, ${updatedDriver.first_name}! 🐻 Your priority student courier profile has been officially approved. Open your driver dashboard map to start claiming active Springfield retail routes: https://getodofy.com`
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
      return res.status(200).json({ message: 'Driver already rejected' });
    }

    const result = await pool.query(
      "UPDATE odofy_drivers SET status = 'REJECTED' WHERE uuid = $1 RETURNING *",
      [driverId]
    );

    const updatedDriver = result.rows[0];

    sendSms(
      updatedDriver.phone_number,
      `Odofy Status Update: Hello ${updatedDriver.first_name}, your driver profile application could not be verified due to incomplete or expired document uploads (License/Insurance). Please re-submit clear, active images here to clear your review hold: https://getodofy.com`
    ).catch((err) => console.error('Driver rejection SMS failed:', err));

    return res.status(200).json(updatedDriver);
  } catch (err) {
    console.error('Driver rejection error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/trips/live', authenticateAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         t.*,
         m.business_name AS merchant_name,
         d.first_name,
         d.last_name,
         d.vehicle_make_model
       FROM odofy_trips t
       LEFT JOIN odofy_merchants m ON t.merchant_id = m.uuid
       LEFT JOIN odofy_drivers d ON t.driver_id = d.uuid
       ORDER BY t.created_at DESC
       LIMIT 100`
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Fetch live trips error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/merchants', authenticateAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM odofy_merchants ORDER BY business_name ASC'
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Fetch merchants error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/analytics', authenticateAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT COALESCE(SUM(driver_payout + COALESCE(driver_tip_allocation, 0)), 0) AS driver_revenue_pool FROM odofy_trips WHERE status = 'DELIVERED'"
    );
    const completedResult = await pool.query(
      "SELECT COUNT(*)::int AS total_completed FROM odofy_trips WHERE status = 'DELIVERED'"
    );

    const totalCompletedTrips = completedResult.rows[0].total_completed;
    const driverRevenuePool = parseFloat(result.rows[0].driver_revenue_pool);
    const platformNetProfit = totalCompletedTrips * 2.0;

    return res.status(200).json({
      totalCompletedTrips,
      driverRevenuePool,
      platformNetProfit,
    });
  } catch (err) {
    console.error('Fetch analytics error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
