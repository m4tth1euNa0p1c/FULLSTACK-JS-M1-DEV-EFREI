const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { unauthorized, emailAlreadyUsed } = require('../utils/errors');

const INVALID_CREDENTIALS = 'Email ou mot de passe incorrect';

/**
 * Le JWT ne contient que l'identifiant utilisateur (claim "sub") et une expiration.
 * Il est signé avec JWT_SECRET : le serveur peut vérifier qu'il n'a pas été altéré
 * sans rien stocker en base.
 */
function signToken(user) {
  return jwt.sign({ sub: user.id }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: env.jwtExpiresIn,
  });
}

function toAuthResponse(user) {
  return { user: user.toJSON(), token: signToken(user) };
}

async function register({ email, password }) {
  const existing = await User.findOne({ email });
  if (existing) throw emailAlreadyUsed();

  // Seul le hash bcrypt est stocké : le mot de passe en clair n'est jamais persisté.
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);

  let user;
  try {
    user = await User.create({ email, passwordHash });
  } catch (err) {
    // Deux inscriptions simultanées avec le même email : l'index unique tranche.
    if (err.code === 11000) throw emailAlreadyUsed();
    throw err;
  }
  return toAuthResponse(user);
}

async function login({ email, password }) {
  const user = await User.findOne({ email });
  // Même message dans les deux cas : on ne révèle pas si l'email existe.
  if (!user) throw unauthorized(INVALID_CREDENTIALS);

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) throw unauthorized(INVALID_CREDENTIALS);

  return toAuthResponse(user);
}

module.exports = { register, login, signToken };
