const express = require('express');
const pool = require('../../../db.js');
const Stripe = require('stripe');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { store_id, customer_email, subtotal_cents } = req.body || {};

    // --- Input validation ---
    if (!store_id || !customer_email || subtotal_cents == null) {
      res.status(400).json({
        error: 'store_id, customer_email, and subtotal_cents are required.',
      });
      return;
    }

    if (typeof subtotal_cents !== 'number' || subtotal_cents < 50) {
      res.status(400).json({
        error: 'subtotal_cents must be a number >= 50.',
      });
      return;
    }

    // --- Stripe secret key ---
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.status(500).json({ error: 'STRIPE_SECRET_KEY is not configured.' });
      return;
    }

    const stripe = Stripe(stripeKey);

    // --- Merchant lookup ---
    const merchantResult = await pool.query(
      `SELECT uuid, stripe_connect_id, business_name
       FROM odofy_merchants
       WHERE uuid = $1`,
      [store_id]
    );

    if (merchantResult.rows.length === 0) {
      res.status(404).json({ error: 'Merchant not found for the given store_id.' });
      return;
    }

    const merchant = merchantResult.rows[0];

    if (!merchant.stripe_connect_id) {
      res.status(400).json({
        error: 'Merchant has not completed Stripe Connect onboarding.',
      });
      return;
    }

    // --- Immutable fee constants ---
    const DELIVERY_FEE_CENTS = 850;
    const total_cents = subtotal_cents + DELIVERY_FEE_CENTS;

    // --- Create Stripe Destination Charge PaymentIntent ---
    const paymentIntent = await stripe.paymentIntents.create({
      amount: total_cents,
      currency: 'usd',
      application_fee_amount: DELIVERY_FEE_CENTS,
      transfer_data: {
        destination: merchant.stripe_connect_id,
      },
      metadata: {
        store_id,
        customer_email,
        subtotal_cents: String(subtotal_cents),
      },
    });

    // --- Log the pending order ---
    const orderResult = await pool.query(
      `INSERT INTO orders
         (store_id, customer_email, subtotal_cents, delivery_fee_cents,
          total_cents, platform_fee_cents, driver_payout_cents,
          stripe_payment_intent_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id`,
      [
        store_id,
        customer_email,
        subtotal_cents,
        DELIVERY_FEE_CENTS,
        total_cents,
        850,    // platform_fee_cents
        650,    // driver_payout_cents
        paymentIntent.id,
        'pending',
      ]
    );

    const order = orderResult.rows[0];

    // --- Return client_secret ---
    res.status(200).json({
      client_secret: paymentIntent.client_secret,
      order_id: order.id,
      total_cents,
      delivery_fee_cents: DELIVERY_FEE_CENTS,
    });
  } catch (err) {
    console.error('Checkout create-session error:', err);

    // Surface Stripe card / validation errors cleanly
    if (err.type && err.type.startsWith('Stripe')) {
      res.status(402).json({ error: err.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
