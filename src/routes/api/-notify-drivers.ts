import express from 'express';
import { sql } from '../../db.ts';
import { sendSms } from '../../lib/sms.js';

const router = express.Router();

function authenticateAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.ODOFY_ADMIN_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

router.post('/', authenticateAdmin, async (_req, res) => {
  try {
    if (
      !process.env.TWILIO_ACCOUNT_SID ||
      !process.env.TWILIO_AUTH_TOKEN ||
      !process.env.TWILIO_PHONE_NUMBER
    ) {
      res.status(500).json({
        error:
          'Twilio is not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.',
      });
      return;
    }

    const db = sql();
    const drivers = await db`
      SELECT phone_number, first_name, last_name
      FROM odofy_drivers
      WHERE status = 'APPROVED'
    `;

    if (drivers.length === 0) {
      res.status(200).json({ success: true, totalSent: 0 });
      return;
    }

    const messageBody =
      "There's higher than normal order volume in your area! Turn on Odofy for earnings opportunities.";

    let totalSent = 0;
    const BATCH_SIZE = 20;

    for (let i = 0; i < drivers.length; i += BATCH_SIZE) {
      const batch = drivers.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((driver) => sendSms(driver.phone_number, messageBody)),
      );
      totalSent += results.filter((r) => r.status === 'fulfilled').length;
    }

    res.status(200).json({ success: true, totalSent });
  } catch (err) {
    console.error('Notify drivers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export = router;
