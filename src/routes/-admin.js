const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db.js');
const { sendSms } = require('../lib/sms');

const router = express.Router();

// Accept .xlsx, .xls, .csv lead spreadsheets (shared config with -lead-scrub.js)
const upload = multer({
  dest: path.join(__dirname, '..', '..', 'uploads', 'scrubber'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, and .csv files are accepted'));
    }
  },
});

// Ensure upload dir exists
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'scrubber');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const disputeListFields = `
  d.id, d.order_id, d.order_id AS order_number, d.merchant_id, d.customer_id, d.reason_category,
  d.description, d.proof_image_url, d.status, d.created_at,
  t.uuid AS trip_id, t.customer_name, t.delivery_address, t.proof_of_delivery_url,
  m.business_name,
  CASE WHEN dr.uuid IS NOT NULL THEN CONCAT(dr.first_name, ' ', dr.last_name) END AS driver_name,
  dr.uuid AS driver_id
`;

function authenticateAdmin(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.ODOFY_ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

router.get('/disputes', authenticateAdmin, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT ${disputeListFields}
      FROM disputes_ledger d
      LEFT JOIN odofy_trips t ON t.uuid = d.order_id
      LEFT JOIN odofy_merchants m ON m.uuid = d.merchant_id
      LEFT JOIN odofy_drivers dr ON dr.uuid = t.driver_id
      ORDER BY d.created_at DESC
    `);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Fetch disputes error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/disputes/:id', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ${disputeListFields}
      FROM disputes_ledger d
      LEFT JOIN odofy_trips t ON t.uuid = d.order_id
      LEFT JOIN odofy_merchants m ON m.uuid = d.merchant_id
      LEFT JOIN odofy_drivers dr ON dr.uuid = t.driver_id
      WHERE d.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dispute not found' });
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Fetch dispute error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/disputes/:id/resolve', authenticateAdmin, async (req, res) => {
  const { action } = req.body || {};
  if (!['APPROVE', 'DENY'].includes(action)) {
    return res.status(400).json({ error: "action must be 'APPROVE' or 'DENY'" });
  }
  try {
    const status = action === 'APPROVE' ? 'APPROVED_CREDIT' : 'DENIED_DISPUTE';
    const result = await pool.query(`
      UPDATE disputes_ledger
      SET status = $1, resolved_at = NOW(),
          resolution_notes = $2
      WHERE id = $3 AND status = 'PENDING'
      RETURNING *
    `, [status, action === 'APPROVE' ? 'Merchant credit approved; Stripe credit execution pending integration.' : 'Dispute denied by administration.', req.params.id]);
    if (result.rows.length === 0) {
      const existing = await pool.query('SELECT status FROM disputes_ledger WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Dispute not found' });
      return res.status(400).json({ error: 'Dispute is already resolved' });
    }
    const updated = await pool.query(`
      SELECT ${disputeListFields}
      FROM disputes_ledger d
      LEFT JOIN odofy_trips t ON t.uuid = d.order_id
      LEFT JOIN odofy_merchants m ON m.uuid = d.merchant_id
      LEFT JOIN odofy_drivers dr ON dr.uuid = t.driver_id
      WHERE d.id = $1
    `, [req.params.id]);
    console.info('Stripe credit execution hook', { disputeId: req.params.id, action, status: 'NOT_WIRED' });
    return res.status(200).json({ dispute: updated.rows[0], credit_execution: 'pending_stripe_integration' });
  } catch (err) {
    console.error('Resolve dispute error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

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

// Rolling 14-day periodic identity re-verification: flag drivers whose last
// successful identity check is stale so their dashboard prompts a new check.
// Intended to be called by an external cron/scheduler; requires the admin API
// key (x-api-key header). Accepts both GET and POST for cron compatibility.
const resetIdentityFlagsHandler = async (_req, res) => {
  try {
    const result = await pool.query(
      `UPDATE odofy_drivers
       SET needs_periodic_identity_check = true
       WHERE needs_periodic_identity_check = false
         AND last_identity_check_at < NOW() - INTERVAL '14 days'`
    );
    return res.status(200).json({ updated: result.rowCount });
  } catch (err) {
    console.error('Reset identity flags error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
router.get('/reset-identity-flags', authenticateAdmin, resetIdentityFlagsHandler);
router.post('/reset-identity-flags', authenticateAdmin, resetIdentityFlagsHandler);

// Force-reset a driver's auth token: rotate the token, invalidate the current
// session, and notify the driver via SMS so they re-authenticate. The dashboard
// logs the driver out via the 401 from the rotated token and/or the
// session_valid = false flag returned by the profile endpoint.
router.post('/drivers/:id/reset-token', authenticateAdmin, async (req, res) => {
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

    const crypto = require('crypto');
    const newToken = crypto.randomBytes(32).toString('hex');

    await pool.query(
      'UPDATE odofy_drivers SET auth_token = $1, session_valid = false WHERE uuid = $2',
      [newToken, driverId]
    );

    sendSms(
      driver.phone_number,
      'Odofy Security Alert: Your active login token has been reset by administration. Your session has been securely terminated. Please re-authenticate at https://getodofy.com or contact support@getodofy.com.'
    ).catch((err) => console.error('Token reset SMS failed:', err));

    return res.status(200).json({
      success: true,
      message: 'Driver session invalidated and SMS alert sent successfully.',
    });
  } catch (err) {
    console.error('Token reset error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/drivers/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const allowedFields = [
    'first_name',
    'last_name',
    'email',
    'phone_number',
    'vehicle_make_model',
    'vehicle_color',
    'license_plate',
    'license_number',
    'insurance_expiration',
    'driver_tier',
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
    if (err && err.code === '23505') {
      return res
        .status(409)
        .json({ error: 'Email is already in use by another driver.' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/drivers/:id/identity-checks', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, driver_id, front_view_url, left_view_url, right_view_url, status, created_at
       FROM drivers_identity_checks WHERE driver_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Fetch identity checks error:', err);
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

// POST /api/v1/odofy/admin/lead-scrub — admin-scoped lead boundary scrub.
// Uploads a lead spreadsheet, filters rows to a 12-minute driving radius of
// Park Central Square, and returns a downloadable XLSX with three sheets.
router.post(
  '/lead-scrub',
  authenticateAdmin,
  upload.single('file'),
  async (req, res) => {
    // Clean up the uploaded temp file (no-op if it no longer exists).
    const cleanup = () => {
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupErr) {
          console.error('Lead scrub temp cleanup error:', cleanupErr);
        }
      }
    };

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded. Attach a .xlsx, .xls, or .csv file with key "file".' });
      }

      const XLSX = require('xlsx');
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to array of objects, using header row as keys
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rawRows.length === 0) {
        cleanup();
        return res.status(400).json({ error: 'Spreadsheet is empty or has no data rows.' });
      }

      // Normalize column names to lowercase and map to LeadRow shape
      const leadRows = rawRows.map((row) => {
        const normalized = {};
        for (const [key, val] of Object.entries(row)) {
          normalized[key.toLowerCase().trim()] = val;
        }
        return {
          address: normalized.address || normalized.street || normalized.street_address || undefined,
          lat: parseFloat(normalized.lat || normalized.latitude) || undefined,
          lng: parseFloat(normalized.lng || normalized.longitude || normalized.lon) || undefined,
          // Pass through original data
          _original: row,
        };
      });

      // Import and run the scrubber
      const { scrubLeads } = require('../utils/leadScrubber');
      const result = await scrubLeads(leadRows);

      // Build output workbook
      const outRows = result.kept.map((r) => ({
        Address: r.address || '',
        Latitude: r.lat ?? '',
        Longitude: r.lng ?? '',
        'Transit Time': r.transit_label,
        'Transit Seconds': r.transit_seconds,
        Status: 'KEPT',
        ...r._original,
      }));

      // Dropped rows in a second sheet for diagnostics
      const droppedRows = result.dropped.map((r) => ({
        Address: r.address || '',
        Latitude: r.lat ?? '',
        Longitude: r.lng ?? '',
        'Transit Time': r.transit_label,
        'Transit Seconds': r.transit_seconds,
        Status: 'DROPPED (>12 min)',
        ...r._original,
      }));

      const outWb = XLSX.utils.book_new();
      const keptSheet = XLSX.utils.json_to_sheet(outRows);
      XLSX.utils.book_append_sheet(outWb, keptSheet, 'Kept (within 12 min)');

      const droppedSheet = XLSX.utils.json_to_sheet(droppedRows);
      XLSX.utils.book_append_sheet(outWb, droppedSheet, 'Dropped (over 12 min)');

      // Summary sheet
      const summarySheet = XLSX.utils.json_to_sheet([
        { 'Total Rows': result.summary.total, Kept: result.summary.kept, Dropped: result.summary.dropped },
      ]);
      XLSX.utils.book_append_sheet(outWb, summarySheet, 'Summary');

      // Write to buffer and send
      const buf = XLSX.write(outWb, { type: 'buffer', bookType: 'xlsx' });

      // Clean up temp file after sending the response
      res.on('finish', cleanup);
      res.on('close', cleanup);

      const originalName = path.parse(req.file.originalname).name;
      res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.set('Content-Disposition', `attachment; filename="${originalName}-scrubbed.xlsx"`);
      return res.send(buf);
    } catch (err) {
      console.error('Admin lead scrub error:', err);
      cleanup();
      return res.status(500).json({ error: err.message || 'Scrub failed' });
    }
  },
);

module.exports = router;
