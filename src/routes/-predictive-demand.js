const express = require('express');
const router = express.Router();
const pool = require('../db.js');
const { authenticateDriver } = require('../middleware/auth');

// GET /api/v1/driver/predictive-demand
// Returns heatmap data: merchant coordinates weighted by historical order volume
router.get('/predictive-demand', authenticateDriver, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.latitude,
        m.longitude,
        m.business_name AS zone_name,
        EXTRACT(HOUR FROM t.created_at) AS hour_block,
        COUNT(*)::int AS order_count
      FROM odofy_trips t
      JOIN odofy_merchants m ON t.merchant_id = m.uuid
      WHERE t.created_at >= NOW() - INTERVAL '14 days'
      GROUP BY m.latitude, m.longitude, m.business_name, EXTRACT(HOUR FROM t.created_at)
      ORDER BY order_count DESC
    `);

    if (result.rows.length === 0) {
      res.set('Cache-Control', 'max-age=300');
      return res.json([]);
    }

    // Find max order count for normalization
    const maxCount = Math.max(...result.rows.map(r => r.order_count));

    const heatmap = result.rows.map(row => ({
      lat: parseFloat(row.latitude),
      lng: parseFloat(row.longitude),
      weight: maxCount > 0 ? Math.round((row.order_count / maxCount) * 100) / 100 : 0,
      zone_name: row.zone_name,
    }));

    res.set('Cache-Control', 'max-age=300');
    return res.json(heatmap);
  } catch (err) {
    console.error('Predictive demand query error:', err);
    return res.status(500).json({ error: 'Failed to fetch predictive demand data' });
  }
});

module.exports = router;
