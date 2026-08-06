// Real-time group-cart WebSocket controller.
//
// Runs inside the Bun.serve process (port 3000) via the `websocket` config in
// site/serve.ts — NOT inside Express. Native Bun WebSocket API, no socket.io.
//
// Message protocol (JSON):
//   { type: "join_group_cart",       roomCode, userId }        -> subscribe + broadcast aggregate
//   { type: "add_item_to_group",     roomCode, userId, productId, quantity } -> upsert + broadcast aggregate
//   { type: "remove_item_from_group", roomCode, itemId }       -> delete + broadcast aggregate
//   { type: "sync_cart",             roomCode }                -> send aggregate to requester only
//
// Broadcast payload: { type: "cart_update", roomCode, items: [...] }

const path = require('path');
// Load the LIVE backend env (ep-winter-fog) before touching the pool. This module
// is imported from the site process, whose own .env points at a stale Neon project
// — without the override, group carts would read/write the wrong database.
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env'), override: true });
const pool = require('../../src/db.js');

// roomCode -> Set<WebSocket>. All membership lives in this module so serve.ts only
// delegates open/message/close.
const rooms = new Map();
// ws -> roomCode, the module's source of truth for disconnect cleanup (does not
// rely on expando properties on Bun's ServerWebSocket host object).
const wsRoom = new WeakMap();

// 6-char uppercase room codes, no ambiguous 0/O/1/I (matches the REST endpoint's
// generator in src/routes/-store.js).
const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

// Errors safe to echo back to the client verbatim (validation, cart-not-found).
class ClientError extends Error {}

