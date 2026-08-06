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

router.get('/products', async (req, res) => {
  try {
    const merchantId = await resolveMerchant(req, res);
    if (!merchantId) return;
    const result = await pool.query('SELECT * FROM merchant_products WHERE merchant_id = $1 ORDER BY created_at DESC', [merchantId]);
    return res.json(result.rows);
  } catch (err) {
    console.error('Merchant products fetch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/products', async (req, res) => {
  try {
    const merchantId = await resolveMerchant(req, res);
    if (!merchantId) return;
    const { title, description, price_cents, image_url } = req.body || {};
    if (!title || !Number.isInteger(price_cents) || price_cents < 0) return res.status(400).json({ error: 'title and non-negative integer price_cents are required' });
    const result = await pool.query(
      'INSERT INTO merchant_products (merchant_id, title, description, price_cents, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [merchantId, title.trim(), description || null, price_cents, image_url || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Merchant product create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/products/:id/toggle-stock', async (req, res) => {
  try {
    const merchantId = await resolveMerchant(req, res);
    if (!merchantId) return;
    if (typeof req.body?.in_stock !== 'boolean') return res.status(400).json({ error: 'in_stock must be boolean' });
    const result = await pool.query('UPDATE merchant_products SET in_stock = $1, updated_at = NOW() WHERE id = $2 AND merchant_id = $3 RETURNING *', [req.body.in_stock, req.params.id, merchantId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Merchant product stock update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/products/:id', async (req, res) => {
  try {
    const merchantId = await resolveMerchant(req, res);
    if (!merchantId) return;
    const allowed = ['title', 'description', 'price_cents', 'image_url'];
    const entries = Object.entries(req.body || {}).filter(([key, value]) => allowed.includes(key) && value !== undefined);
    if (!entries.length) return res.status(400).json({ error: 'No editable fields supplied' });
    if (entries.some(([key, value]) => key === 'title' && (!value || typeof value !== 'string') || key === 'price_cents' && (!Number.isInteger(value) || value < 0))) return res.status(400).json({ error: 'Invalid product fields' });
    const values = entries.map(([, value]) => value);
    const setClause = entries.map(([key], index) => `${key} = $${index + 1}`).concat('updated_at = NOW()').join(', ');
    values.push(req.params.id, merchantId);
    const result = await pool.query(`UPDATE merchant_products SET ${setClause} WHERE id = $${values.length - 1} AND merchant_id = $${values.length} RETURNING *`, values);
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Merchant product update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const merchantId = await resolveMerchant(req, res);
    if (!merchantId) return;
    const result = await pool.query('DELETE FROM merchant_products WHERE id = $1 AND merchant_id = $2 RETURNING id', [req.params.id, merchantId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    return res.status(204).send();
  } catch (err) {
    console.error('Merchant product delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/fulfillment', async (req, res) => {
  try {
    const merchantId = await resolveMerchant(req, res);
    if (!merchantId) return;
    const result = await pool.query(`SELECT t.uuid, t.order_number, t.status, t.customer_name, t.delivery_address, NULLIF(TRIM(CONCAT(d.first_name, ' ', d.last_name)), '') AS driver_name, t.proof_of_delivery_url, t.created_at FROM odofy_trips t LEFT JOIN odofy_drivers d ON d.uuid = t.driver_id WHERE t.merchant_id = $1 ORDER BY t.created_at DESC LIMIT 50`, [merchantId]);
    return res.json(result.rows);
  } catch (err) {
    console.error('Merchant fulfillment fetch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
