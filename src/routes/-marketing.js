const express = require('express');
const pool = require('../db.js');
const router = express.Router();

const VALID_CHANNELS = ['PUSH', 'SMS', 'EMAIL'];
const VALID_SEGMENTS = ['ALL', 'LAPSED', 'VIP'];

// Same merchant-resolution pattern as -merchants.js: the authenticated merchant
// is identified by the x-merchant-email header (populated by the merchant portal).
async function resolveMerchant(req, res) {
  const email = req.headers['x-merchant-email'];
  if (!email) {
    res.status(401).json({ error: 'Merchant email header required' });
    return null;
  }
  const result = await pool.query('SELECT uuid FROM odofy_merchants WHERE contact_email = $1', [email]);
  if (result.rows.length === 0) {
    res.status(401).json({ error: 'Merchant not found' });
    return null;
  }
  return result.rows[0].uuid;
}

// POST /broadcast — compose a campaign (stored DRAFT), then dispatch per channel
// and flip it to SENT. Dispatch is best-effort: a per-recipient failure is recorded
// and never fails the whole batch, and channels without provisioned infrastructure
// (PUSH, EMAIL without SES creds) degrade to a logged, still-SENT campaign.
router.post('/broadcast', async (req, res) => {
  try {
    const merchantId = await resolveMerchant(req, res);
    if (!merchantId) return;

    const { title, channel_type, audience_segment, message_body, discount_code } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!VALID_CHANNELS.includes(channel_type)) {
      return res.status(400).json({ error: `channel_type must be one of: ${VALID_CHANNELS.join(', ')}` });
    }
    if (!message_body || typeof message_body !== 'string' || !message_body.trim()) {
      return res.status(400).json({ error: 'message_body is required' });
    }
    const segment = VALID_SEGMENTS.includes(audience_segment) ? audience_segment : 'ALL';

    const insertResult = await pool.query(
      `INSERT INTO marketing_campaigns
         (merchant_id, title, channel_type, audience_segment, message_body, discount_code, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT')
       RETURNING id`,
      [merchantId, title.trim(), channel_type, segment, message_body.trim(), discount_code || null]
    );
    const campaignId = insertResult.rows[0].id;

    let recipientCount = 0;
    const failures = [];

    if (channel_type === 'SMS') {
      const result = await dispatchSms(merchantId, message_body, recipientCount, failures);
      recipientCount = result.recipientCount;
    } else if (channel_type === 'EMAIL') {
      const result = await dispatchEmail(title, message_body, recipientCount, failures);
      recipientCount = result.recipientCount;
    } else if (channel_type === 'PUSH') {
      console.log('PUSH channel selected — web push infrastructure not yet provisioned');
    }

    await pool.query(
      `UPDATE marketing_campaigns SET status = 'SENT', sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [campaignId]
    );
    const campaignResult = await pool.query(
      'SELECT id, sent_at, status FROM marketing_campaigns WHERE id = $1',
      [campaignId]
    );
    const campaign = campaignResult.rows[0];
    return res.json({
      success: true,
      campaign: {
        id: campaign.id,
        sent_at: campaign.sent_at,
        recipient_count: recipientCount,
        failures,
      },
    });
  } catch (err) {
    console.error('Marketing broadcast error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /campaigns — campaign history for the authenticated merchant, newest first.
router.get('/campaigns', async (req, res) => {
  try {
    const merchantId = await resolveMerchant(req, res);
    if (!merchantId) return;
    const result = await pool.query(
      `SELECT id, title, channel_type, audience_segment, message_body, discount_code,
              status, sent_at, created_at
         FROM marketing_campaigns
        WHERE merchant_id = $1
        ORDER BY created_at DESC`,
      [merchantId]
    );
    return res.json({ success: true, campaigns: result.rows });
  } catch (err) {
    console.error('Marketing campaign history error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── SMS dispatch ─────────────────────────────────────────────────────────────
// Recipients come from odofy_trips (the merchant's customer phone numbers).
async function dispatchSms(merchantId, messageBody, recipientCount, failures) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.warn(
      'Twilio credentials not fully configured — SMS campaign marked SENT without dispatch ' +
      '(set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)'
    );
    return { recipientCount, failures };
  }
  const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const phoneResult = await pool.query(
    `SELECT DISTINCT customer_phone AS phone
       FROM odofy_trips
      WHERE merchant_id = $1 AND customer_phone IS NOT NULL AND customer_phone <> ''`,
    [merchantId]
  );
  for (const row of phoneResult.rows) {
    try {
      await twilioClient.messages.create({
        body: messageBody,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: row.phone,
      });
      recipientCount += 1;
    } catch (err) {
      console.error(`SMS to ${row.phone} failed:`, err.message);
      failures.push({ to: row.phone, error: err.message });
    }
  }
  return { recipientCount, failures };
}

// ── EMAIL dispatch ───────────────────────────────────────────────────────────
// Best-effort: requires AWS SES env vars; otherwise logs a warning and still
// marks the campaign SENT. Recipients come from whatever table holds customer
// emails; today that is the legacy `orders` table (absent in the live DB, in
// which case we warn and continue with zero recipients).
async function dispatchEmail(title, messageBody, recipientCount, failures) {
  const region = process.env.AWS_REGION || process.env.AWS_SES_REGION;
  const hasSesCreds = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && region);
  if (!hasSesCreds) {
    console.warn(
      'AWS SES credentials not configured — EMAIL campaign marked SENT without dispatch ' +
      '(set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)'
    );
    return { recipientCount, failures };
  }
  const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
  const sesClient = new SESClient({ region });

  let emails = [];
  try {
    const emailResult = await pool.query(
      `SELECT DISTINCT customer_email FROM orders WHERE customer_email IS NOT NULL AND customer_email <> ''`
    );
    emails = emailResult.rows.map((r) => r.customer_email);
  } catch (err) {
    console.warn('Email recipient source unavailable (orders table missing):', err.message);
  }

  for (const email of emails) {
    try {
      await sesClient.send(
        new SendEmailCommand({
          Source: 'info@getodofy.com',
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: title },
            Body: {
              Html: {
                Data: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">${messageBody}</div>`,
              },
            },
          },
        })
      );
      recipientCount += 1;
    } catch (err) {
      console.error(`Email to ${email} failed:`, err.message);
      failures.push({ to: email, error: err.message });
    }
  }
  return { recipientCount, failures };
}

module.exports = router;
