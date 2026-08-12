const express = require('express');
const pool = require('../db.js');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', async (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const restaurantName = typeof body.restaurant_name === 'string' ? body.restaurant_name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!restaurantName) {
    return res.status(400).json({ error: 'restaurant_name is required' });
  }
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'email must be a valid email address' });
  }
  if (!phone) {
    return res.status(400).json({ error: 'phone is required' });
  }

  const locations = typeof body.locations === 'string' && body.locations.trim() ? body.locations.trim() : null;
  const currentProvider = typeof body.current_provider === 'string' && body.current_provider.trim() ? body.current_provider.trim() : null;
  const message = typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null;

  try {
    const result = await pool.query(
      `INSERT INTO odofy_demo_requests (name, restaurant_name, email, phone, locations, current_provider, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING uuid, created_at`,
      [name, restaurantName, email, phone, locations, currentProvider, message]
    );
    const row = result.rows[0];
    console.log(`Demo request lead captured: ${row.uuid} | ${restaurantName} | ${email} | ${phone}`);
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Demo request insert error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
