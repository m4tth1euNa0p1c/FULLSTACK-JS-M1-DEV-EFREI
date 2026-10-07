const request = require('supertest');
const { createApp } = require('../src/app');
const { connectTestDb, restartDbConnection, disconnectTestDb } = require('./setup/db');
const { registerUser, bearer, createTask } = require('./helpers/auth');

/**
 * Persistance après redémarrage de l'API.
 *
 * Procédure reproductible : on crée des données avec une première instance de
 * l'application, on coupe la connexion MongoDB et on en rouvre une nouvelle
 * (comme un redémarrage du processus Node), puis une seconde instance de
 * l'application doit retrouver exactement les mêmes données.
 * Le même scénario manuel est décrit dans docs/RECETTE.md.
 */
// Délai étendu : le démarrage simultané de plusieurs serveurs MongoDB en mémoire peut être lent.
beforeAll(connectTestDb, 90_000);
afterAll(disconnectTestDb);

describe('Persistance MongoDB entre deux démarrages de l’API', () => {
  it('les comptes et les tâches non supprimées survivent au redémarrage', async () => {
    // Avant redémarrage : première instance de l'application
    const appBefore = createApp();
    const alice = await registerUser(appBefore, 'alice@example.test');
    const kept = await createTask(appBefore, alice.token, {
      title: 'À conserver',
      status: 'doing',
      description: 'Doit survivre',
      dueDate: '2026-11-01',
    });
    const removed = await createTask(appBefore, alice.token, { title: 'À supprimer', status: 'todo' });
    await request(appBefore).delete(`/api/tasks/${removed.id}`).set(bearer(alice.token)).expect(204);

    // Redémarrage simulé : nouvelle connexion, nouvelle application Express
    await restartDbConnection();
    const appAfter = createApp();

    // Le compte existe toujours : la connexion fonctionne avec le même mot de passe
    const login = await request(appAfter)
      .post('/api/auth/login')
      .send({ email: alice.email, password: alice.password });
    expect(login.status).toBe(200);
    expect(login.body.user.id).toBe(alice.user.id);

    // La tâche conservée est intacte, avec le même id et les mêmes champs
    const detail = await request(appAfter)
      .get(`/api/tasks/${kept.id}`)
      .set(bearer(login.body.token));
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual(kept);

    // La tâche supprimée ne revient pas
    const gone = await request(appAfter).get(`/api/tasks/${removed.id}`).set(bearer(login.body.token));
    expect(gone.status).toBe(404);

    const list = await request(appAfter).get('/api/tasks').set(bearer(login.body.token));
    expect(list.body.items.map((task) => task.id)).toEqual([kept.id]);
  });

  it('le JWT émis avant le redémarrage reste valide (signature par JWT_SECRET, sans état serveur)', async () => {
    const appBefore = createApp();
    const bob = await registerUser(appBefore, 'bob@example.test');

    await restartDbConnection();
    const appAfter = createApp();

    const res = await request(appAfter).get('/api/tasks').set(bearer(bob.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });
});
