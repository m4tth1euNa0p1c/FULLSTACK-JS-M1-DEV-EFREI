const request = require('supertest');
const { createApp } = require('../src/app');

// Aucune base nécessaire : la route de santé ne touche pas MongoDB.
describe('GET /api/health', () => {
  const app = createApp();

  it('répond 200 avec exactement {"status":"ok"}', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.text).toBe('{"status":"ok"}');
  });

  it('renvoie 404 NOT_FOUND au format contractuel pour une route inconnue', async () => {
    const res = await request(app).get('/api/inconnue');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String) },
    });
  });

  it("n'expose pas l'en-tête X-Powered-By", async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
