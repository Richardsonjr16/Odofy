const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db.js');
const { geocodeAddress } = require('../lib/geocode');
const { sendTransactionalEmail } = require('../lib/email');

const router = express.Router();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

router.post('/register', async (req, res) => {
  try {
    const { business_name, storefront_address, shop_domain, contact_email, password } = req.body;

    if (!business_name || !storefront_address) {
      return res.status(400).json({
        error: 'Missing required fields: business_name, storefront_address',
      });
    }

    let latitude;
    let longitude;
    try {
      const geoResult = await geocodeAddress(storefront_address);
      latitude = geoResult.latitude;
      longitude = geoResult.longitude;
    } catch (err) {
      return res.status(400).json({ error: `Geocoding failed: ${err.message}` });
    }

    const apiSecretKey = crypto.randomBytes(32).toString('hex');

    const passwordHash = password ? hashPassword(password) : null;
    const email = contact_email || null;

    const result = await pool.query(
      `INSERT INTO odofy_merchants
         (uuid, business_name, storefront_address, latitude, longitude, api_secret_key, shop_domain, contact_email, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [uuidv4(), business_name, storefront_address, latitude, longitude, apiSecretKey, shop_domain || null, email, passwordHash]
    );

    const merchant = result.rows[0];

    if (email) {
      const htmlBody = `
        <h1>Welcome to Odofy, ${business_name}!</h1>
        <p>Your merchant account has been created successfully. Here are your setup details:</p>
        <h2>Your API Key</h2>
        <p><code style="background:#f4f4f4;padding:8px 12px;border-radius:4px;font-family:monospace;font-size:14px;">${apiSecretKey}</code></p>
        <h2>Shopify Webhook URL</h2>
        <p><code style="background:#f4f4f4;padding:8px 12px;border-radius:4px;font-family:monospace;font-size:14px;">https://api.getodofy.com/webhooks/shopify</code></p>
        <h2>Getting Started</h2>
        <ol>
          <li>Copy your API key above and store it securely.</li>
          <li>In your Shopify admin, go to <strong>Settings &gt; Notifications &gt; Webhooks</strong>.</li>
          <li>Create a new webhook for <strong>Order paid</strong> events pointing to the URL above.</li>
          <li>Use the API key as the <code>X-API-Key</code> header when pushing orders to Odofy.</li>
        </ol>
        <p>If you have any questions, reply to this email — we're happy to help!</p>
        <p>— The Odofy Team</p>
      `;

      sendTransactionalEmail(
        email,
        'Welcome to Odofy — Your API Key is Ready',
        htmlBody
      ).catch((err) => console.error('Welcome email failed:', err));
    }

    return res.status(201).json(merchant);
  } catch (err) {
    console.error('Merchant registration error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const result = await pool.query(
      'SELECT * FROM odofy_merchants WHERE contact_email = $1 AND password_hash = $2',
      [email, hashPassword(password)]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    return res.status(200).json({ merchant: result.rows[0] });
  } catch (err) {
    console.error('Merchant login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /orders — fetch merchant orders + Stripe transactions for the portal
router.get('/orders', async (req, res) => {
  try {
    const email = req.headers['x-merchant-email'];

    if (!email) {
      // Return empty arrays if no email header — portal shows empty state
      return res.json({ orders: [], transactions: [] });
    }

    // Find merchant by email
    const merchantResult = await pool.query(
      `SELECT uuid FROM odofy_merchants WHERE contact_email = $1`,
      [email]
    );

    if (merchantResult.rows.length === 0) {
      return res.json({ orders: [], transactions: [] });
    }

    const storeId = merchantResult.rows[0].uuid;

    // Fetch orders
    const ordersResult = await pool.query(
      `SELECT id, customer_email, subtotal_cents, delivery_fee_cents,
              total_cents, status, route_sequence_index, created_at,
              delivery_address
       FROM orders
       WHERE store_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [storeId]
    );

    return res.json({
      orders: ordersResult.rows,
      transactions: [],
    });
  } catch (err) {
    console.error('Merchant orders fetch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