function send(ws, data) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(roomCode, data) {
  const sockets = rooms.get(roomCode);
  if (!sockets || sockets.size === 0) return;
  const payload = JSON.stringify(data);
  for (const ws of sockets) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

async function fetchCartItems(sharedCartId) {
  const result = await pool.query(
    `SELECT sci.id, sci.user_id, sci.product_id, sci.quantity,
            mp.title, mp.price_cents, mp.image_url
     FROM shared_cart_items sci
     JOIN merchant_products mp ON mp.id = sci.product_id
     WHERE sci.shared_cart_id = $1
     ORDER BY sci.created_at ASC`,
    [sharedCartId]
  );
  return result.rows;
}

// Room lookup by code; null when the room has no cart yet.
async function findCartByRoomCode(roomCode) {
  const result = await pool.query('SELECT id FROM shared_carts WHERE room_code = $1', [roomCode]);
  return result.rows.length > 0 ? result.rows[0].id : null;
}

// Defensive create-if-missing. shared_carts.merchant_id is NOT NULL, and the WS
// protocol carries no merchant context, so a genuinely new room can only be
// provisioned through POST /api/v1/store/:slug/group-cart (the frontend always
// creates the cart there first). If this INSERT still trips the NOT NULL
// constraint, the client gets a clear error instead of a silent 500.
async function getOrCreateCart(roomCode) {
  const existing = await findCartByRoomCode(roomCode);
  if (existing) return existing;
  const result = await pool.query(
    'INSERT INTO shared_carts (room_code) VALUES ($1) RETURNING id',
    [roomCode]
  );
  return result.rows[0].id;
}

function parsePayload(rawData) {
  const text = typeof rawData === 'string' ? rawData : Buffer.from(rawData).toString('utf8');
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('Payload must be a JSON object');
  return parsed;
}

async function handleMessage(ws, rawData) {
  let msg;
  try {
    msg = parsePayload(rawData);
  } catch {
    send(ws, { type: 'error', error: 'Invalid JSON payload' });
    return;
  }

  const type = msg.type;
  if (typeof type !== 'string' || type.length === 0) {
    send(ws, { type: 'error', error: 'Missing message type' });
    return;
  }

  const roomCode = typeof msg.roomCode === 'string' ? msg.roomCode.toUpperCase() : '';

  try {
    switch (type) {
      case 'join_group_cart': {
        if (!ROOM_CODE_RE.test(roomCode)) {
          return send(ws, { type: 'error', error: 'Invalid roomCode' });
        }
        // Bind this socket to the room BEFORE any DB work so a later failure
        // still gets cleaned up on disconnect.
        wsRoom.set(ws, roomCode);
        let sockets = rooms.get(roomCode);
        if (!sockets) {
          sockets = new Set();
          rooms.set(roomCode, sockets);
        }
        sockets.add(ws);

        const sharedCartId = await getOrCreateCart(roomCode).catch((err) => {
          // merchant_id is NOT NULL, so a never-provisioned room can only be
          // created through the REST endpoint — tell the client, don't 500,
          // and roll back the room membership we optimistically added.
          if (err && err.code === '23502') {
            const sockets = rooms.get(roomCode);
            if (sockets) {
              sockets.delete(ws);
              if (sockets.size === 0) rooms.delete(roomCode);
            }
            wsRoom.delete(ws);
            return Promise.reject(
              new ClientError(
                'Cart not found. Create it via POST /api/v1/store/:slug/group-cart first'
              )
            );
          }
          throw err;
        });
        const items = await fetchCartItems(sharedCartId);
        return broadcast(roomCode, { type: 'cart_update', roomCode, items });
      }

      case 'add_item_to_group': {
        const userId = msg.userId;
        const productId = msg.productId;
        const quantity = msg.quantity;
        if (!ROOM_CODE_RE.test(roomCode)) {
          return send(ws, { type: 'error', error: 'Invalid roomCode' });
        }
        if (typeof userId !== 'string' || !userId.trim()) {
          return send(ws, { type: 'error', error: 'userId is required' });
        }
        if (typeof productId !== 'string' || !productId.trim()) {
          return send(ws, { type: 'error', error: 'productId is required' });
        }
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
          return send(ws, { type: 'error', error: 'quantity must be an integer between 1 and 99' });
        }
        const sharedCartId = await findCartByRoomCode(roomCode);
        if (!sharedCartId) {
          return send(ws, { type: 'error', error: 'Cart not found. Create it via POST /api/v1/store/:slug/group-cart first' });
        }
        // UPSERT: same user + product increments the existing line quantity.
        await pool.query(
          `INSERT INTO shared_cart_items (shared_cart_id, user_id, product_id, quantity)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (shared_cart_id, user_id, product_id)
           DO UPDATE SET quantity = shared_cart_items.quantity + EXCLUDED.quantity`,
          [sharedCartId, userId.trim(), productId.trim(), quantity]
        );
        const items = await fetchCartItems(sharedCartId);
        return broadcast(roomCode, { type: 'cart_update', roomCode, items });
      }

      case 'remove_item_from_group': {
        const itemId = msg.itemId;
        if (!ROOM_CODE_RE.test(roomCode)) {
          return send(ws, { type: 'error', error: 'Invalid roomCode' });
        }
        if (typeof itemId !== 'string' || !itemId.trim()) {
          return send(ws, { type: 'error', error: 'itemId is required' });
        }
        const sharedCartId = await findCartByRoomCode(roomCode);
        if (!sharedCartId) {
          return send(ws, { type: 'error', error: 'Cart not found' });
        }
        await pool.query(
          'DELETE FROM shared_cart_items WHERE id = $1 AND shared_cart_id = $2',
          [itemId.trim(), sharedCartId]
        );
        const items = await fetchCartItems(sharedCartId);
        return broadcast(roomCode, { type: 'cart_update', roomCode, items });
      }

      case 'sync_cart': {
        if (!ROOM_CODE_RE.test(roomCode)) {
          return send(ws, { type: 'error', error: 'Invalid roomCode' });
        }
        const sharedCartId = await findCartByRoomCode(roomCode);
        if (!sharedCartId) {
          return send(ws, { type: 'error', error: 'Cart not found' });
        }
        const items = await fetchCartItems(sharedCartId);
        return send(ws, { type: 'cart_update', roomCode, items });
      }

      default:
        return send(ws, { type: 'error', error: `Unknown message type: ${type}` });
    }
  } catch (err) {
    // Expected client-facing failures (validation, cart-not-found) get an error
    // reply without spamming server logs; unexpected errors are logged.
    if (!(err instanceof ClientError)) {
      console.error('[ws] group-cart handler error:', err);
    }
    const error = err instanceof ClientError ? err.message : 'Internal error';
    return send(ws, { type: 'error', error });
  }
}

// Called from serve.ts's websocket.close handler. Unsubscribes the socket from
// its room and drops empty room sets so memory does not leak.
function handleClose(ws) {
  const roomCode = wsRoom.get(ws);
  if (!roomCode) return;
  wsRoom.delete(ws);
  const sockets = rooms.get(roomCode);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) rooms.delete(roomCode);
  }
}

module.exports = { handleMessage, handleClose, rooms };
