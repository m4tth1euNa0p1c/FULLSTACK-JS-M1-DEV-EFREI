const request = require('supertest');
const mongoose = require('mongoose');
const { createApp } = require('../src/app');
const Task = require('../src/models/Task');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./setup/db');
const { registerUser, bearer, createTask } = require('./helpers/auth');

/**
 * Bonus B4 : statistiques hebdomadaires via l'API.
 *
 * Critères d'acceptation :
 *  - completedAt est posé par le serveur au passage à done, conservé tant que la tâche reste
 *    done, remis à null si elle est rouverte ; jamais accepté dans un corps de requête ;
 *  - GET /api/tasks/stats/weekly renvoie weeks, today, tzOffset, series, overall, trend ;
 *    weeks (1..26, défaut 8), today (date civile) et tzOffset (minutes) sont validés → 400 ;
 *  - les séries ne comptent que les tâches du compte connecté ;
 *  - les instants sont rattachés aux semaines selon le fuseau du client (tzOffset).
 */
const app = createApp();
const TODAY = '2026-10-07';
let alice;
let bob;

// Délai étendu : le démarrage simultané de plusieurs serveurs MongoDB en mémoire peut être lent.
beforeAll(connectTestDb, 90_000);
beforeEach(async () => {
  alice = await registerUser(app, 'alice@example.test');
  bob = await registerUser(app, 'bob@example.test');
});
afterEach(clearTestDb);
afterAll(disconnectTestDb);

/**
 * Fixture déterministe : antidate une tâche directement via le driver MongoDB.
 * On contourne Mongoose, qui considère createdAt comme immuable et ignorerait sa modification.
 */
async function backdate(taskId, fields) {
  await Task.collection.updateOne({ _id: new mongoose.Types.ObjectId(taskId) }, { $set: fields });
}

const weekly = (token, query = {}) =>
  request(app).get('/api/tasks/stats/weekly').query(query).set(bearer(token));

const expectInvalidInput = (res) => {
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: { code: 'INVALID_INPUT', message: expect.any(String) } });
};

