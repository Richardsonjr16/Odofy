const pool = require('../db.js');

async function authenticateDriver(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const result = await pool.query(
      'SELECT * FROM odofy_drivers WHERE auth_token = $1 AND status IN ($2, $3)',
      [token, 'ACTIVE', 'PENDING_REVIEW']
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired driver token' });
    }

    req.driver = result.rows[0];
    next();
  } catch (err) {
    console.error('Driver authentication error:', err);
    return res.status(500).json({ error: 'Internal authentication error' });
  }
}

async function authenticateMerchant(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM odofy_merchants WHERE api_secret_key = $1',
      [apiKey]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.merchant = result.rows[0];
    next();
  } catch (err) {
    console.error('Merchant authentication error:', err);
    return res.status(500).json({ error: 'Internal authentication error' });
  }
}

module.exports = { authenticateDriver, authenticateMerchant };
