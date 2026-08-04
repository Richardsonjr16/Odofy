const express = require('express');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../../db.js');
const { authenticateDriver } = require('../../middleware/auth');

const router = express.Router();
const uploadsDir = path.resolve(__dirname, '../../../uploads');
const PUBLIC_BASE = process.env.PUBLIC_UPLOADS_URL || 'https://getodofy.com/uploads';
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${uuidv4()}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

const fields = upload.fields([
  { name: 'front', maxCount: 1 },
  { name: 'left', maxCount: 1 },
  { name: 'right', maxCount: 1 },
]);

router.get('/:driverId/identity-checks', authenticateDriver, async (req, res) => {
  try {
    if (req.driver.uuid !== req.params.driverId) return res.status(403).json({ error: 'Forbidden' });
    const result = await pool.query(
      `SELECT id, driver_id, front_view_url, left_view_url, right_view_url, status, created_at
       FROM drivers_identity_checks WHERE driver_id = $1 ORDER BY created_at DESC`,
      [req.params.driverId]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Fetch driver identity checks error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/verify-identity', authenticateDriver, (req, res, next) => fields(req, res, (err) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
}), async (req, res) => {
  try {
    const { driver_id: driverId } = req.body;
    const files = req.files || {};
    if (!driverId || !files.front?.[0] || !files.left?.[0] || !files.right?.[0]) {
      return res.status(400).json({ error: 'driver_id and front, left, right image files are required' });
    }
    const driver = await pool.query('SELECT uuid FROM odofy_drivers WHERE uuid = $1', [driverId]);
    if (!driver.rows.length) return res.status(404).json({ error: 'Driver not found' });
    const urls = ['front', 'left', 'right'].map((name) => `${PUBLIC_BASE}/${files[name][0].filename}`);
    const result = await pool.query(
      `INSERT INTO drivers_identity_checks (id, driver_id, front_view_url, left_view_url, right_view_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [uuidv4(), driverId, ...urls]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Identity verification upload error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
