const request = require('supertest');
const { createApp } = require('../src/app');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./setup/db');
const { registerUser, bearer, createTask } = require('./helpers/auth');

/**
 * Bonus B1 : priorité, filtres et compteurs.
 *
 * Critères d'acceptation :
 *  - priority ∈ {low, medium, high}, facultative à la création (medium par défaut), modifiable en PATCH ;
 *  - GET /api/tasks accepte status, priority, due (overdue|today|upcoming|none) et today ;
 *    sans paramètre le comportement du MVP est inchangé ; valeur ou paramètre inconnu → 400 ;
 *  - GET /api/tasks/stats renvoie total, byStatus, byPriority, overdue pour le compte connecté ;
 *  - les filtres et les compteurs ne voient jamais les tâches d'un autre compte.
 */
const app = createApp();
const TODAY = '2026-10-07';
let alice;
let bob;
let fixtures;

// Délai étendu : le démarrage simultané de plusieurs serveurs MongoDB en mémoire peut être lent.
beforeAll(connectTestDb, 90_000);
beforeEach(async () => {
  alice = await registerUser(app, 'alice@example.test');
  bob = await registerUser(app, 'bob@example.test');
  fixtures = {
    overdueHigh: await createTask(app, alice.token, { title: 'En retard', status: 'todo', priority: 'high', dueDate: '2026-10-01' }),
    dueToday: await createTask(app, alice.token, { title: "Pour aujourd'hui", status: 'doing', dueDate: TODAY }),
    doneLate: await createTask(app, alice.token, { title: 'Terminée en retard', status: 'done', priority: 'low', dueDate: '2026-10-01' }),
    upcomingLow: await createTask(app, alice.token, { title: 'À venir', status: 'todo', priority: 'low', dueDate: '2026-10-20' }),
    noDue: await createTask(app, alice.token, { title: 'Sans échéance', status: 'todo' }),
  };
  // Tâche de B : ne doit apparaître dans aucun filtre ni compteur de A.
  await createTask(app, bob.token, { title: 'Tâche de Bob', status: 'todo', priority: 'high', dueDate: '2026-10-01' });
});
afterEach(clearTestDb);
afterAll(disconnectTestDb);

const ids = (res) => res.body.items.map((task) => task.id).sort();
const expectIds = (res, ...tasks) => {
  expect(res.status).toBe(200);
  expect(ids(res)).toEqual(tasks.map((task) => task.id).sort());
};
const expectInvalidInput = (res) => {
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: { code: 'INVALID_INPUT', message: expect.any(String) } });
};

describe('Champ priority', () => {
  it('vaut medium par défaut à la création', async () => {
    expect(fixtures.noDue.priority).toBe('medium');
    expect(fixtures.dueToday.priority).toBe('medium');
  });

  it.each(['low', 'medium', 'high'])('accepte la priorité %s à la création', async (priority) => {
    const res = await request(app)
      .post('/api/tasks')
      .set(bearer(alice.token))
      .send({ title: 'Priorisée', status: 'todo', priority });
    expect(res.status).toBe(201);
    expect(res.body.priority).toBe(priority);
  });

  it.each(['urgent', 'HIGH', '', 1, null])('refuse la priorité %p à la création (400)', async (priority) => {
    const res = await request(app)
      .post('/api/tasks')
      .set(bearer(alice.token))
      .send({ title: 'Priorisée', status: 'todo', priority });
    expectInvalidInput(res);
  });

  it('se modifie en PATCH et se refuse si invalide', async () => {
    const ok = await request(app)
      .patch(`/api/tasks/${fixtures.noDue.id}`)
      .set(bearer(alice.token))
      .send({ priority: 'high' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ id: fixtures.noDue.id, priority: 'high', title: 'Sans échéance' });

    const ko = await request(app)
      .patch(`/api/tasks/${fixtures.noDue.id}`)
      .set(bearer(alice.token))
      .send({ priority: 'urgent' });
    expectInvalidInput(ko);
  });

  it('est présent dans le détail et la liste', async () => {
    const detail = await request(app).get(`/api/tasks/${fixtures.overdueHigh.id}`).set(bearer(alice.token));
    expect(detail.body.priority).toBe('high');
    const list = await request(app).get('/api/tasks').set(bearer(alice.token));
    expect(list.body.items.every((task) => ['low', 'medium', 'high'].includes(task.priority))).toBe(true);
  });
});

