const express = require('express');
const pool = require('../db.js');
const { sendTransactionalEmail } = require('../lib/email');
const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Where demo-request lead notifications are delivered.
const NOTIFY_EMAIL = process.env.ODOFY_DEMO_NOTIFY_EMAIL || 'support@getodofy.com';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

    // Notify the business at support@getodofy.com. The lead is already persisted,
    // so a missing/unconfigured email transport never fails the request.
    try {
      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
          <div style="background:#5E0009;padding:20px 24px">
            <h2 style="margin:0;color:#ffffff;font-size:18px">New Demo Request</h2>
          </div>
          <div style="padding:24px">
            <p style="margin:0 0 16px;color:#6b7280;font-size:13px">A restaurant just requested a free demo through the Odofy Book a Free Demo form.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:8px 0;color:#6b7280;width:140px">Contact name</td><td style="padding:8px 0;font-weight:700;color:#111827">${escapeHtml(name)}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Restaurant</td><td style="padding:8px 0;font-weight:700;color:#111827">${escapeHtml(restaurantName)}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Email</td><td style="padding:8px 0;color:#111827"><a href="mailto:${escapeHtml(email)}" style="color:#5E0009">${escapeHtml(email)}</a></td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Phone</td><td style="padding:8px 0;color:#111827">${escapeHtml(phone)}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Locations</td><td style="padding:8px 0;color:#111827">${escapeHtml(locations) || '—'}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Current provider</td><td style="padding:8px 0;color:#111827">${escapeHtml(currentProvider) || '—'}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;vertical-align:top">Message</td><td style="padding:8px 0;color:#111827">${escapeHtml(message) || '—'}</td></tr>
            </table>
            <p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px">Submitted ${new Date(row.created_at).toUTCString()} · Lead ID ${row.uuid}</p>
          </div>
        </div>`;

      const messageId = await sendTransactionalEmail(
        NOTIFY_EMAIL,
        `New Demo Request — ${restaurantName}`,
        html
      );
      if (messageId) {
        console.log(`Demo request email sent to ${NOTIFY_EMAIL}: ${messageId}`);
      } else {
        console.log(`Demo request email not sent (SES unconfigured) — lead ${row.uuid} still stored`);
      }
    } catch (emailErr) {
      console.error('Demo request email error:', emailErr.message);
    }

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Demo request insert error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
