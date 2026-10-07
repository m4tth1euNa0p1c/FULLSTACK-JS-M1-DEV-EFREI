const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const routes = require('./routes');
const notFoundHandler = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

/**
 * Construit l'application Express sans ouvrir de port ni se connecter à MongoDB.
 * Les tests importent createApp() et pilotent la base eux-mêmes ; server.js
 * s'occupe de la connexion et de l'écoute.
 */
function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