describe('Filtres de GET /api/tasks', () => {
  const list = (query) => request(app).get('/api/tasks').query(query).set(bearer(alice.token));

  it('sans paramètre : toutes les tâches du compte, enveloppe {"items"} inchangée', async () => {
    const res = await list({});
    expectIds(res, ...Object.values(fixtures));
    expect(Object.keys(res.body)).toEqual(['items']);
  });

  it('status=todo', async () => {
    expectIds(await list({ status: 'todo' }), fixtures.overdueHigh, fixtures.upcomingLow, fixtures.noDue);
  });

  it('priority=low', async () => {
    expectIds(await list({ priority: 'low' }), fixtures.doneLate, fixtures.upcomingLow);
  });

  it('due=overdue : échéance passée et non terminée', async () => {
    expectIds(await list({ due: 'overdue', today: TODAY }), fixtures.overdueHigh);
  });

  it("due=today : échéance égale à la date de référence", async () => {
    expectIds(await list({ due: 'today', today: TODAY }), fixtures.dueToday);
  });

  it('due=upcoming : échéance supérieure ou égale à la date de référence', async () => {
    expectIds(await list({ due: 'upcoming', today: TODAY }), fixtures.dueToday, fixtures.upcomingLow);
  });

  it('due=none : sans échéance', async () => {
    expectIds(await list({ due: 'none' }), fixtures.noDue);
  });

  it('combine plusieurs filtres', async () => {
    expectIds(await list({ status: 'todo', priority: 'low' }), fixtures.upcomingLow);
    expectIds(await list({ status: 'todo', due: 'overdue', today: TODAY }), fixtures.overdueHigh);
    const none = await list({ status: 'done', due: 'overdue', today: TODAY });
    expect(none.status).toBe(200);
    expect(none.body).toEqual({ items: [] });
  });

  it('utilise la date UTC du serveur quand today est absent', async () => {
    const past = await createTask(app, alice.token, { title: 'Très ancienne', status: 'todo', dueDate: '2000-01-01' });
    const future = await createTask(app, alice.token, { title: 'Très lointaine', status: 'todo', dueDate: '2999-12-31' });
    const overdue = await list({ due: 'overdue' });
    expect(ids(overdue)).toContain(past.id);
    expect(ids(overdue)).not.toContain(future.id);
    const upcoming = await list({ due: 'upcoming' });
    expect(ids(upcoming)).toContain(future.id);
    expect(ids(upcoming)).not.toContain(past.id);
  });

  it.each([
    ['status hors liste', { status: 'archived' }],
    ['priority hors liste', { priority: 'urgent' }],
    ['due hors liste', { due: 'yesterday' }],
    ['today impossible', { due: 'overdue', today: '2026-02-30' }],
    ['today mal formaté', { today: '07/10/2026' }],
    ['paramètre inconnu', { foo: 'bar' }],
    ['paramètre inconnu mêlé à un filtre valide', { status: 'todo', page: '1' }],
  ])('refuse %s avec 400 INVALID_INPUT', async (_label, query) => {
    expectInvalidInput(await list(query));
  });

  it('refuse un paramètre répété (tableau) avec 400', async () => {
    const res = await request(app).get('/api/tasks?status=todo&status=done').set(bearer(alice.token));
    expectInvalidInput(res);
  });

  it('ne renvoie jamais les tâches de B, quel que soit le filtre', async () => {
    const bobTask = (await request(app).get('/api/tasks').set(bearer(bob.token))).body.items[0];
    for (const query of [{}, { status: 'todo' }, { priority: 'high' }, { due: 'overdue', today: TODAY }]) {
      expect(ids(await list(query))).not.toContain(bobTask.id);
    }
    const bobView = await request(app).get('/api/tasks').query({ priority: 'high' }).set(bearer(bob.token));
    expect(ids(bobView)).toEqual([bobTask.id]);
  });

  it('exige un JWT comme les autres routes', async () => {
    const res = await request(app).get('/api/tasks').query({ status: 'todo' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/tasks/stats', () => {
  it('compte les tâches de A par statut, par priorité et en retard', async () => {
    const res = await request(app).get('/api/tasks/stats').query({ today: TODAY }).set(bearer(alice.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 5,
      byStatus: { todo: 3, doing: 1, done: 1 },
      byPriority: { low: 2, medium: 2, high: 1 },
      overdue: 1,
    });
  });

  it('ne compte que les tâches du compte connecté', async () => {
    const res = await request(app).get('/api/tasks/stats').query({ today: TODAY }).set(bearer(bob.token));
    expect(res.body).toEqual({
      total: 1,
      byStatus: { todo: 1, doing: 0, done: 0 },
      byPriority: { low: 0, medium: 0, high: 1 },
      overdue: 1,
    });
  });

  it('renvoie des zéros pour un compte sans tâche', async () => {
    const carol = await registerUser(app, 'carol@example.test');
    const res = await request(app).get('/api/tasks/stats').set(bearer(carol.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 0,
      byStatus: { todo: 0, doing: 0, done: 0 },
      byPriority: { low: 0, medium: 0, high: 0 },
      overdue: 0,
    });
  });

  it("n'est pas confondue avec un identifiant de tâche", async () => {
    const res = await request(app).get('/api/tasks/stats').set(bearer(alice.token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
  });

  it.each([
    ['today impossible', { today: '2026-02-30' }],
    ['paramètre inconnu', { status: 'todo' }],
  ])('refuse %s avec 400', async (_label, query) => {
    expectInvalidInput(await request(app).get('/api/tasks/stats').query(query).set(bearer(alice.token)));
  });

  it('exige un JWT', async () => {
    const res = await request(app).get('/api/tasks/stats');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
