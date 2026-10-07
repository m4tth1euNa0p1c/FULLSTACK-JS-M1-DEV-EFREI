const { notFound } = require('../utils/errors');

// Aucune route ne correspond : même format d'erreur que le reste de l'API.
function notFoundHandler(req, res, next) {
  next(notFound(`Route introuvable : ${req.method} ${req.originalUrl}`));
}

module.exports = notFoundHandler;
