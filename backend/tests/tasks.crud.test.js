const request = require('supertest');
const { createApp } = require('../src/app');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./setup/db');
const { registerUser, bearer } = require('./helpers/auth');

const app = createApp();
let token;

// Délai étendu : le démarrage simultané de plusieurs serveurs MongoDB en mémoire peut être lent.
beforeAll(connectTestDb, 90_000);
beforeEach(async () => {
  ({ token } = await registerUser(app));
});
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe('Parcours CRUD nominal sur /api/tasks', () => {
  it('liste vide : 200 avec exactement {"items":[]}', async () => {
    const res = await request(app).get('/api/tasks').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ items: [] });
  });

  it('créer, lister, consulter, modifier puis supprimer une tâche', async () => {
    // Création
    const created = await request(app)
      .post('/api/tasks')
      .set(bearer(token))
      .send({
        title: 'Préparer la démo',
        status: 'todo',
        description: 'Plan et données',
        dueDate: '2026-10-05',
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      id: expect.any(String),
      title: 'Préparer la démo',
      status: 'todo',
      description: 'Plan et données',
      dueDate: '2026-10-05',
    });
    expect(created.body.id).toMatch(/^[0-9a-f]{24}$/);
    expect(created.body._id).toBeUndefined();
    expect(created.body.ownerId).toBeUndefined();
    const { id } = created.body;

    // Liste
    const list = await request(app).get('/api/tasks').set(bearer(token));
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ id, title: 'Préparer la démo' });

    // Détail
    const detail = await request(app).get(`/api/tasks/${id}`).set(bearer(token));
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual(created.body);

    // Modification partielle : seul status change, le reste est conservé
    const patched = await request(app)
      .patch(`/api/tasks/${id}`)
      .set(bearer(token))
      .send({ status: 'done' });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({
      id,
      title: 'Préparer la démo',
      status: 'done',
      description: 'Plan et données',
      dueDate: '2026-10-05',
    });

    // La modification est bien persistée
    const afterPatch = await request(app).get(`/api/tasks/${id}`).set(bearer(token));
    expect(afterPatch.body.status).toBe('done');

    // Suppression : 204 sans corps
    const deleted = await request(app).delete(`/api/tasks/${id}`).set(bearer(token));
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe('');

    // Après suppression : 404 NOT_FOUND
    const afterDelete = await request(app).get(`/api/tasks/${id}`).set(bearer(token));
    expect(afterDelete.status).toBe(404);
    expect(afterDelete.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });

    const emptyAgain = await request(app).get('/api/tasks').set(bearer(token));
    expect(emptyAgain.body).toEqual({ items: [] });
  });

  it('applique les valeurs par défaut : description "" et dueDate null', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(bearer(token))
      .send({ title: 'Minimale', status: 'doing' });
    expect(res.status).toBe(201);
    expect(res.body.description).toBe('');
    expect(res.body.dueDate).toBeNull();
  });

  it('trime le titre à la création', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(bearer(token))
      .send({ title: '   Avec espaces   ', status: 'todo' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Avec espaces');
  });

  it('permet de remettre dueDate à null via PATCH', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set(bearer(token))
      .send({ title: 'Datée', status: 'todo', dueDate: '2026-12-31' });
    const res = await request(app)
      .patch(`/api/tasks/${created.body.id}`)
      .set(bearer(token))
      .send({ dueDate: null });
    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBeNull();
  });

  it('PATCH de plusieurs champs à la fois', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set(bearer(token))
      .send({ title: 'Avant', status: 'todo' });
    const res = await request(app)
      .patch(`/api/tasks/${created.body.id}`)
      .set(bearer(token))
      .send({ title: 'Après', description: 'Mise à jour', status: 'doing', dueDate: '2026-11-15' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'Après',
      description: 'Mise à jour',
      status: 'doing',
      dueDate: '2026-11-15',
    });
  });
});

describe('Identifiants', () => {
  it.each(['abc', '123', 'zzzzzzzzzzzzzzzzzzzzzzzz', '507f1f77bcf86cd79943901'])(
    'id malformé "%s" : 400 INVALID_INPUT en GET, PATCH et DELETE',
    async (badId) => {
      const get = await request(app).get(`/api/tasks/${badId}`).set(bearer(token));
      const patch = await request(app)
        .patch(`/api/tasks/${badId}`)
        .set(bearer(token))
        .send({ status: 'done' });
      const del = await request(app).delete(`/api/tasks/${badId}`).set(bearer(token));

      for (const res of [get, patch, del]) {
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_INPUT');
      }
    },
  );

  it('id bien formé mais inexistant : 404 NOT_FOUND en GET, PATCH et DELETE', async () => {
    const missingId = '507f1f77bcf86cd799439011';
    const get = await request(app).get(`/api/tasks/${missingId}`).set(bearer(token));
    const patch = await request(app)
      .patch(`/api/tasks/${missingId}`)
      .set(bearer(token))
      .send({ status: 'done' });
    const del = await request(app).delete(`/api/tasks/${missingId}`).set(bearer(token));

    for (const res of [get, patch, del]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
    }
  });
});
