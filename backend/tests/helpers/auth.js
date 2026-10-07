const request = require('supertest');

/**
 * Fixtures d'authentification déterministes : crée un compte via l'API réelle
 * et renvoie son JWT, prêt pour l'en-tête Authorization.
 */
async function registerUser(app, email = 'alice@example.test', password = 'MotDePasse123!') {
  const res = await request(app).post('/api/auth/register').send({ email, password });
  if (res.status !== 201) {
    throw new Error(`Inscription de ${email} échouée : ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, user: res.body.user, email, password };
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

/** Crée une tâche valide et renvoie le corps de réponse. */
async function createTask(app, token, overrides = {}) {
  const res = await request(app)
    .post('/api/tasks')
    .set(bearer(token))
    .send({ title: 'Tâche de test', status: 'todo', ...overrides });
  if (res.status !== 201) {
    throw new Error(`Création de tâche échouée : ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

module.exports = { registerUser, bearer, createTask };
