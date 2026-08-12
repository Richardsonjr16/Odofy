const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), override: true });

const express = require('express');

const requestLogger = require('./middleware/logger');
const rateLimiter = require('./middleware/rateLimiter');
const shopifyRoutes = require('./routes/-shopify');
const tripsRoutes = require('./routes/-trips');
const driversRoutes = require('./routes/-drivers');
const merchantsRoutes = require('./routes/-merchants');
const storeRoutes = require('./routes/-store');
const customerSupportRoutes = require('./routes/-customer-support');
const predictiveDemandRoutes = require('./routes/-predictive-demand');
const leadScrubRoutes = require('./routes/-lead-scrub');
const marketingRoutes = require('./routes/-marketing');
const adminRoutes = require('./routes/-admin');
const notifyDriversRoutes = require('./routes/api/-notify-drivers');
const webhookOrdersRoutes = require('./routes/api/webhooks/-orders');
const checkoutRoutes = require('./routes/api/checkout/-create-session');
const stripeWebhookRoutes = require('./routes/api/webhooks/-stripe');
const verifyIdentityRoutes = require('./routes/api/-verify-identity');
const ratingsRoutes = require('./routes/-ratings');
const ordersRoutes = require('./routes/-orders');
const demoRequestsRoutes = require('./routes/-demo-requests');
const { startHoldReleaser } = require('./services/holdReleaser');
const { startIdentityReleaser } = require('./services/identityReleaser');
// Self-starting worker: releases scheduled trips whose window is approaching.
// Loaded after the pool module so DATABASE_URL is configured by dotenv above.
require('./workers/-scheduled-dispatch');

const app = express();

app.use(requestLogger);
app.use(rateLimiter);

app.use(
  '/api/v1/odofy/integrations/shopify',
  express.raw({ type: 'application/json' }),
  shopifyRoutes
);

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/v1/odofy/trips', tripsRoutes);
app.use('/api/v1/odofy/drivers', driversRoutes);
app.use('/api/v1/odofy/merchants', merchantsRoutes);
app.use('/api/v1/store', storeRoutes);
app.use('/api/v1/customer/support', customerSupportRoutes);
app.use('/api/v1/driver', predictiveDemandRoutes);
app.use('/api/v1/driver', leadScrubRoutes);
app.use('/api/v1/merchant/marketing', marketingRoutes);
app.use('/api/v1/odofy/admin', adminRoutes);
app.use('/api/v1/odofy/notify-drivers', notifyDriversRoutes);
app.use('/api/v1/odofy/drivers', verifyIdentityRoutes);
app.use('/api/v1/ratings', ratingsRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/odofy/webhooks/orders', webhookOrdersRoutes);
app.use('/api/v1/odofy/checkout', checkoutRoutes);
app.use('/api/v1/odofy/demo-requests', demoRequestsRoutes);
app.use(
  '/api/v1/odofy/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookRoutes
);

app.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`Odofy backend listening on port ${port}`);
    startHoldReleaser();
    startIdentityReleaser();
  });
}
