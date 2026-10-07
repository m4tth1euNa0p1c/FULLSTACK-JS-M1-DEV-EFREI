const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { unauthorized } = require('../utils/errors');
const { isObjectIdString } = require('../utils/objectId');

/**
 * Lit "Authorization: Bearer <jwt>", vérifie la signature et l'expiration,
 * puis expose req.user = { id }. Toute anomalie donne 401 sans détail exploitable.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token, ...rest] = header.split(' ');

  if (scheme !== 'Bearer' || !token || rest.length > 0) {
    return next(unauthorized("Jeton d'authentification manquant"));
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return next(unauthorized('Jeton invalide ou expiré'));
  }

  if (!isObjectIdString(payload.sub)) {
    return next(unauthorized('Jeton invalide'));
  }

  req.user = { id: payload.sub };
  return next();
}

module.exports = requireAuth;
