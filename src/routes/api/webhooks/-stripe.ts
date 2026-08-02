const express = require('express');
const pool = require('../../../db.js');
const Stripe = require('stripe');

const router = express.Router();

router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header.' });
    return;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured.');
    res.status(500).json({ error: 'Webhook secret not configured.' });
    return;
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY not configured.');
    res.status(500).json({ error: 'Stripe key not configured.' });
    return;
  }

  const stripe = Stripe(stripeKey);

  let event;
  try {
    // req.body is a Buffer when express.raw() middleware is used upstream
    const rawBody = req.body;
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    return;
  }

  // --- Handle payment_intent.succeeded ---
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const piId = paymentIntent.id;

    console.log(`Stripe webhook: payment_intent.succeeded for PI ${piId}`);

    try {
      // Update order status to paid
      const result = await pool.query(
        `UPDATE orders
         SET status = 'paid', updated_at = NOW()
         WHERE stripe_payment_intent_id = $1
         RETURNING id, store_id, customer_email, total_cents`,
        [piId]
      );

      if (result.rows.length === 0) {
        console.warn(`No order found for PI ${piId} — may have been created outside Odofy.`);
        res.status(200).json({ received: true, warning: 'No matching order found.' });
        return;
      }

      const order = result.rows[0];
      console.log(`Order ${order.id} set to paid. Triggering dispatch...`);

      // --- Trigger fleet dispatch via internal Mapbox route optimization ---
      try {
        const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
        const adminKey = process.env.ODOFY_ADMIN_API_KEY;

        if (mapboxToken && adminKey) {
          const dispatchUrl = `http://localhost:3001/api/v1/odofy/notify-drivers/optimize-route`;

          await fetch(dispatchUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': adminKey,
            },
            body: JSON.stringify({ store_id: order.store_id }),
          });
          console.log(`Dispatch triggered for store ${order.store_id}`);
        }
      } catch (dispatchErr) {
        // Dispatch failure should not fail the webhook response
        console.error('Dispatch trigger failed:', dispatchErr.message);
      }

      res.status(200).json({
        received: true,
        order_id: order.id,
        status: 'paid',
      });
    } catch (dbErr) {
      console.error('Database update failed:', dbErr);
      res.status(500).json({ error: 'Database update failed.' });
    }
    return;
  }

  // --- Handle other event types we care about ---
  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object;
    console.warn(`Payment failed for PI ${paymentIntent.id}: ${paymentIntent.last_payment_error?.message}`);
  }

  // Acknowledge all other events
  res.status(200).json({ received: true, type: event.type });
});

module.exports = router;
