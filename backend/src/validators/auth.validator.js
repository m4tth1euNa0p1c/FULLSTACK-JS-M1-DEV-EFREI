const { invalidInput } = require('../utils/errors');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72; // limite effective de bcrypt (72 octets)
const ALLOWED_FIELDS = ['email', 'password'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Valide et normalise un corps {email, password} pour register et login.
 * Retourne {email (minuscules, trimé), password (inchangé)} ou lève une AppError 400.
 */
function validateCredentials(body) {
  if (!isPlainObject(body)) {
    throw invalidInput('Le corps de la requête doit être un objet JSON avec email et password');
  }
  const unknown = Object.keys(body).filter((key) => !ALLOWED_FIELDS.includes(key));
  if (unknown.length > 0) {
    throw invalidInput(`Champs non autorisés : ${unknown.join(', ')}`);
  }

  const { email, password } = body;
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    throw invalidInput("L'email est invalide");
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    throw invalidInput(`Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw invalidInput(`Le mot de passe ne peut pas dépasser ${PASSWORD_MAX_LENGTH} caractères`);
  }

  // L'email est comparé et stocké sans distinction de casse.
  return { email: email.trim().toLowerCase(), password };
}

module.exports = { validateCredentials, PASSWORD_MIN_LENGTH };
