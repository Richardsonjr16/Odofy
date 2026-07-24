const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;

const store = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(ip);
    }
  }
}, 60_000).unref();

function rateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let entry = store.get(ip);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(ip, entry);
  }

  entry.count += 1;

  if (entry.count > MAX_REQUESTS) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfterSec));
    return res.status(429).json({ error: 'Too many requests' });
  }

  next();
}

module.exports = rateLimiter;
