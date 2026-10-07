/**
 * Erreur applicative : porte le statut HTTP et le code contractuel.
 * Le middleware errorHandler la transforme en {"error":{"code","message"}}.
 */
class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

const invalidInput = (message) => new AppError(400, 'INVALID_INPUT', message);
const unauthorized = (message = 'Authentification requise') =>
  new AppError(401, 'UNAUTHORIZED', message);
const notFound = (message = 'Ressource introuvable') => new AppError(404, 'NOT_FOUND', message);
const emailAlreadyUsed = () => new AppError(409, 'EMAIL_ALREADY_USED', 'Cet email est déjà utilisé');

module.exports = { AppError, invalidInput, unauthorized, notFound, emailAlreadyUsed };
