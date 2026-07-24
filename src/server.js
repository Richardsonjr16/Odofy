require('dotenv').config();

const express = require('express');

const shopifyRoutes = require('./routes/shopify');
const tripsRoutes = require('./routes/trips');
const driversRoutes = require('./routes/drivers');
const merchantsRoutes = require('./routes/merchants');

const app = express();

app.use(
  '/api/v1/odofy/integrations/shopify',
  express.raw({ type: 'application/json' }),
  shopifyRoutes
);

app.use(express.json());

app.use('/api/v1/odofy/trips', tripsRoutes);
app.use('/api/v1/odofy/drivers', driversRoutes);
app.use('/api/v1/odofy/merchants', merchantsRoutes);

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
