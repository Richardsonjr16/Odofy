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
function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
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

    // Auto-generate a unique slug from business_name for the public storefront.
    const baseSlug = slugify(business_name) || 'merchant';
    let slug = baseSlug;
    const slugExists = await pool.query('SELECT 1 FROM odofy_merchants WHERE slug = $1 LIMIT 1', [slug]);
    if (slugExists.rows.length) {
      slug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
    }

    const result = await pool.query(
      `INSERT INTO odofy_merchants
         (uuid, business_name, storefront_address, latitude, longitude, api_secret_key, shop_domain, contact_email, password_hash, slug)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [uuidv4(), business_name, storefront_address, latitude, longitude, apiSecretKey, shop_domain || null, email, passwordHash, slug]
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

// GET /public-products — public storefront catalog (no auth required)
router.get('/public-products', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.title, p.description, p.price_cents, p.image_url, p.in_stock, p.merchant_id,
              m.business_name AS merchant_name, m.slug AS merchant_slug
       FROM merchant_products p
       LEFT JOIN odofy_merchants m ON m.uuid = p.merchant_id
       ORDER BY p.created_at DESC`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Public products fetch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/products/:id/update-inventory', async (req, res) => {
  try {
    const merchantId = await resolveMerchant(req, res);
    if (!merchantId) return;
    const { in_stock, price } = req.body || {};
    if (typeof in_stock !== 'boolean' || !Number.isInteger(price) || price < 0) {
      return res.status(400).json({ error: 'in_stock (boolean) and price (non-negative integer cents) are required' });
    }
    const result = await pool.query(
      'UPDATE merchant_products SET in_stock = $1, price_cents = $2, updated_at = NOW() WHERE id = $3 AND merchant_id = $4 RETURNING *',
      [in_stock, price, req.params.id, merchantId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    return res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.error('Merchant product inventory update error:', err);
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

// ── Public storefront: merchant by slug ──
router.get('/store/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT uuid, business_name, slug, storefront_address, latitude, longitude FROM odofy_merchants WHERE slug = $1',
      [req.params.slug]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Store not found' });
    return res.json({ merchant: result.rows[0] });
  } catch (err) {
    console.error('Store slug lookup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/store/:slug/products', async (req, res) => {
  try {
    const merchant = await pool.query('SELECT uuid, business_name, slug FROM odofy_merchants WHERE slug = $1', [req.params.slug]);
    if (!merchant.rows.length) return res.status(404).json({ error: 'Store not found' });
    const products = await pool.query(
      'SELECT id, title, description, price_cents, image_url, in_stock FROM merchant_products WHERE merchant_id = $1 AND in_stock = true ORDER BY created_at DESC',
      [merchant.rows[0].uuid]
    );
    return res.json({ merchant: merchant.rows[0], products: products.rows });
  } catch (err) {
    console.error('Store products fetch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/store/:slug/checkout', async (req, res) => {
  try {
    const merchant = await pool.query('SELECT uuid, business_name, latitude, longitude FROM odofy_merchants WHERE slug = $1', [req.params.slug]);
    if (!merchant.rows.length) return res.status(404).json({ error: 'Store not found' });
    const m = merchant.rows[0];
    const { customer_name, customer_phone, delivery_address, items, is_scheduled, scheduled_window_start, scheduled_window_end } = req.body || {};
    if (!customer_name || !delivery_address || !items || !items.length) {
      return res.status(400).json({ error: 'Missing required fields: customer_name, delivery_address, items' });
    }
    let totalCents = 0;
    for (const item of items) {
      const p = await pool.query('SELECT price_cents FROM merchant_products WHERE id = $1 AND merchant_id = $2', [item.product_id, m.uuid]);
      if (p.rows.length) totalCents += p.rows[0].price_cents * (item.qty || 1);
    }
    const orderNumber = 'ODF-' + require('crypto').randomBytes(3).toString('hex').toUpperCase();
    const useScheduled = !!(is_scheduled && scheduled_window_start && scheduled_window_end);
    const result = await pool.query(
      `INSERT INTO odofy_trips (uuid, merchant_id, order_number, customer_name, customer_phone, delivery_address,
        dest_latitude, dest_longitude, status, driver_payout, created_at,
        is_scheduled, scheduled_window_start, scheduled_window_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_PICKUP', $9, NOW(),
        $10, $11, $12) RETURNING uuid, order_number, status`,
      [require('crypto').randomUUID(), m.uuid, orderNumber, customer_name, customer_phone || null, delivery_address,
       m.latitude, m.longitude, totalCents,
       useScheduled, useScheduled ? scheduled_window_start : null, useScheduled ? scheduled_window_end : null]
    );
    console.log(`[ORDER] New order ${orderNumber} for ${req.params.slug} — ${items.length} items, $${(totalCents/100).toFixed(2)}`);
    return res.json({ success: true, order: result.rows[0] });
  } catch (err) {
    console.error('Store checkout error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

