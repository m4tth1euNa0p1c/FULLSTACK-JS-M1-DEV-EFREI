const authService = require('../services/auth.service');
const { validateCredentials } = require('../validators/auth.validator');

// Les contrôleurs restent minces : valider l'entrée, appeler le service, formater la réponse.
// Les erreurs levées (AppError ou autre) remontent au errorHandler via Express 5.

async function register(req, res) {
  const credentials = validateCredentials(req.body);
  const result = await authService.register(credentials);
  res.status(201).json(result);
}

async function login(req, res) {
  const credentials = validateCredentials(req.body);
  const result = await authService.login(credentials);
  res.status(200).json(result);
}

module.exports = { register, login };
