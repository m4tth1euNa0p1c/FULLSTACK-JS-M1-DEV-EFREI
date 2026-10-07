const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./setup/db');
const { registerUser, createTask } = require('./helpers/auth');

const app = createApp();
let token;
let userId;
let taskId;

// Délai étendu : le démarrage simultané de plusieurs serveurs MongoDB en mémoire peut être lent.
beforeAll(connectTestDb, 90_000);
beforeEach(async () => {
  ({ token, user: { id: userId } } = await registerUser(app));
  ({ id: taskId } = await createTask(app, token));
});
afterEach(clearTestDb);
afterAll(disconnectTestDb);

function expectUnauthorized(res) {
  expect(res.status).toBe(401);
  expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: expect.any(String) } });
}

/** Envoie les cinq requêtes métier avec l'en-tête donné et vérifie qu'elles sont toutes refusées. */
async function expectAllTaskRoutesUnauthorized(headers) {
  const responses = await Promise.all([
    request(app).get('/api/tasks').set(headers),
    request(app).post('/api/tasks').set(headers).send({ title: 'x', status: 'todo' }),
    request(app).get(`/api/tasks/${taskId}`).set(headers),
    request(app).patch(`/api/tasks/${taskId}`).set(headers).send({ status: 'done' }),
    request(app).delete(`/api/tasks/${taskId}`).set(headers),
  ]);
  responses.forEach(expectUnauthorized);
}

describe('Protection Bearer des routes /api/tasks', () => {
  it('sans en-tête Authorization : 401 sur les cinq routes', async () => {
    await expectAllTaskRoutesUnauthorized({});
  });

  it('avec un schéma autre que Bearer : 401', async () => {
    await expectAllTaskRoutesUnauthorized({ Authorization: `Basic ${token}` });
  });

  it('avec "Bearer" sans jeton : 401', async () => {
    await expectAllTaskRoutesUnauthorized({ Authorization: 'Bearer' });
  });

  it('avec un jeton signé par une autre clé (falsifié) : 401', async () => {
    const forged = jwt.sign({ sub: userId }, 'autre-cle-secrete', { expiresIn: '1h' });
    await expectAllTaskRoutesUnauthorized({ Authorization: `Bearer ${forged}` });
  });

  it('avec un jeton dont le contenu a été modifié après signature : 401', async () => {
    const [header, , signature] = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: '000000000000000000000000' }))
      .toString('base64url');
    const tampered = `${header}.${tamperedPayload}.${signature}`;
    await expectAllTaskRoutesUnauthorized({ Authorization: `Bearer ${tampered}` });
  });

  it('avec un jeton non signé (alg none) : 401', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: userId })).toString('base64url');
    await expectAllTaskRoutesUnauthorized({ Authorization: `Bearer ${header}.${payload}.` });
  });

  it('avec un jeton expiré : 401', async () => {
    const expired = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: -10 });
    await expectAllTaskRoutesUnauthorized({ Authorization: `Bearer ${expired}` });
  });

  it('avec une chaîne quelconque : 401', async () => {
    await expectAllTaskRoutesUnauthorized({ Authorization: 'Bearer pas-un-jwt' });
  });

  it('avec un jeton valide mais sans identifiant utilisateur exploitable : 401', async () => {
    const noSub = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    await expectAllTaskRoutesUnauthorized({ Authorization: `Bearer ${noSub}` });
  });

  it('un jeton valide donne bien accès (contrôle du test)', async () => {
    const res = await request(app).get('/api/tasks').set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
  });

  it('un 401 ne révèle aucune donnée privée', async () => {
    const res = await request(app).get(`/api/tasks/${taskId}`);
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain('Tâche de test');
  });
});
