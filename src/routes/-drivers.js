const express = require('express');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db.js');
const { authenticateDriver } = require('../middleware/auth');

const router = express.Router();

(async () => {
  try {
    await pool.query('ALTER TABLE odofy_drivers ADD COLUMN IF NOT EXISTS backup_email TEXT');
    await pool.query("ALTER TABLE odofy_drivers ADD COLUMN IF NOT EXISTS driver_tier TEXT DEFAULT 'PUBLIC_BACKUP'");
  } catch (err) {
    console.error('Driver table migration error:', err);
  }
})();

const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = {
      license_photo: /^image\//,
      insurance_proof: /^(image\/|application\/pdf$)/,
      profile_photo: /^image\//,
    };
    const regex = allowed[file.fieldname];
    if (!regex || !regex.test(file.mimetype)) {
      return cb(new Error(`Invalid file type for ${file.fieldname}`));
    }
    cb(null, true);
  },
});

const uploadFields = upload.fields([
  { name: 'license_photo', maxCount: 1 },
  { name: 'insurance_proof', maxCount: 1 },
  { name: 'profile_photo', maxCount: 1 },
]);

const PUBLIC_BASE = 'https://getodofy.com/uploads';

router.post('/register', (req, res, next) => {
  uploadFields(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { first_name, last_name, phone_number, vehicle_make_model, email, backup_email, admin_override } = req.body;

    const missing = [];
    if (!first_name) missing.push('first_name');
    if (!last_name) missing.push('last_name');
    if (!phone_number) missing.push('phone_number');
    if (!vehicle_make_model) missing.push('vehicle_make_model');
    if (!req.files || !req.files.license_photo) missing.push('license_photo');
    if (!req.files || !req.files.insurance_proof) missing.push('insurance_proof');
    if (!req.files || !req.files.profile_photo) missing.push('profile_photo');

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    const licensePhotoFile = req.files.license_photo[0];
    const insuranceProofFile = req.files.insurance_proof[0];
    const profilePhotoFile = req.files.profile_photo[0];

    const license_photo_url = `${PUBLIC_BASE}/${licensePhotoFile.filename}`;
    const insurance_proof_url = `${PUBLIC_BASE}/${insuranceProofFile.filename}`;
    const profile_photo_url = `${PUBLIC_BASE}/${profilePhotoFile.filename}`;

    const authToken = crypto.randomBytes(32).toString('hex');

    const driverEmail = email && typeof email === 'string' && email.trim() ? email.trim() : null;
    const driverBackupEmail = backup_email && typeof backup_email === 'string' && backup_email.trim() ? backup_email.trim() : null;

    // --- ADMINISTRATIVE BYPASS ---
    // Master admin email bypasses background checks, W-9 hold, and waitlist queue
    const MASTER_ADMIN_EMAIL = 'support@getodofy.com';
    const isAdminOverride =
      admin_override === 'true' &&
      driverEmail &&
      driverEmail.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

    const isStudentEmail = driverEmail && driverEmail.toLowerCase().endsWith('.edu');
    const driverTier = isAdminOverride ? 'STUDENT_COURIER' : (isStudentEmail ? 'STUDENT_COURIER' : 'PUBLIC_BACKUP');
    const driverStatus = isAdminOverride ? 'APPROVED' : 'PENDING_MANUAL_APPROVAL';

    const result = await pool.query(
      `INSERT INTO odofy_drivers
         (uuid, first_name, last_name, phone_number, auth_token,
          license_photo_url, insurance_proof_url, profile_photo_url, vehicle_make_model,
          email, backup_email, driver_tier, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        uuidv4(),
        first_name,
        last_name,
        phone_number,
        authToken,
        license_photo_url,
        insurance_proof_url,
        profile_photo_url,
        vehicle_make_model,
        driverEmail,
        driverBackupEmail,
        driverTier,
        driverStatus,
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

router.get('/earnings', authenticateDriver, async (req, res) => {
  try {
    const driverId = req.driver.uuid;
    const result = await pool.query(
      `SELECT uuid, customer_name, delivery_address, driver_payout, driver_tip_allocation,
              batch_id, created_at, status
       FROM odofy_trips
       WHERE driver_id = $1 AND status = 'DELIVERED'
       ORDER BY created_at DESC`,
      [driverId]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Driver earnings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/notifications', authenticateDriver, async (req, res) => {
  try {
    const driverId = req.driver.uuid;
    const result = await pool.query(
      'SELECT * FROM odofy_notifications WHERE driver_id = $1 ORDER BY created_at DESC',
      [driverId]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Driver notifications error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/profile', authenticateDriver, async (req, res) => {
  try {
    const { uuid, first_name, last_name, phone_number, email, status,
            profile_photo_url, license_photo_url, insurance_proof_url,
            vehicle_make_model, created_at, is_verified, insurance_expiration,
            license_number, vehicle_color, license_plate, driver_tier, backup_email,
            needs_periodic_identity_check, last_identity_check_at, is_first_login,
            session_valid } = req.driver;
    return res.status(200).json({
      uuid, first_name, last_name, phone_number, email, status,
      profile_photo_url, license_photo_url, insurance_proof_url,
      vehicle_make_model, created_at, is_verified, insurance_expiration,
      license_number, vehicle_color, license_plate, driver_tier, backup_email,
      needs_periodic_identity_check, last_identity_check_at, is_first_login,
      session_valid
    });
  } catch (err) {
    console.error('Driver profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/clear-first-login', authenticateDriver, async (req, res) => {
  try {
    await pool.query('UPDATE odofy_drivers SET is_first_login = false WHERE uuid = $1', [req.driver.uuid]);
    return res.status(200).json({ status: 'ok', is_first_login: false });
  } catch (err) {
    console.error('Clear first login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/feedback', authenticateDriver, async (req, res) => {
  try {
    const { reasons, details, trip_id } = req.body;

    if (!reasons || !Array.isArray(reasons)) {
      return res.status(400).json({ error: 'reasons must be a non-empty array of strings' });
    }

    console.log(
      `[DRIVER FEEDBACK] driver=${req.driver.uuid} trip=${trip_id || 'N/A'} reasons=[${reasons.join(', ')}] details="${(details || '').trim()}"`
    );

    return res.status(200).json({ status: 'feedback_received' });
  } catch (err) {
    console.error('Driver feedback error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/online', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM odofy_drivers
       WHERE status = 'ACTIVE'
         AND location_updated_at > NOW() - INTERVAL '30 minutes'`
    );
    return res.status(200).json({ count: result.rows[0].count });
  } catch (err) {
    console.error('Online drivers count error:', err);
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
