const request = require('supertest');
const { createApp } = require('../src/app');
const Task = require('../src/models/Task');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./setup/db');
const { registerUser, bearer, createTask } = require('./helpers/auth');

const app = createApp();
let token;
let userId;

// Délai étendu : le démarrage simultané de plusieurs serveurs MongoDB en mémoire peut être lent.
beforeAll(connectTestDb, 90_000);
beforeEach(async () => {
  ({ token, user: { id: userId } } = await registerUser(app));
});
afterEach(clearTestDb);
afterAll(disconnectTestDb);

function expectInvalidInput(res) {
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: { code: 'INVALID_INPUT', message: expect.any(String) } });
  expect(res.body.error.message.length).toBeGreaterThan(0);
}

describe('Validation de POST /api/tasks', () => {
  const valid = { title: 'Valide', status: 'todo' };

  it.each([
    ['titre manquant', { status: 'todo' }],
    ['titre vide', { ...valid, title: '' }],
    ['titre composé d’espaces', { ...valid, title: '    ' }],
    ['titre de 121 caractères', { ...valid, title: 'a'.repeat(121) }],
    ['titre non textuel', { ...valid, title: 42 }],
    ['titre null', { ...valid, title: null }],
    ['statut manquant', { title: 'Valide' }],
    ['statut hors énumération (archived)', { ...valid, status: 'archived' }],
    ['statut en majuscules', { ...valid, status: 'TODO' }],
    ['statut non textuel', { ...valid, status: 1 }],
    ['description de 1001 caractères', { ...valid, description: 'd'.repeat(1001) }],
    ['description non textuelle', { ...valid, description: ['x'] }],
    ['description null', { ...valid, description: null }],
    ['date impossible 2026-02-30', { ...valid, dueDate: '2026-02-30' }],
    ['date impossible 2026-04-31', { ...valid, dueDate: '2026-04-31' }],
    ['mois 13', { ...valid, dueDate: '2026-13-01' }],
    ['jour 0', { ...valid, dueDate: '2026-01-00' }],
    ['29 février hors année bissextile', { ...valid, dueDate: '2025-02-29' }],
    ['format DD/MM/YYYY', { ...valid, dueDate: '05/10/2026' }],
    ['format sans zéro initial', { ...valid, dueDate: '2026-10-5' }],
    ['date avec heure', { ...valid, dueDate: '2026-10-05T10:00:00Z' }],
    ['date numérique', { ...valid, dueDate: 20261005 }],
    ['date vide', { ...valid, dueDate: '' }],
    ['champ inconnu', { ...valid, priority: 'high' }],
    ['id fourni par le client', { ...valid, id: '507f1f77bcf86cd799439011' }],
    ['_id fourni par le client', { ...valid, _id: '507f1f77bcf86cd799439011' }],
    ['ownerId fourni par le client', { ...valid, ownerId: '507f1f77bcf86cd799439011' }],
    ['corps tableau', [valid]],
    ['corps chaîne', 'bonjour'],
  ])('refuse %s avec 400 INVALID_INPUT', async (_label, body) => {
    const res = await request(app).post('/api/tasks').set(bearer(token)).send(body);
    expectInvalidInput(res);
    expect(await Task.countDocuments()).toBe(0);
  });

  it('refuse un corps absent avec 400', async () => {
    const res = await request(app).post('/api/tasks').set(bearer(token));
    expectInvalidInput(res);
  });

  it('refuse un JSON mal formé avec 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(bearer(token))
      .set('Content-Type', 'application/json')
      .send('{"title": "cassé"');
    expectInvalidInput(res);
  });

  it.each([
    ['titre de 120 caractères', { ...valid, title: 'a'.repeat(120) }],
    ['description vide', { ...valid, description: '' }],
    ['description de 1000 caractères', { ...valid, description: 'd'.repeat(1000) }],
    ['dueDate null explicite', { ...valid, dueDate: null }],
    ['29 février en année bissextile', { ...valid, dueDate: '2028-02-29' }],
    ['statut doing', { ...valid, status: 'doing' }],
    ['statut done', { ...valid, status: 'done' }],
  ])('accepte %s avec 201', async (_label, body) => {
    const res = await request(app).post('/api/tasks').set(bearer(token)).send(body);
    expect(res.status).toBe(201);
  });

  it('ignore toute tentative de choisir le propriétaire : la tâche appartient au JWT', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(bearer(token))
      .send({ ...valid, ownerId: '000000000000000000000000' });
    expect(res.status).toBe(400);

    // Une création valide est bien rattachée à l'utilisateur du jeton.
    const ok = await request(app).post('/api/tasks').set(bearer(token)).send(valid);
    const stored = await Task.findById(ok.body.id).lean();
    expect(stored.ownerId.toString()).toBe(userId);
  });
});

describe('Validation de PATCH /api/tasks/:id', () => {
  let taskId;

  beforeEach(async () => {
    ({ id: taskId } = await createTask(app, token, { title: 'Origine', status: 'todo' }));
  });

  it.each([
    ['PATCH vide', {}],
    ['titre vide', { title: '' }],
    ['titre trop long', { title: 'a'.repeat(121) }],
    ['statut invalide', { status: 'archived' }],
    ['description trop longue', { description: 'd'.repeat(1001) }],
    ['date impossible', { dueDate: '2026-02-30' }],
    ['champ inconnu', { priority: 'high' }],
    ['champ inconnu mêlé à un champ valide', { status: 'done', foo: 'bar' }],
    ['id', { id: '507f1f77bcf86cd799439011' }],
    ['_id', { _id: '507f1f77bcf86cd799439011' }],
    ['ownerId', { ownerId: '507f1f77bcf86cd799439011' }],
    ['ownerId mêlé à un champ valide', { status: 'done', ownerId: '507f1f77bcf86cd799439011' }],
    ['corps tableau', [{ status: 'done' }]],
  ])('refuse %s avec 400 et ne modifie pas la tâche', async (_label, body) => {
    const res = await request(app).patch(`/api/tasks/${taskId}`).set(bearer(token)).send(body);
    expectInvalidInput(res);

    const unchanged = await request(app).get(`/api/tasks/${taskId}`).set(bearer(token));
    expect(unchanged.body).toMatchObject({ title: 'Origine', status: 'todo' });
  });

  it('refuse un corps absent avec 400', async () => {
    const res = await request(app).patch(`/api/tasks/${taskId}`).set(bearer(token));
    expectInvalidInput(res);
  });
});
