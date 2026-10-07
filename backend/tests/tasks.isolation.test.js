const request = require('supertest');
const { createApp } = require('../src/app');
const Task = require('../src/models/Task');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./setup/db');
const { registerUser, bearer, createTask } = require('./helpers/auth');

/**
 * Isolation de deux comptes A et B.
 *
 * Ces tests détectent la suppression de la protection par propriétaire :
 * si le filtre { ownerId } disparaît de task.service.js, B verra, modifiera
 * ou supprimera les tâches de A et chaque test ci-dessous échouera.
 */
const app = createApp();
let alice;
let bob;
let taskA1;
let taskA2;
let taskB1;

// Délai étendu : le démarrage simultané de plusieurs serveurs MongoDB en mémoire peut être lent.
beforeAll(connectTestDb, 90_000);
beforeEach(async () => {
  alice = await registerUser(app, 'alice@example.test');
  bob = await registerUser(app, 'bob@example.test');
  taskA1 = await createTask(app, alice.token, { title: 'Tâche A1', status: 'todo' });
  taskA2 = await createTask(app, alice.token, { title: 'Tâche A2', status: 'doing' });
  taskB1 = await createTask(app, bob.token, { title: 'Tâche B1', status: 'done' });
});
afterEach(clearTestDb);
afterAll(disconnectTestDb);

function expectNotFound(res) {
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
}

describe('Liste', () => {
  it('A ne voit que ses tâches', async () => {
    const res = await request(app).get('/api/tasks').set(bearer(alice.token));
    expect(res.status).toBe(200);
    const ids = res.body.items.map((task) => task.id).sort();
    expect(ids).toEqual([taskA1.id, taskA2.id].sort());
    expect(ids).not.toContain(taskB1.id);
  });

  it('B ne voit que ses tâches', async () => {
    const res = await request(app).get('/api/tasks').set(bearer(bob.token));
    expect(res.body.items.map((task) => task.id)).toEqual([taskB1.id]);
  });

  it('la liste ne contient aucun ownerId ni _id exploitable', async () => {
    const res = await request(app).get('/api/tasks').set(bearer(alice.token));
    for (const task of res.body.items) {
      expect(task.ownerId).toBeUndefined();
      expect(task._id).toBeUndefined();
    }
  });
});

describe('Lecture', () => {
  it('B reçoit 404 sur une tâche de A encore existante', async () => {
    const res = await request(app).get(`/api/tasks/${taskA1.id}`).set(bearer(bob.token));
    expectNotFound(res);
    expect(JSON.stringify(res.body)).not.toContain('Tâche A1');
  });

  it('A lit toujours sa propre tâche (contrôle)', async () => {
    const res = await request(app).get(`/api/tasks/${taskA1.id}`).set(bearer(alice.token));
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Tâche A1');
  });
});

describe('Modification', () => {
  it('B reçoit 404 en PATCH sur une tâche de A et la tâche reste intacte', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskA1.id}`)
      .set(bearer(bob.token))
      .send({ title: 'Piratée', status: 'done' });
    expectNotFound(res);

    const stored = await Task.findById(taskA1.id).lean();
    expect(stored.title).toBe('Tâche A1');
    expect(stored.status).toBe('todo');
    expect(stored.ownerId.toString()).toBe(alice.user.id);
  });
});

describe('Suppression', () => {
  it('B reçoit 404 en DELETE sur une tâche de A et la tâche existe toujours', async () => {
    const res = await request(app).delete(`/api/tasks/${taskA1.id}`).set(bearer(bob.token));
    expectNotFound(res);

    expect(await Task.countDocuments({ _id: taskA1.id })).toBe(1);
    const stillThere = await request(app).get(`/api/tasks/${taskA1.id}`).set(bearer(alice.token));
    expect(stillThere.status).toBe(200);
  });

  it("la suppression par A de sa tâche n'affecte pas celles de B", async () => {
    const del = await request(app).delete(`/api/tasks/${taskA1.id}`).set(bearer(alice.token));
    expect(del.status).toBe(204);
    const listB = await request(app).get('/api/tasks').set(bearer(bob.token));
    expect(listB.body.items.map((task) => task.id)).toEqual([taskB1.id]);
  });
});

describe('Propriétaire imposé par le serveur', () => {
  it('B ne peut pas créer une tâche au nom de A via ownerId (400) et rien n’est créé', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(bearer(bob.token))
      .send({ title: 'Pour Alice', status: 'todo', ownerId: alice.user.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
    expect(await Task.countDocuments({ title: 'Pour Alice' })).toBe(0);
  });

  it('B ne peut pas transférer une tâche à A via PATCH ownerId (400)', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskB1.id}`)
      .set(bearer(bob.token))
      .send({ ownerId: alice.user.id });
    expect(res.status).toBe(400);
    const stored = await Task.findById(taskB1.id).lean();
    expect(stored.ownerId.toString()).toBe(bob.user.id);
  });

  it('chaque tâche créée est rattachée au compte du JWT, jamais à un autre', async () => {
    const tasksA = await Task.find({ ownerId: alice.user.id }).lean();
    const tasksB = await Task.find({ ownerId: bob.user.id }).lean();
    expect(tasksA.map((task) => task.title).sort()).toEqual(['Tâche A1', 'Tâche A2']);
    expect(tasksB.map((task) => task.title)).toEqual(['Tâche B1']);
  });
});
