const express = require('express');
const crypto = require('crypto');
const pool = require('../db.js');
const router = express.Router();

// 6-char alphanumeric code (no ambiguous 0/O/1/I) for ODF-XXXXXX order numbers.
const ORDER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// 6-char uppercase room codes for group carts — same non-ambiguous alphabet so
// codes are easy to read over the phone and to type on a TV remote.
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateOrderNumber() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ORDER_CODE_ALPHABET[crypto.randomInt(ORDER_CODE_ALPHABET.length)];
  }
  return `ODF-${code}`;
}

function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_ALPHABET[crypto.randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

function toMerchantRow(m) {
  return {
    uuid: m.uuid,
    business_name: m.business_name,
    slug: m.slug,
    lat: m.latitude === null ? null : Number(m.latitude),
    lng: m.longitude === null ? null : Number(m.longitude),
  };
}

const MERCHANT_SELECT = 'SELECT uuid, business_name, slug, latitude, longitude FROM odofy_merchants';

async function findMerchantBySlug(slug) {
  const result = await pool.query(`${MERCHANT_SELECT} WHERE slug = $1`, [slug]);
  return result.rows[0] || null;
}

// GET /api/v1/store/:slug — public merchant lookup (no auth)
router.get('/:slug', async (req, res) => {
  try {
    const merchant = await findMerchantBySlug(req.params.slug);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });
    return res.json({ merchant: toMerchantRow(merchant) });
  } catch (err) {
    console.error('Store merchant lookup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/store/:slug/products — public catalog for one merchant (no auth).
// Returns every product with its in_stock flag so the storefront can render
// "Sold Out" cards for out-of-stock items.
router.get('/:slug/products', async (req, res) => {
  try {
    const merchant = await findMerchantBySlug(req.params.slug);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });
    const productsResult = await pool.query(
      `SELECT id, title, description, price_cents, image_url, in_stock
       FROM merchant_products
       WHERE merchant_id = $1
       ORDER BY created_at DESC`,
      [merchant.uuid]
    );
    return res.json({ merchant: toMerchantRow(merchant), products: productsResult.rows });
  } catch (err) {
    console.error('Store products fetch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/store/:slug/checkout — public order placement (no auth).
// Stripe is not connected: the customer's details are collected and the order is
// created directly in odofy_trips for a driver to claim.
router.post('/:slug/checkout', async (req, res) => {
  try {
    const { customer_name, customer_phone, delivery_address, items } = req.body || {};
    if (typeof customer_name !== 'string' || !customer_name.trim()) {
      return res.status(400).json({ error: 'customer_name is required' });
    }
    if (typeof customer_phone !== 'string' || !customer_phone.trim()) {
      return res.status(400).json({ error: 'customer_phone is required' });
    }
    if (typeof delivery_address !== 'string' || !delivery_address.trim()) {
      return res.status(400).json({ error: 'delivery_address is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }
    const lineItems = [];
    for (const item of items) {
      const productId = item && item.product_id;
      const qty = item && item.qty;
      if (typeof productId !== 'string' || !productId || !Number.isInteger(qty) || qty < 1 || qty > 99) {
        return res.status(400).json({ error: 'Each item needs a product_id (string) and qty (integer 1-99)' });
      }
      lineItems.push({ product_id: productId, qty });
    }

    const merchant = await findMerchantBySlug(req.params.slug);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    const productIds = lineItems.map((i) => i.product_id);
    const productsResult = await pool.query(
      'SELECT id, title, price_cents, in_stock FROM merchant_products WHERE id = ANY($1::uuid[]) AND merchant_id = $2',
      [productIds, merchant.uuid]
    );
    if (productsResult.rows.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products were not found for this merchant' });
    }
    const productMap = new Map(productsResult.rows.map((p) => [p.id, p]));
    for (const item of lineItems) {
      const product = productMap.get(item.product_id);
      if (!product.in_stock) {
        return res.status(400).json({ error: `"${product.title}" is out of stock` });
      }
    }
    const totalCents = lineItems.reduce(
      (sum, item) => sum + productMap.get(item.product_id).price_cents * item.qty,
      0
    );
    const itemCount = lineItems.reduce((sum, item) => sum + item.qty, 0);

    const orderNumber = generateOrderNumber();
    const result = await pool.query(
      `INSERT INTO odofy_trips
         (merchant_id, customer_name, customer_phone, delivery_address,
          dest_latitude, dest_longitude, status, order_number, total_cents)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING_PICKUP', $7, $8)
       RETURNING order_number, status, total_cents`,
      [
        merchant.uuid,
        customer_name.trim(),
        customer_phone.trim(),
        delivery_address.trim(),
        merchant.latitude,
        merchant.longitude,
        orderNumber,
        totalCents,
      ]
    );
    const order = result.rows[0];
    console.log(
      `[ORDER] New order ${orderNumber} for merchant ${req.params.slug} — ${itemCount} items, $${(totalCents / 100).toFixed(2)}`
    );
    return res.status(201).json({
      success: true,
      order: { order_number: order.order_number, status: order.status, total_cents: order.total_cents },
    });
  } catch (err) {
    console.error('Storefront checkout error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/store/:slug/group-cart — create a shared group cart (no auth).
// Generates a unique 6-char room code and returns it alongside the cart id so
// the storefront can open a WebSocket to /ws?room=CODE and broadcast joins.
router.post('/:slug/group-cart', async (req, res) => {
  try {
    const merchant = await findMerchantBySlug(req.params.slug);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    const hostUserId =
      req.body && typeof req.body.host_user_id === 'string' && req.body.host_user_id.trim()
        ? req.body.host_user_id.trim()
        : null;

    let roomCode = generateRoomCode();
    let inserted = null;
    // Room codes are UNIQUE — retry a few times on collision before giving up.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const result = await pool.query(
          `INSERT INTO shared_carts (room_code, merchant_id, host_user_id)
           VALUES ($1, $2, $3)
           RETURNING id, room_code`,
          [roomCode, merchant.uuid, hostUserId]
        );
        inserted = result.rows[0];
        break;
      } catch (err) {
        if (err && err.code === '23505' && attempt < 4) {
          roomCode = generateRoomCode();
          continue;
        }
        throw err;
      }
    }
    if (!inserted) {
      return res.status(500).json({ error: 'Failed to allocate a unique room code' });
    }

    console.log(`[GROUP-CART] Created room ${inserted.room_code} for merchant ${req.params.slug}`);
    return res.status(201).json({ room_code: inserted.room_code, shared_cart_id: inserted.id });
  } catch (err) {
    console.error('Group cart creation error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/store/:slug/group-cart/:roomCode — current aggregate cart contents
// (no auth). Lets a late joiner hydrate their UI before/without opening a WS.
router.get('/:slug/group-cart/:roomCode', async (req, res) => {
  try {
    const merchant = await findMerchantBySlug(req.params.slug);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    const roomCode = String(req.params.roomCode || '').toUpperCase();
    const cartResult = await pool.query(
      'SELECT id, room_code, status FROM shared_carts WHERE room_code = $1 AND merchant_id = $2',
      [roomCode, merchant.uuid]
    );
    if (cartResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    const cart = cartResult.rows[0];
    const itemsResult = await pool.query(
      `SELECT sci.id, sci.user_id, sci.product_id, sci.quantity,
              mp.title, mp.price_cents, mp.image_url
       FROM shared_cart_items sci
       JOIN merchant_products mp ON mp.id = sci.product_id
       WHERE sci.shared_cart_id = $1
       ORDER BY sci.created_at ASC`,
      [cart.id]
    );
    return res.json({
      room_code: cart.room_code,
      status: cart.status,
      shared_cart_id: cart.id,
      items: itemsResult.rows,
    });
  } catch (err) {
    console.error('Group cart fetch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
