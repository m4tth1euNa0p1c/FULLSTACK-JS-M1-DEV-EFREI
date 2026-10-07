const { AppError } = require('../utils/errors');

function sendError(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

/**
 * Gestion centralisée : toute erreur (synchrone ou promesse rejetée, Express 5
 * les transmet automatiquement) est convertie au format contractuel.
 * On ne renvoie jamais de trace ni de détail interne au client.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return sendError(res, err.status, err.code, err.message);
  }
  // JSON illisible ou corps trop volumineux (erreurs du parser express.json)
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'INVALID_INPUT', "Le corps de la requête n'est pas un JSON valide");
  }
  if (err.type === 'entity.too.large') {
    return sendError(res, 400, 'INVALID_INPUT', 'Le corps de la requête est trop volumineux');
  }
  // Filet de sécurité : erreurs Mongoose (normalement interceptées en amont par les validateurs)
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return sendError(res, 400, 'INVALID_INPUT', 'Données invalides');
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error('Erreur non gérée :', err);
  }
  return sendError(res, 500, 'INTERNAL_ERROR', 'Erreur interne du serveur');
}

module.exports = errorHandler;
