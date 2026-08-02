const express = require('express');
const pool = require('../db.js');
const { sendSms } = require('../lib/sms');

const router = express.Router();

function authenticateAdmin(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.ODOFY_ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

router.get('/drivers', authenticateAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM odofy_drivers ORDER BY created_at DESC'
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Fetch drivers error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/drivers/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const allowedFields = [
    'first_name',
    'last_name',
    'phone_number',
    'vehicle_make_model',
    'status',
    'is_verified',
  ];
  const statusValues = [
    'ACTIVE',
    'SUSPENDED',
    'PENDING_REVIEW',
    'PENDING_MANUAL_APPROVAL',
    'REJECTED',
  ];

  try {
    const updates = [];
    const values = [];
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        if (field === 'status' && !statusValues.includes(req.body[field])) {
          return res.status(400).json({ error: 'Invalid driver status' });
        }
        if (field === 'is_verified' && typeof req.body[field] !== 'boolean') {
          return res.status(400).json({ error: 'is_verified must be a boolean' });
        }
        values.push(req.body[field]);
        updates.push(`${field} = $${values.length}`);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE odofy_drivers SET ${updates.join(', ')} WHERE uuid = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Update driver error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/drivers/pending', authenticateAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT uuid, first_name, last_name, email, driver_tier, created_at, status FROM odofy_drivers WHERE status IN ('PENDING_REVIEW', 'PENDING_MANUAL_APPROVAL') ORDER BY created_at DESC"
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

router.patch('/drivers/:id/approve', authenticateAdmin, async (req, res) => {
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

    if (driver.status === 'APPROVED') {
      return res.status(200).json({ message: 'Driver already approved', driver });
    }

    const result = await pool.query(
      "UPDATE odofy_drivers SET status = 'APPROVED' WHERE uuid = $1 RETURNING *",
      [driverId]
    );

    const updatedDriver = result.rows[0];

    sendSms(
      updatedDriver.phone_number,
      `Odofy Alert: Welcome to the fleet, ${updatedDriver.first_name}! 🐻 Your ${updatedDriver.driver_tier || 'driver'} profile has been approved. Open your driver dashboard to start claiming active Springfield routes: https://getodofy.com/dashboard`
    ).catch((err) => console.error('Driver approval SMS failed:', err));

    return res.status(200).json(updatedDriver);
  } catch (err) {
    console.error('Driver PATCH approval error:', err);
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

router.get('/merchants/tax', authenticateAdmin, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.uuid,
        m.business_name,
        m.storefront_address,
        m.latitude,
        m.longitude,
        m.api_secret_key,
        m.shop_domain,
        m.free_trial_runs_remaining,
        m.contact_email,
        COALESCE(trip_stats.total_deliveries, 0)::int AS total_deliveries,
        COALESCE(trip_stats.platform_revenue, 0)::numeric AS platform_revenue,
        ROUND(COALESCE(trip_stats.avg_customer_distance, 0)::numeric, 2) AS avg_customer_radius_miles
      FROM odofy_merchants m
      LEFT JOIN (
        SELECT
          t.merchant_id,
          COUNT(*) FILTER (WHERE t.status = 'DELIVERED') AS total_deliveries,
          COALESCE(SUM(t.merchant_fee) FILTER (WHERE t.status = 'DELIVERED'), 0) AS platform_revenue,
          AVG(
            3959 * acos(
              cos(radians(m2.latitude)) * cos(radians(t.dest_latitude))
              * cos(radians(t.dest_longitude) - radians(m2.longitude))
              + sin(radians(m2.latitude)) * sin(radians(t.dest_latitude))
            )
          ) FILTER (WHERE t.status = 'DELIVERED') AS avg_customer_distance
        FROM odofy_trips t
        JOIN odofy_merchants m2 ON m2.uuid = t.merchant_id
        GROUP BY t.merchant_id
      ) trip_stats ON trip_stats.merchant_id = m.uuid
      ORDER BY m.business_name ASC
    `);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Fetch merchants tax error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/analytics', authenticateAdmin, async (_req, res) => {
  try {
    const driverRevenueResult = await pool.query(
      `SELECT COALESCE(SUM(driver_payout + COALESCE(driver_tip_allocation, 0)), 0) AS driver_revenue_pool
       FROM odofy_trips WHERE status = 'DELIVERED'`
    );
    const completedResult = await pool.query(
      `SELECT COUNT(*)::int AS total_completed FROM odofy_trips WHERE status = 'DELIVERED'`
    );
    const platformResult = await pool.query(
      `SELECT COALESCE(SUM(merchant_fee), 0) - COALESCE(SUM(driver_payout), 0) AS platform_net_profit
       FROM odofy_trips WHERE status = 'DELIVERED'`
    );
    const stackedResult = await pool.query(
      `SELECT COUNT(*)::int AS stacked_deliveries FROM odofy_trips
       WHERE batch_id IS NOT NULL AND status = 'DELIVERED'`
    );

    const totalCompletedTrips = completedResult.rows[0].total_completed;
    const driverRevenuePool = parseFloat(driverRevenueResult.rows[0].driver_revenue_pool);
    const platformNetProfit = parseFloat(platformResult.rows[0].platform_net_profit);
    const stackedDeliveries = stackedResult.rows[0].stacked_deliveries;
    const platformMargin = totalCompletedTrips > 0
      ? (platformNetProfit / totalCompletedTrips)
      : 0;

    return res.status(200).json({
      totalCompletedTrips,
      driverRevenuePool,
      platformNetProfit,
      stackedDeliveries,
      platformMargin: Math.round(platformMargin * 100) / 100,
    });
  } catch (err) {
    console.error('Fetch analytics error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/taxes', authenticateAdmin, async (_req, res) => {
  try {
    const driverResult = await pool.query(`
      SELECT
        d.uuid AS driver_id,
        d.first_name,
        d.last_name,
        d.email,
        d.phone_number,
        d.driver_tier,
        d.status,
        d.current_latitude,
        d.current_longitude,
        d.location_updated_at,
        d.is_verified,
        d.license_number,
        d.vehicle_make_model,
        d.created_at AS registered_at,
        COALESCE(SUM(t.driver_payout), 0) AS total_base_fares,
        COALESCE(SUM(t.driver_tip_allocation), 0) AS total_tips_bonus,
        COALESCE(SUM(t.driver_payout), 0) + COALESCE(SUM(t.driver_tip_allocation), 0) AS gross_earnings
      FROM odofy_drivers d
      LEFT JOIN odofy_trips t ON t.driver_id = d.uuid AND t.status = 'DELIVERED'
        AND EXTRACT(YEAR FROM t.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY d.uuid, d.first_name, d.last_name, d.email, d.phone_number,
        d.driver_tier, d.status, d.current_latitude, d.current_longitude,
        d.location_updated_at, d.is_verified, d.license_number,
        d.vehicle_make_model, d.created_at
      ORDER BY gross_earnings DESC
    `);

    const fleetResult = await pool.query(`
      SELECT
        COALESCE(SUM(driver_payout + COALESCE(driver_tip_allocation, 0)), 0) AS total_fleet_earnings,
        COUNT(DISTINCT driver_id) FILTER (WHERE driver_id IS NOT NULL
          AND (driver_payout + COALESCE(driver_tip_allocation, 0)) >= 600) AS drivers_over_600
      FROM odofy_trips
      WHERE status = 'DELIVERED'
        AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
    `);

    return res.status(200).json({
      drivers: driverResult.rows,
      total_fleet_earnings: parseFloat(fleetResult.rows[0].total_fleet_earnings),
      drivers_over_600: parseInt(fleetResult.rows[0].drivers_over_600),
    });
  } catch (err) {
    console.error('Tax ledger error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
