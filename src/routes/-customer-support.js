const express = require('express');
const pool = require('../db.js');

const router = express.Router();
const STATUS_KEYWORDS = ['where', 'late', 'status', 'tracking', 'delivery', 'arriving', 'eta'];
const ISSUE_KEYWORDS = ['missing', 'broken', 'damaged', 'wrong', 'refund', 'never arrived', "didn't receive"];

function includesKeyword(message, keywords) {
  const normalized = message.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function orderIdFromRow(row) {
  return row ? row.uuid : null;
}

router.post('/chat-triage', async (req, res) => {
  const { customer_name: customerName, message, order_number: orderNumber } = req.body || {};
  if (typeof customerName !== 'string' || !customerName.trim()) {
    return res.status(400).json({ error: 'customer_name is required' });
  }
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (orderNumber !== undefined && (typeof orderNumber !== 'string' || !orderNumber.trim())) {
    return res.status(400).json({ error: 'order_number must be a non-empty string' });
  }

  const text = message.trim();
  const number = typeof orderNumber === 'string' && orderNumber.trim() ? orderNumber.trim() : null;
  let reply;
  let order = null;
  let orderId = null;
  let escalated = false;

  try {
    if (includesKeyword(text, STATUS_KEYWORDS)) {
      if (!number) {
        reply = 'I can help track your order! Could you provide your order number (e.g., ODF-XXXXXX)?';
      } else {
        const result = await pool.query(
          `SELECT uuid, order_number, status, dest_latitude, dest_longitude, created_at
           FROM odofy_trips WHERE order_number = $1`,
          [number]
        );
        if (result.rows[0]) {
          const row = result.rows[0];
          orderId = orderIdFromRow(row);
          order = {
            order_number: row.order_number,
            status: row.status,
            dest_latitude: row.dest_latitude,
            dest_longitude: row.dest_longitude,
            created_at: row.created_at,
          };
          const coordinates = row.dest_latitude != null && row.dest_longitude != null
            ? ` Delivery destination coordinates are ${row.dest_latitude}, ${row.dest_longitude}.`
            : '';
          reply = `Your order #${row.order_number} is currently ${row.status}.${coordinates}`;
        } else {
          reply = `I couldn't find order #${number}. Please check the order number and try again.`;
        }
      }
    } else if (includesKeyword(text, ISSUE_KEYWORDS)) {
      if (!number) {
        reply = 'I\'m sorry about the issue! Could you share your order number so I can open a dispute for you?';
      } else {
        const orderResult = await pool.query(
          'SELECT uuid FROM odofy_trips WHERE order_number = $1',
          [number]
        );
        orderId = orderResult.rows[0]?.uuid || null;
        const disputeResult = await pool.query(
          `INSERT INTO disputes_ledger (order_id, customer_id, reason_category, description, status)
           VALUES ($1, $2, 'MISSING_ITEM', $3, 'PENDING')
           RETURNING id`,
          [orderId, customerName.trim(), text]
        );
        const disputeId = disputeResult.rows[0].id;
        reply = `I'm sorry to hear that! I've opened a dispute ticket for order #${number}. Our team will review it within 24 hours and contact you. Your reference is ${disputeId}.`;
        escalated = true;
      }
    } else {
      reply = "Thanks for reaching out! I can help with tracking your order or reporting an issue. Try asking: 'Where is my order?' or 'My item arrived damaged'.";
    }

    const transcript = JSON.stringify([
      { role: 'customer', text },
      { role: 'bot', text: reply },
    ]);
    await pool.query(
      `INSERT INTO support_chat_logs (customer_id, order_id, chat_transcript, escalation_status)
       VALUES ($1, $2, $3::jsonb, $4)`,
      [customerName.trim(), orderId, transcript, escalated ? 'PENDING_ADMIN' : 'RESOLVED']
    );

    const response = { reply };
    if (order) response.order = order;
    if (escalated) response.escalated = true;
    return res.json(response);
  } catch (err) {
    console.error('Customer support chat triage error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
