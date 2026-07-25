const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const express = require('express');

const requestLogger = require('./middleware/logger');
const rateLimiter = require('./middleware/rateLimiter');
const shopifyRoutes = require('./routes/shopify');
const tripsRoutes = require('./routes/trips');
const driversRoutes = require('./routes/drivers');
const merchantsRoutes = require('./routes/merchants');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(requestLogger);
app.use(rateLimiter);

app.use(
  '/api/v1/odofy/integrations/shopify',
  express.raw({ type: 'application/json' }),
  shopifyRoutes
);

app.use(express.json());

app.use('/api/v1/odofy/trips', tripsRoutes);
app.use('/api/v1/odofy/drivers', driversRoutes);
app.use('/api/v1/odofy/merchants', merchantsRoutes);
app.use('/api/v1/odofy/admin', adminRoutes);

app.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`Odofy backend listening on port ${port}`);
  });
}