describe('Champ completedAt (posé par le serveur)', () => {
  it('vaut null à la création d’une tâche non terminée et apparaît dans le JSON', async () => {
    const task = await createTask(app, alice.token, { title: 'À faire', status: 'todo' });
    expect(task).toHaveProperty('completedAt', null);
  });

  it('est posé à la création d’une tâche directement terminée', async () => {
    const before = Date.now();
    const task = await createTask(app, alice.token, { title: 'Déjà faite', status: 'done' });
    expect(typeof task.completedAt).toBe('string');
    expect(new Date(task.completedAt).getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it('est posé au passage à done, conservé ensuite, puis effacé à la réouverture', async () => {
    const task = await createTask(app, alice.token, { title: 'Cycle', status: 'todo' });

    const done = await request(app).patch(`/api/tasks/${task.id}`).set(bearer(alice.token)).send({ status: 'done' });
    expect(done.status).toBe(200);
    expect(typeof done.body.completedAt).toBe('string');

    // Une autre modification ne change pas l'instant de complétion.
    const renamed = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(bearer(alice.token))
      .send({ title: 'Cycle renommé' });
    expect(renamed.body.completedAt).toBe(done.body.completedAt);

    // Repasser à done alors que la tâche l'est déjà ne change rien non plus.
    const stillDone = await request(app).patch(`/api/tasks/${task.id}`).set(bearer(alice.token)).send({ status: 'done' });
    expect(stillDone.body.completedAt).toBe(done.body.completedAt);

    const reopened = await request(app).patch(`/api/tasks/${task.id}`).set(bearer(alice.token)).send({ status: 'doing' });
    expect(reopened.status).toBe(200);
    expect(reopened.body.completedAt).toBeNull();

    const stored = await Task.findById(task.id).lean();
    expect(stored.completedAt).toBeNull();
  });

  it('est refusé dans un corps de requête (POST et PATCH → 400)', async () => {
    const post = await request(app)
      .post('/api/tasks')
      .set(bearer(alice.token))
      .send({ title: 'Triche', status: 'done', completedAt: '2020-01-01T00:00:00Z' });
    expectInvalidInput(post);

    const task = await createTask(app, alice.token, { title: 'Honnête', status: 'todo' });
    const patch = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(bearer(alice.token))
      .send({ completedAt: '2020-01-01T00:00:00Z' });
    expectInvalidInput(patch);
  });
});

describe('GET /api/tasks/stats/weekly', () => {
  /** Scénario de référence (identique aux tests unitaires), construit via l'API puis antidaté. */
  async function seedScenario(token) {
    const make = async (status, createdAt, completedAt) => {
      const task = await createTask(app, token, { title: `Tâche ${createdAt}`, status });
      await backdate(task.id, {
        createdAt: new Date(createdAt),
        completedAt: completedAt ? new Date(completedAt) : null,
      });
      return task.id;
    };
    await make('done', '2026-09-22T09:00:00Z', '2026-09-25T17:00:00Z');
    await make('done', '2026-09-23T09:00:00Z', '2026-10-01T10:00:00Z');
    await make('doing', '2026-09-30T09:00:00Z', null);
    await make('done', '2026-10-06T08:00:00Z', '2026-10-06T12:00:00Z');
    await make('todo', '2026-10-07T08:00:00Z', null);
  }

  it('renvoie les séries, le taux global et la tendance du compte', async () => {
    await seedScenario(alice.token);
    // Bruit : tâches de B, qui ne doivent pas influencer les chiffres de A.
    await createTask(app, bob.token, { title: 'Bob 1', status: 'done' });
    await createTask(app, bob.token, { title: 'Bob 2', status: 'todo' });

    const res = await weekly(alice.token, { weeks: 3, today: TODAY });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      weeks: 3,
      today: TODAY,
      tzOffset: 0,
      series: [
        { weekStart: '2026-09-21', weekEnd: '2026-09-27', created: 2, completed: 1, open: 2, completionRate: 0.5 },
        { weekStart: '2026-09-28', weekEnd: '2026-10-04', created: 1, completed: 1, open: 2, completionRate: 0.5 },
        { weekStart: '2026-10-05', weekEnd: '2026-10-11', created: 2, completed: 1, open: 3, completionRate: 0.3333 },
      ],
      overall: { total: 5, done: 3, completionRate: 0.6 },
      trend: { currentRate: 0.3333, previousRate: 0.5, delta: -0.1667 },
    });
  });

  it('ne compte que les tâches du compte connecté', async () => {
    await seedScenario(alice.token);
    const res = await weekly(bob.token, { weeks: 3, today: TODAY });
    expect(res.status).toBe(200);
    expect(res.body.overall).toEqual({ total: 0, done: 0, completionRate: null });
    expect(res.body.series.every((week) => week.open === 0 && week.completionRate === null)).toBe(true);
  });

  it('utilise 8 semaines, tzOffset 0 et la date UTC du serveur par défaut', async () => {
    const res = await weekly(alice.token);
    expect(res.status).toBe(200);
    expect(res.body.weeks).toBe(8);
    expect(res.body.tzOffset).toBe(0);
    expect(res.body.series).toHaveLength(8);
    const serverToday = new Date().toISOString().slice(0, 10);
    expect(res.body.today).toBe(serverToday);
    const last = res.body.series[7];
    expect(serverToday >= last.weekStart && serverToday <= last.weekEnd).toBe(true);
  });

  it('rattache les instants aux semaines selon le fuseau du client', async () => {
    const task = await createTask(app, alice.token, { title: 'Dimanche soir', status: 'done' });
    await backdate(task.id, {
      createdAt: new Date('2026-10-01T09:00:00Z'),
      completedAt: new Date('2026-10-04T22:30:00Z'),
    });
    const utc = await weekly(alice.token, { weeks: 2, today: TODAY, tzOffset: 0 });
    const paris = await weekly(alice.token, { weeks: 2, today: TODAY, tzOffset: -120 });
    expect(utc.body.series.map((week) => week.completed)).toEqual([1, 0]);
    expect(paris.body.series.map((week) => week.completed)).toEqual([0, 1]);
    expect(paris.body.tzOffset).toBe(-120);
  });

  it('retient la dernière modification pour une tâche done sans completedAt (données antérieures au bonus)', async () => {
    const task = await createTask(app, alice.token, { title: 'Ancienne', status: 'done' });
    await backdate(task.id, {
      createdAt: new Date('2026-09-29T09:00:00Z'),
      updatedAt: new Date('2026-09-30T09:00:00Z'),
      completedAt: null,
    });
    const res = await weekly(alice.token, { weeks: 2, today: TODAY });
    expect(res.body.series[0]).toMatchObject({ weekStart: '2026-09-28', created: 1, completed: 1, open: 1, completionRate: 1 });
    expect(res.body.series[1]).toMatchObject({ weekStart: '2026-10-05', completed: 0, open: 0 });
  });

  it.each([
    ['weeks = 0', { weeks: '0' }],
    ['weeks = 27', { weeks: '27' }],
    ['weeks non entier', { weeks: '2.5' }],
    ['weeks texte', { weeks: 'huit' }],
    ['today impossible', { today: '2026-02-30' }],
    ['tzOffset texte', { tzOffset: 'paris' }],
    ['tzOffset hors plage', { tzOffset: '900' }],
    ['paramètre inconnu', { from: '2026-01-01' }],
  ])('refuse %s avec 400 INVALID_INPUT', async (_label, query) => {
    expectInvalidInput(await weekly(alice.token, query));
  });

  it('accepte les bornes : weeks = 1 et weeks = 26, tzOffset = ±840', async () => {
    expect((await weekly(alice.token, { weeks: '1' })).body.series).toHaveLength(1);
    expect((await weekly(alice.token, { weeks: '26' })).body.series).toHaveLength(26);
    expect((await weekly(alice.token, { tzOffset: '840' })).status).toBe(200);
    expect((await weekly(alice.token, { tzOffset: '-840' })).status).toBe(200);
  });

  it("n'est pas confondue avec un identifiant et exige un JWT", async () => {
    const ok = await weekly(alice.token, { weeks: '2' });
    expect(ok.status).toBe(200);
    const anonymous = await request(app).get('/api/tasks/stats/weekly');
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe('UNAUTHORIZED');
  });
});
